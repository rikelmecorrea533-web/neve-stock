import * as XLSX from 'xlsx';
import { StockItem, Folder, ImportPreviewRow, MaterialType, CatalogItem, ColumnMapping } from '../types/stock';
import {
  detectMaterialType,
  resolveItemType,
  sortItemsBySectionAndNart,
  isDescriptionAlvejado,
} from './destinationRules';
import { formatDateTime, formatKgNumber, formatKg } from './formatters';

export interface ParseResult {
  fileName: string;
  headers: string[];
  sampleRows: any[][];
  rawMatrix: any[][];
  headerRowIndex: number;
  detectedMapping: ColumnMapping;
  rows: ImportPreviewRow[];
  totalRawRows: number;
  duplicateMergedCount: number;
  errorCount: number;
  notInCatalogCount: number;
  auditAdjustedCount: number;
}

/**
 * Converte valores numéricos no padrão brasileiro ou internacional para número com 2 decimais
 * Ex: "423,86" -> 423.86 | "208,34" -> 208.34 | "1.525,2" -> 1525.20 | "1.200" -> 1200 | "419,4" -> 419.40
 * Nunca apaga a vírgula sem pôr o ponto decimal.
 */
export function parseBrazilianNumber(val: any): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }
  if (!val) return 0;
  let s = String(val).trim();

  // Caso contenha vírgula E ponto: decide pelo último separador
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Ex: 1.525,20 (ponto milhar, vírgula decimal)
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Ex: 7,427.18 (vírgula milhar, ponto decimal)
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Apenas vírgula: padrão brasileiro de decimal (ex: 208,34 ou 1525,2 ou 370,76)
    s = s.replace(',', '.');
  } else if (s.includes('.')) {
    // Apenas ponto: pode ser milhar brasileiro (1.200) ou decimal (7427.18)
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    }
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Preserva o código de lote exatamente como texto, mantendo zeros à esquerda sem arredondar
 */
export function preserveLotAsString(rawLot: any): string {
  if (rawLot === null || rawLot === undefined) return 'S/L';
  const str = String(rawLot).trim();
  return str.length > 0 ? str : 'S/L';
}

/**
 * Procura o cabeçalho em qualquer uma das primeiras 10 linhas da planilha
 */
export function findHeaderRowIndex(rawMatrix: any[][]): number {
  const maxSearch = Math.min(10, rawMatrix.length);
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < maxSearch; i++) {
    const row = rawMatrix[i];
    if (!row || !Array.isArray(row)) continue;

    let score = 0;
    const rowStrings = row.map((c) =>
      String(c || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    );

    for (const s of rowStrings) {
      if (s === 'produto' || s === 'codigo' || s === 'nart' || s === 'cadastro' || s === 'cod') {
        score += 4;
      } else if (s === 'saldo lote' || s === 'saldo do lote' || s === 'saldo' || s.includes('saldo')) {
        score += 4;
      } else if (s === 'lote' || s === 'no lote' || s === 'num lote' || s === 'numero lote') {
        score += 4;
      } else if (s === 'armazem' || s.includes('armaz')) {
        score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore >= 4 ? bestIndex : 0;
}

/**
 * Heurística inteligente local para detecção de colunas.
 * REGRA MANDATÓRIA NEVE STOCK:
 * • Código: Produto, Código, Codigo, NART, Cadastro, Cod.
 * • Saldo: qualquer coluna com a palavra "Saldo" (Saldo, Saldo Lote, Saldo do Lote), ou Quantidade, Qtd.
 *   Uma coluna com "Saldo" no nome é SEMPRE saldo, NUNCA lote.
 * • Lote: a coluna chamada exatamente "Lote" (ou "Nº Lote", "Num Lote") e que NÃO contém "Saldo".
 * • Armazem: só informativa (deve ser 12).
 * • Procure primeiro o nome exato, depois o parecido. Cada coluna só pode ser usada para um campo.
 */
export function detectColumnsHeuristic(headers: string[]): ColumnMapping {
  let nartColumn = '';
  let lotColumn = '';
  let qtyColumn = '';
  let warehouseColumn = '';
  let descriptionColumn = '';

  const clean = headers.map((h) => ({
    original: h,
    norm: h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  }));

  // 1. Identificar SALDO: Uma coluna com "Saldo" no nome é SEMPRE saldo, nunca lote.
  for (const item of clean) {
    if (item.norm === 'saldo lote' || item.norm === 'saldo do lote' || item.norm === 'saldo') {
      qtyColumn = item.original;
      break;
    }
  }
  if (!qtyColumn) {
    for (const item of clean) {
      if (item.norm.includes('saldo') || item.norm === 'quantidade' || item.norm === 'qtd' || item.norm.includes('quant')) {
        qtyColumn = item.original;
        break;
      }
    }
  }

  // 2. Identificar LOTE: A coluna chamada exatamente "Lote" (ou "Nº Lote", "Num Lote") e que NÃO contém "Saldo".
  for (const item of clean) {
    if (item.original === qtyColumn) continue;
    if (item.norm.includes('saldo')) continue;
    if (item.norm === 'lote' || item.norm === 'no lote' || item.norm === 'num lote' || item.norm === 'numero lote') {
      lotColumn = item.original;
      break;
    }
  }
  if (!lotColumn) {
    for (const item of clean) {
      if (item.original === qtyColumn) continue;
      if (item.norm.includes('saldo')) continue;
      if (item.norm.includes('lote') || item.norm === 'batch' || item.norm === 'lote/serie') {
        lotColumn = item.original;
        break;
      }
    }
  }

  // 3. Identificar CÓDIGO / NART: Produto, Código, Codigo, NART, Cadastro, Cod.
  for (const item of clean) {
    if (item.original === qtyColumn || item.original === lotColumn) continue;
    if (item.norm === 'produto' || item.norm === 'codigo' || item.norm === 'nart' || item.norm === 'cadastro' || item.norm === 'cod') {
      nartColumn = item.original;
      break;
    }
  }
  if (!nartColumn) {
    for (const item of clean) {
      if (item.original === qtyColumn || item.original === lotColumn) continue;
      if (item.norm.includes('produto') || item.norm.includes('codigo') || item.norm.includes('nart') || item.norm.includes('cadastro') || item.norm.startsWith('cod')) {
        nartColumn = item.original;
        break;
      }
    }
  }

  // 4. Armazém (12)
  for (const item of clean) {
    if (item.original === qtyColumn || item.original === lotColumn || item.original === nartColumn) continue;
    if (item.norm === 'armazem' || item.norm.includes('armaz') || item.norm.includes('origem') || item.norm.includes('deposito')) {
      warehouseColumn = item.original;
      break;
    }
  }

  // 5. Descrição (se houver)
  for (const item of clean) {
    if (item.original === qtyColumn || item.original === lotColumn || item.original === nartColumn || item.original === warehouseColumn) continue;
    if (item.norm.includes('descri') || item.norm.includes('material') || item.norm.includes('texto')) {
      descriptionColumn = item.original;
      break;
    }
  }

  // Fallbacks posicionais garantindo colunas distintas
  const remaining = headers.filter((h) => h !== nartColumn && h !== lotColumn && h !== qtyColumn);
  if (!nartColumn && remaining.length > 0) nartColumn = remaining.shift()!;
  if (!lotColumn && remaining.length > 0) lotColumn = remaining.shift()!;
  if (!qtyColumn && remaining.length > 0) qtyColumn = remaining.shift()!;

  return {
    nartColumn: nartColumn || (headers[0] || ''),
    lotColumn: lotColumn || (headers[1] || ''),
    qtyColumn: qtyColumn || (headers[2] || ''),
    warehouseColumn: warehouseColumn || undefined,
    descriptionColumn: descriptionColumn || undefined,
    method: 'heuristic',
  };
}

/**
 * Consulta a IA Gemini via endpoint do backend com timeout estrito de 3.5s e fallback imediato.
 * O Gemini SÓ identifica os nomes das colunas e NUNCA lê, arredonda ou reescreve valores de células.
 */
export async function detectColumnsWithAI(headers: string[], sampleRows: any[][]): Promise<ColumnMapping> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('/api/gemini/parse-columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, sampleRows }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const fallback = detectColumnsHeuristic(headers);

      // Validação estrita: coluna Lote NUNCA pode ter a palavra Saldo e deve ser distinta do Saldo
      const candidateLot = data.lotColumn;
      const isLotValid =
        candidateLot &&
        headers.includes(candidateLot) &&
        !candidateLot.toLowerCase().includes('saldo') &&
        candidateLot !== data.qtyColumn;

      return {
        nartColumn: headers.includes(data.nartColumn) ? data.nartColumn : fallback.nartColumn,
        lotColumn: isLotValid ? candidateLot : fallback.lotColumn,
        qtyColumn: headers.includes(data.qtyColumn) ? data.qtyColumn : fallback.qtyColumn,
        warehouseColumn: data.warehouseColumn,
        descriptionColumn: data.descriptionColumn,
        confidence: data.confidence || 0.95,
        method: data.method || 'ai',
      };
    }
  } catch (e) {
    console.warn('Falha ou timeout na requisição da IA Gemini, aplicando fallback heurístico imediato:', e);
  }

  return detectColumnsHeuristic(headers);
}

/**
 * Processa linhas brutas usando o mapeamento de colunas e o catálogo de tecidos.
 * Executa conferência automática direta com a célula original:
 * - Se algum valor for diferente, usa o valor da célula original e registra aviso.
 * - Ordena: NÃO alvejados em cima, ALVEJADOS sempre embaixo, ambos ordenados por NART.
 */
export function buildPreviewRowsFromMapping(
  rawMatrix: any[][],
  mapping: ColumnMapping,
  catalog: CatalogItem[],
  existingItems: StockItem[] = [],
  headerRowIndex: number = 0
): {
  rows: ImportPreviewRow[];
  duplicateMergedCount: number;
  errorCount: number;
  notInCatalogCount: number;
  auditAdjustedCount: number;
} {
  if (rawMatrix.length <= headerRowIndex + 1) {
    return { rows: [], duplicateMergedCount: 0, errorCount: 0, notInCatalogCount: 0, auditAdjustedCount: 0 };
  }

  const headers = rawMatrix[headerRowIndex].map((h: any) => String(h || '').trim());
  const nartIdx = headers.indexOf(mapping.nartColumn);
  const lotIdx = headers.indexOf(mapping.lotColumn);
  const qtyIdx = headers.indexOf(mapping.qtyColumn);
  const descIdx = mapping.descriptionColumn ? headers.indexOf(mapping.descriptionColumn) : -1;

  // Mapa rápido de catálogo por NART normalizado
  const catalogMap = new Map<string, CatalogItem>();
  for (const cat of catalog) {
    catalogMap.set(cat.nart.trim().toUpperCase(), cat);
  }

  const fileKeyMap = new Map<string, {
    row: ImportPreviewRow;
    count: number;
  }>();

  let errorCount = 0;
  let duplicateMergedCount = 0;
  let notInCatalogCount = 0;
  let auditAdjustedCount = 0;

  for (let i = headerRowIndex + 1; i < rawMatrix.length; i++) {
    const row = rawMatrix[i];
    if (!row || row.every((c: any) => String(c).trim() === '')) {
      continue; // Ignora linhas em branco
    }

    const rawNartCell = row[nartIdx];
    const rawLotCell = row[lotIdx];
    const rawQtyCell = row[qtyIdx];

    const rawNart = String(rawNartCell !== undefined && rawNartCell !== null ? rawNartCell : '').trim();

    // Ignora linhas de total ou sem código
    const nartUpper = rawNart.toUpperCase();
    if (!rawNart || nartUpper.includes('TOTAL') || nartUpper === 'SUBTOTAL') {
      continue;
    }

    // Leitura das células originais
    const origLotStr = rawLotCell !== undefined && rawLotCell !== null ? String(rawLotCell).trim() : '';
    const origQtyStr = rawQtyCell !== undefined && rawQtyCell !== null ? String(rawQtyCell).trim() : '';

    let rawLot = preserveLotAsString(rawLotCell);
    let parsedQty = parseBrazilianNumber(rawQtyCell);
    let auditNotice: string | undefined = undefined;

    // Conferência Automática com as células originais:
    // 1. Detecção de inversão acidental de colunas Lote <-> Saldo:
    const isLotLookingLikeDecimal = origLotStr.includes(',') || (/^\d+\.\d{2}$/.test(origLotStr));
    const isQtyLookingLikeLot = /^\d{6,14}$/.test(origQtyStr) && !origQtyStr.includes(',') && !origQtyStr.includes('.');

    if (isLotLookingLikeDecimal && isQtyLookingLikeLot) {
      rawLot = origQtyStr;
      parsedQty = parseBrazilianNumber(origLotStr);
      auditNotice = `Conferência automática: Lote/Ciclo (${rawLot}) e Saldo (${formatKgNumber(parsedQty)} kg) ajustados diretamente da célula original.`;
      auditAdjustedCount++;
    } else {
      // 2. Garantir integridade de vírgula decimal no Saldo
      if (origQtyStr.includes(',')) {
        const expectedWithComma = parseBrazilianNumber(origQtyStr);
        if (parsedQty !== expectedWithComma) {
          parsedQty = expectedWithComma;
          auditNotice = `Conferência automática: Saldo restaurado com vírgula decimal original (${origQtyStr}).`;
          auditAdjustedCount++;
        }
      }

      // 3. Garantir preservação do Lote textual exato
      if (origLotStr && rawLot !== origLotStr && !origLotStr.toLowerCase().includes('e+')) {
        rawLot = origLotStr;
        auditNotice = (auditNotice ? auditNotice + ' ' : '') + `Lote/Ciclo conferido com a célula original ("${origLotStr}").`;
        auditAdjustedCount++;
      }
    }

    const rowDesc = descIdx >= 0 && row[descIdx] ? String(row[descIdx]).trim() : '';

    // Cruzamento oficial Neve Medical: tabela dos 13 tecidos e catálogo
    const resolved = resolveItemType(rawNart, rowDesc, catalogMap);
    const notInCatalog = resolved.isNewCode;

    if (notInCatalog) {
      notInCatalogCount++;
    }

    const finalDescription = resolved.description || (rowDesc || `Produto ${rawNart} (Código novo – confira)`);
    const finalType: MaterialType = resolved.type;
    const finalAlvejado: boolean = resolved.alvejado;

    let isValid = true;
    let errorMessage = '';

    if (!rawNart) {
      isValid = false;
      errorMessage = 'Código/NART ausente.';
    } else if (isNaN(parsedQty) || parsedQty < 0) {
      isValid = false;
      errorMessage = `Saldo inválido ("${rawQtyCell}").`;
    }

    if (!isValid) {
      errorCount++;
    }

    // Chave única para mesclar mesmo código e mesmo lote/ciclo
    const key = `${nartUpper}__${rawLot.toUpperCase()}`;

    // Checa se já existe em outra pasta
    const existingMatch = existingItems.find(
      (item) =>
        item.nart.toUpperCase() === nartUpper &&
        item.lot.toUpperCase() === rawLot.toUpperCase()
    );

    if (fileKeyMap.has(key) && isValid) {
      // Mescla duplicatas no mesmo arquivo (soma a quantidade em kg com 2 decimais)
      const entry = fileKeyMap.get(key)!;
      entry.row.systemQty = Math.round((entry.row.systemQty + parsedQty) * 100) / 100;
      entry.count += 1;
      entry.row.isDuplicateInFile = true;
      entry.row.duplicateCountInFile = entry.count;
      duplicateMergedCount++;
    } else {
      const previewRow: ImportPreviewRow = {
        nart: rawNart,
        description: finalDescription,
        lot: rawLot,
        systemQty: isValid ? parsedQty : 0,
        type: finalType,
        alvejado: finalAlvejado,
        typeReviewRequired: resolved.needsConfirmation,
        notInCatalog,
        isNewCode: resolved.isNewCode,
        needsDescription: resolved.needsDescription,
        isDuplicateInFile: false,
        duplicateCountInFile: 1,
        alreadyExistsInOtherFolder: !!existingMatch,
        existingFolderInfo: existingMatch
          ? {
              date: formatDateTime(existingMatch.updatedAt || existingMatch.checkedAt),
              operator: existingMatch.checkedBy || 'Operador',
              folderName: existingMatch.folderId,
            }
          : undefined,
        isValid,
        errorMessage,
        auditNotice,
        originalLotCell: origLotStr,
        originalQtyCell: origQtyStr,
      };

      fileKeyMap.set(key, { row: previewRow, count: 1 });
    }
  }

  // Regra de Ordem: primeiro os NÃO alvejados; depois ALVEJADOS sempre embaixo, ambos por NART
  const allRows = Array.from(fileKeyMap.values()).map((e) => e.row);
  const rows = sortItemsBySectionAndNart(allRows);

  return { rows, duplicateMergedCount, errorCount, notInCatalogCount, auditAdjustedCount };
}

/**
 * Lê o arquivo Excel/CSV, localiza o cabeçalho nas 10 primeiras linhas e invoca a detecção de colunas
 */
export async function parseExcelOrCsv(
  file: File,
  catalog: CatalogItem[] = [],
  existingItems: StockItem[] = []
): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  // cellText: true e raw: false preserva textos com zeros à esquerda
  const workbook = XLSX.read(buffer, { type: 'array', raw: false, cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rawMatrix.length < 2) {
    throw new Error('A planilha está vazia ou não contém dados suficientes.');
  }

  // Identifica a linha de cabeçalho nas 10 primeiras linhas
  const headerRowIndex = findHeaderRowIndex(rawMatrix);
  const headers = rawMatrix[headerRowIndex].map((cell: any) => String(cell || '').trim());
  const sampleRows = rawMatrix.slice(headerRowIndex + 1, headerRowIndex + 4);

  // Detecção via IA com fallback heurístico
  const detectedMapping = await detectColumnsWithAI(headers, sampleRows);

  const { rows, duplicateMergedCount, errorCount, notInCatalogCount, auditAdjustedCount } = buildPreviewRowsFromMapping(
    rawMatrix,
    detectedMapping,
    catalog,
    existingItems,
    headerRowIndex
  );

  return {
    fileName: file.name,
    headers,
    sampleRows,
    rawMatrix,
    headerRowIndex,
    detectedMapping,
    rows,
    totalRawRows: rawMatrix.length - headerRowIndex - 1,
    duplicateMergedCount,
    errorCount,
    notInCatalogCount,
    auditAdjustedCount,
  };
}

/**
 * Exporta a lista de materiais conferidos de uma pasta para Excel (.xlsx)
 * Sempre em kg, respeitando seções e Lote vs Ciclo
 */
export function exportMaterialsToExcel(items: StockItem[], folderName: string = 'Estoque_Neve'): void {
  // Ordena com não alvejados primeiro, alvejados embaixo
  const sorted = sortItemsBySectionAndNart(items);

  const data = sorted.map((item) => {
    let destinoTexto = 'Pendente';
    if (item.allocations && item.allocations.length > 0) {
      destinoTexto = item.allocations
        .map((a) => `${a.warehouse} (${formatKgNumber(a.quantity)} kg)`)
        .join(' + ');
    } else if (item.status === 'NAO_ENCONTRADO') {
      destinoTexto = item.type === 'CAMPO' ? 'ARMAZÉM 04' : 'ARMAZÉM 06';
    }

    return {
      'Seção': item.alvejado ? 'ALVEJADOS' : 'NORMAIS',
      'NART': item.nart,
      'Descrição': item.description,
      'Lote / Ciclo': item.lot,
      'Identificação': item.alvejado ? 'CICLO' : 'LOTE',
      'Origem': item.originWarehouse || 'ARMAZÉM 12',
      'Saldo Sistêmico (kg)': item.systemQty,
      'Quantidade Física (kg)': item.physicalFound === null ? '' : item.physicalQty,
      'Diferença (kg)': item.physicalFound === null ? '' : item.difference,
      'Tipo': item.type,
      'Alvejado': item.alvejado ? 'SIM' : 'NÃO',
      'Armazém Destino': destinoTexto,
      'Status': item.status,
      'Transferido ERP': item.transferred ? 'SIM' : 'NÃO',
      'Operador Conferente': item.checkedBy || '-',
      'Data Conferência': item.checkedAt ? formatDateTime(item.checkedAt) : '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);

  worksheet['!cols'] = [
    { wch: 14 }, // Seção
    { wch: 16 }, // NART
    { wch: 45 }, // Descrição
    { wch: 18 }, // Lote / Ciclo
    { wch: 14 }, // Identificação
    { wch: 14 }, // Origem
    { wch: 20 }, // Saldo Sistêmico (kg)
    { wch: 22 }, // Quantidade Física (kg)
    { wch: 14 }, // Diferença (kg)
    { wch: 14 }, // Tipo
    { wch: 12 }, // Alvejado
    { wch: 32 }, // Armazém Destino
    { wch: 16 }, // Status
    { wch: 16 }, // Transferido ERP
    { wch: 20 }, // Operador
    { wch: 20 }, // Data Conferência
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Conferência Neve');

  const cleanName = folderName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  XLSX.writeFile(workbook, `NEVE_STOCK_${cleanName}_${timestamp}.xlsx`);
}

/**
 * Exporta a lista de transferências da pasta agrupada por destino para Excel (.xlsx)
 */
export function exportTransferListToExcel(items: StockItem[], folderName: string = 'Pasta'): void {
  const sorted = sortItemsBySectionAndNart(items);
  const data: any[] = [];

  for (const item of sorted) {
    const lotLabel = item.alvejado ? 'Ciclo' : 'Lote';

    if (item.allocations && item.allocations.length > 0) {
      for (const alloc of item.allocations) {
        data.push({
          'Destino': alloc.warehouse,
          'Seção': item.alvejado ? 'ALVEJADOS' : 'NORMAIS',
          'NART': item.nart,
          'Descrição': item.description,
          'Identificação': lotLabel,
          'Lote / Ciclo': item.lot,
          'Origem': 'ARMAZÉM 12',
          'Quantidade (kg)': alloc.quantity,
          'De -> Para': `De 12 para ${alloc.warehouse.replace('ARMAZÉM ', '')}`,
          'Status': item.transferred ? 'TRANSFERIDO' : 'PENDENTE',
          'Transferido Por': item.transferredBy || '-',
          'Data Transferência': item.transferredAt ? formatDateTime(item.transferredAt) : '-',
          'Pasta': item.folderId,
        });
      }
    } else if (item.status === 'NAO_ENCONTRADO') {
      const dest = item.type === 'CAMPO' ? 'ARMAZÉM 04' : 'ARMAZÉM 06';
      data.push({
        'Destino': dest,
        'Seção': item.alvejado ? 'ALVEJADOS' : 'NORMAIS',
        'NART': item.nart,
        'Descrição': item.description,
        'Identificação': lotLabel,
        'Lote / Ciclo': item.lot,
        'Origem': 'ARMAZÉM 12',
        'Quantidade (kg)': item.systemQty,
        'De -> Para': `De 12 para ${dest.replace('ARMAZÉM ', '')}`,
        'Status': item.transferred ? 'TRANSFERIDO' : 'PENDENTE',
        'Transferido Por': item.transferredBy || '-',
        'Data Transferência': item.transferredAt ? formatDateTime(item.transferredAt) : '-',
        'Pasta': item.folderId,
      });
    }

    // Se houver sobra registrada
    if (item.hasSurplus && item.surplusQty > 0) {
      data.push({
        'Destino': 'SOBRAS',
        'Seção': item.alvejado ? 'ALVEJADOS' : 'NORMAIS',
        'NART': item.nart,
        'Descrição': item.description,
        'Identificação': lotLabel,
        'Lote / Ciclo': item.lot,
        'Origem': 'ARMAZÉM 12',
        'Quantidade (kg)': item.surplusQty,
        'De -> Para': 'De 12 para SOBRAS',
        'Status': item.transferred ? 'TRANSFERIDO' : 'PENDENTE',
        'Transferido Por': item.transferredBy || '-',
        'Data Transferência': item.transferredAt ? formatDateTime(item.transferredAt) : '-',
        'Pasta': item.folderId,
      });
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 16 }, // Destino
    { wch: 14 }, // Seção
    { wch: 16 }, // NART
    { wch: 45 }, // Descrição
    { wch: 14 }, // Identificação
    { wch: 18 }, // Lote / Ciclo
    { wch: 14 }, // Origem
    { wch: 18 }, // Quantidade (kg)
    { wch: 18 }, // De -> Para
    { wch: 16 }, // Status
    { wch: 20 }, // Transferido Por
    { wch: 20 }, // Data Transferência
    { wch: 28 }, // Pasta
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transferências');
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  XLSX.writeFile(workbook, `NEVE_TRANSFERENCIAS_${folderName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${timestamp}.xlsx`);
}

/**
 * Exporta o Mapa de Alvejados em Excel:
 * Contém apenas alvejados, agrupados por NART com total de kg por NART e total geral.
 */
export function exportAlvejadosMapToExcel(items: StockItem[], folderName: string = 'Pasta'): void {
  const alvejados = items.filter((i) => i.alvejado);
  const sorted = [...alvejados].sort((a, b) => a.nart.localeCompare(b.nart));

  const data: any[] = [];
  let grandTotalKg = 0;

  // Agrupamento por NART
  const nartGroups = new Map<string, StockItem[]>();
  for (const it of sorted) {
    const list = nartGroups.get(it.nart) || [];
    list.push(it);
    nartGroups.set(it.nart, list);
  }

  for (const [nart, groupItems] of nartGroups.entries()) {
    let groupKg = 0;

    for (const item of groupItems) {
      let destWarehouse = 'ARMAZÉM 01';
      let destQty = item.physicalQty ?? item.systemQty;

      if (item.allocations && item.allocations.length > 0) {
        destWarehouse = item.allocations.map((a) => a.warehouse).join(' + ');
        destQty = item.allocations.reduce((acc, a) => acc + a.quantity, 0);
      } else if (item.status === 'NAO_ENCONTRADO') {
        destWarehouse = item.type === 'CAMPO' ? 'ARMAZÉM 04' : 'ARMAZÉM 06';
        destQty = item.systemQty;
      }

      groupKg += destQty;
      grandTotalKg += destQty;

      data.push({
        'NART': item.nart,
        'Descrição': item.description,
        'Ciclo(s)': item.lot,
        'Quantidade (kg)': destQty,
        'Armazém Destino': destWarehouse,
        'Status Transferência': item.transferred ? 'TRANSFERIDO' : 'PENDENTE',
        'Transferido Por': item.transferredBy || '-',
        'Data Transferência': item.transferredAt ? formatDateTime(item.transferredAt) : '-',
      });
    }

    // Linha de Subtotal por NART
    data.push({
      'NART': `TOTAL ${nart}`,
      'Descrição': `${groupItems[0].description} (Subtotal)`,
      'Ciclo(s)': `${groupItems.length} lote(s)/ciclo(s)`,
      'Quantidade (kg)': Math.round(groupKg * 100) / 100,
      'Armazém Destino': '---',
      'Status Transferência': '---',
      'Transferido Por': '---',
      'Data Transferência': '---',
    });
  }

  // Linha de Total Geral
  data.push({
    'NART': 'TOTAL GERAL ALVEJADOS',
    'Descrição': 'Soma total de todos os tecidos alvejados',
    'Ciclo(s)': `${alvejados.length} itens no total`,
    'Quantidade (kg)': Math.round(grandTotalKg * 100) / 100,
    'Armazém Destino': '---',
    'Status Transferência': '---',
    'Transferido Por': '---',
    'Data Transferência': '---',
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 22 }, // NART
    { wch: 45 }, // Descrição
    { wch: 24 }, // Ciclo(s)
    { wch: 18 }, // Quantidade (kg)
    { wch: 24 }, // Armazém Destino
    { wch: 20 }, // Status Transferência
    { wch: 20 }, // Transferido Por
    { wch: 20 }, // Data Transferência
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mapa de Alvejados');

  const cleanName = folderName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  XLSX.writeFile(workbook, `NEVE_MAPA_ALVEJADOS_${cleanName}_${timestamp}.xlsx`);
}

/**
 * Lê arquivo Excel ou CSV para importação direta no Catálogo de Tecidos
 * Trata colunas: Cadastro (= NART), Descrição do Material (= Descrição), Tipo (opcional), Alvejado (opcional)
 */
export async function parseCatalogExcelOrCsv(file: File): Promise<CatalogItem[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: false });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (rawMatrix.length < 2) {
    throw new Error('A planilha de catálogo está vazia.');
  }

  const headers = rawMatrix[0].map((c: any) => String(c || '').trim().toUpperCase());
  let nartIdx = headers.findIndex((h) => h === 'CADASTRO' || h.includes('CADASTRO') || h.includes('NART') || h.includes('COD') || h.includes('PRODUTO'));
  let descIdx = headers.findIndex((h) => h.includes('DESCRIÇÃO DO MATERIAL') || h.includes('DESCRICAO DO MATERIAL') || h.includes('DESC') || h.includes('NOME') || h.includes('MATERIAL'));
  let typeIdx = headers.findIndex((h) => h.includes('TIPO'));
  let alvejadoIdx = headers.findIndex((h) => h.includes('ALVEJADO'));

  if (nartIdx === -1) nartIdx = 0;
  if (descIdx === -1) descIdx = 1;

  const catalogItems: CatalogItem[] = [];
  const now = new Date().toISOString();

  for (let i = 1; i < rawMatrix.length; i++) {
    const row = rawMatrix[i];
    if (!row || row.every((c: any) => String(c).trim() === '')) continue;

    const rawNart = String(row[nartIdx] || '').trim();
    const rawDesc = String(row[descIdx] || '').trim();
    if (!rawNart || !rawDesc) continue;

    let resolvedType: 'CAMPO' | 'COMPRESSA';
    if (typeIdx >= 0 && row[typeIdx]) {
      const explicit = String(row[typeIdx]).trim().toUpperCase();
      resolvedType = explicit.includes('COMPRESSA') ? 'COMPRESSA' : 'CAMPO';
    } else {
      const detected = detectMaterialType(rawDesc);
      resolvedType = detected === 'COMPRESSA' ? 'COMPRESSA' : 'CAMPO';
    }

    let isAlv = false;
    if (alvejadoIdx >= 0 && row[alvejadoIdx]) {
      const explicitAlv = String(row[alvejadoIdx]).trim().toUpperCase();
      isAlv = explicitAlv === 'SIM' || explicitAlv === 'TRUE' || explicitAlv === 'S';
    } else {
      isAlv = isDescriptionAlvejado(rawDesc);
    }

    catalogItems.push({
      id: `cat-${rawNart.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      nart: rawNart,
      description: rawDesc,
      type: resolvedType,
      alvejado: isAlv,
      createdAt: now,
      updatedAt: now,
      createdBy: 'Importação Catálogo',
    });
  }

  return catalogItems;
}

/**
 * Exporta os dados consolidados da pasta aberta para arquivo CSV (.csv) com codificação UTF-8 BOM,
 * contendo contagens consolidadas, diferenças encontradas, destinações e status de transferência.
 */
export function exportConsolidatedFolderToCsv(folder: Folder, items: StockItem[]): void {
  const folderItems = items.filter((i) => i.folderId === folder.id);
  const sorted = sortItemsBySectionAndNart(folderItems);

  // Totais e estatísticas consolidadas da pasta
  const totalItems = folderItems.length;
  const checkedItems = folderItems.filter((i) => i.status !== 'PENDENTE').length;
  const pendingItems = totalItems - checkedItems;
  const totalSystemQty = folderItems.reduce((acc, i) => acc + (i.systemQty || 0), 0);
  const totalPhysicalQty = folderItems.reduce(
    (acc, i) => acc + (i.physicalFound ? (i.physicalQty || 0) : 0),
    0
  );

  let totalDiff = 0;
  let itemsWithDiff = 0;
  let total01 = 0;
  let total04 = 0;
  let total06 = 0;
  let totalSobras = 0;
  let transferredCount = 0;
  let transferPendingCount = 0;

  for (const item of folderItems) {
    if (item.transferred) transferredCount++;
    else transferPendingCount++;

    if (item.allocations && item.allocations.length > 0) {
      for (const a of item.allocations) {
        if (a.warehouse === 'ARMAZÉM 01') total01 += a.quantity;
        else if (a.warehouse === 'ARMAZÉM 04') total04 += a.quantity;
        else if (a.warehouse === 'ARMAZÉM 06') total06 += a.quantity;
      }
    } else if (item.status === 'NAO_ENCONTRADO') {
      if (item.type === 'CAMPO') total04 += item.systemQty;
      else total06 += item.systemQty;
    }

    if (item.hasSurplus && item.surplusQty > 0) {
      totalSobras += item.surplusQty;
    }

    if (item.difference !== null && Math.abs(item.difference) > 0.001) {
      itemsWithDiff++;
      totalDiff += item.difference;
    }
  }

  // Montagem do CSV com separador ; (padrão brasileiro) e UTF-8 BOM
  const lines: string[] = [];

  const escapeCsv = (str: any) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const formatNumberBr = (num: number) => {
    return num.toFixed(2).replace('.', ',');
  };

  // Bloco de cabeçalho consolidado
  lines.push(`${escapeCsv('RELATÓRIO CONSOLIDADO DE CONFERÊNCIA EXTERNA - NEVE STOCK')};;;;;;;;;;;;;;;;;;`);
  lines.push(`${escapeCsv('Pasta')};${escapeCsv(folder.name)};;;;;;;;;;;;;;;;;`);
  lines.push(`${escapeCsv('Data de Importação')};${escapeCsv(formatDateTime(folder.createdAt))};${escapeCsv('Operador de Importação')};${escapeCsv(folder.operator)};;;;;;;;;;;;;;`);
  lines.push(`${escapeCsv('Status da Pasta')};${escapeCsv(folder.status)};${escapeCsv('Verificado Por')};${escapeCsv(folder.verifiedBy || 'Não verificado')};${escapeCsv('Data Verificação')};${escapeCsv(folder.verifiedAt ? formatDateTime(folder.verifiedAt) : '-')};;;;;;;;;;;;`);
  lines.push(`${escapeCsv('Total de Materiais')};${totalItems};${escapeCsv('Conferidos')};${checkedItems};${escapeCsv('Pendentes')};${pendingItems};${escapeCsv('Itens com Diferença')};${itemsWithDiff};;;;;;;;;;;`);
  lines.push(`${escapeCsv('Saldo Sistêmico Total (kg)')};${formatNumberBr(totalSystemQty)};${escapeCsv('Total Físico Conferido (kg)')};${formatNumberBr(totalPhysicalQty)};${escapeCsv('Diferença Total (kg)')};${formatNumberBr(totalDiff)};;;;;;;;;;;;;`);
  lines.push(`${escapeCsv('Destino Armazém 01 (kg)')};${formatNumberBr(total01)};${escapeCsv('Destino Armazém 04 (kg)')};${formatNumberBr(total04)};${escapeCsv('Destino Armazém 06 (kg)')};${formatNumberBr(total06)};${escapeCsv('Total em Sobras (kg)')};${formatNumberBr(totalSobras)};;;;;;;;;;;`);
  lines.push(`${escapeCsv('Transferências ERP')};${escapeCsv(`${transferredCount} transferidos | ${transferPendingCount} pendentes`)};;;;;;;;;;;;;;;;;`);
  lines.push(';;;;;;;;;;;;;;;;;;'); // Linha vazia separadora

  // Cabeçalhos das colunas
  const headers = [
    'Seção',
    'NART',
    'Descrição',
    'Identificação',
    'Lote / Ciclo',
    'Origem',
    'Saldo Sistêmico (kg)',
    'Quantidade Física (kg)',
    'Diferença (kg)',
    'Status Conferência',
    'Armazém 01 (kg)',
    'Armazém 04 (kg)',
    'Armazém 06 (kg)',
    'Sobra (kg)',
    'Status Transferência ERP',
    'Transferido Por',
    'Data Transferência',
    'Conferido Por',
    'Data Conferência',
  ];
  lines.push(headers.map(escapeCsv).join(';'));

  // Linhas de dados dos materiais
  for (const item of sorted) {
    const lotLabel = item.alvejado ? 'Ciclo' : 'Lote';
    const sectionLabel = item.alvejado ? 'ALVEJADOS' : 'NORMAIS';

    let physQtyStr = '';
    if (item.status === 'NAO_ENCONTRADO') {
      physQtyStr = '0,00';
    } else if (item.physicalFound !== null && item.physicalQty !== null) {
      physQtyStr = formatNumberBr(item.physicalQty);
    } else {
      physQtyStr = 'PENDENTE';
    }

    let diffStr = '0,00';
    if (item.difference !== null) {
      diffStr = formatNumberBr(item.difference);
    } else if (item.status === 'PENDENTE') {
      diffStr = '-';
    }

    let qty01 = 0;
    let qty04 = 0;
    let qty06 = 0;

    if (item.allocations && item.allocations.length > 0) {
      for (const a of item.allocations) {
        if (a.warehouse === 'ARMAZÉM 01') qty01 += a.quantity;
        else if (a.warehouse === 'ARMAZÉM 04') qty04 += a.quantity;
        else if (a.warehouse === 'ARMAZÉM 06') qty06 += a.quantity;
      }
    } else if (item.status === 'NAO_ENCONTRADO') {
      if (item.type === 'CAMPO') qty04 += item.systemQty;
      else qty06 += item.systemQty;
    }

    const row = [
      sectionLabel,
      item.nart,
      item.description,
      lotLabel,
      item.lot,
      item.originWarehouse || 'ARMAZÉM 12',
      formatNumberBr(item.systemQty),
      physQtyStr,
      diffStr,
      item.status,
      formatNumberBr(qty01),
      formatNumberBr(qty04),
      formatNumberBr(qty06),
      item.hasSurplus && item.surplusQty ? formatNumberBr(item.surplusQty) : '0,00',
      item.transferred ? 'TRANSFERIDO' : 'PENDENTE',
      item.transferredBy || '-',
      item.transferredAt ? formatDateTime(item.transferredAt) : '-',
      item.checkedBy || '-',
      item.checkedAt ? formatDateTime(item.checkedAt) : '-',
    ];

    lines.push(row.map(escapeCsv).join(';'));
  }

  // Gera o arquivo CSV com BOM UTF-8 (\uFEFF) para abrir com acentuação correta no Excel e qualquer leitor
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanName = folder.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  const a = document.createElement('a');
  a.href = url;
  a.download = `CONSOLIDADO_${cleanName}_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

