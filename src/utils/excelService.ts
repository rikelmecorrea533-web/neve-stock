import * as XLSX from 'xlsx';
import { StockItem, ImportPreviewRow, MaterialType, CatalogItem, ColumnMapping } from '../types/stock';
import { detectMaterialType, resolveItemType } from './destinationRules';
import { formatDateTime } from './formatters';

export interface ParseResult {
  fileName: string;
  headers: string[];
  sampleRows: any[][];
  rawMatrix: any[][];
  detectedMapping: ColumnMapping;
  rows: ImportPreviewRow[];
  totalRawRows: number;
  duplicateMergedCount: number;
  errorCount: number;
  notInCatalogCount: number;
}

/**
 * Converte valores numéricos no padrão brasileiro ou padrão internacional
 * Ex: "423,86" -> 423.86 | "1.200" -> 1200 | "1.200,50" -> 1200.5 | "7,427.18" -> 7427.18
 */
export function parseBrazilianNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let s = String(val).trim();

  // Caso contenha vírgula E ponto: decide pelo último separador
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Ex: 1.200,50 (ponto milhar, vírgula decimal)
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Ex: 7,427.18 (vírgula milhar, ponto decimal)
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Apenas vírgula: padrão brasileiro de decimal (ex: 423,86)
    s = s.replace(',', '.');
  } else if (s.includes('.')) {
    // Apenas ponto: pode ser milhar brasileiro (1.200) ou decimal (7427.18)
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    }
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Preserva o código de lote exatamente como texto, mantendo zeros à esquerda
 */
export function preserveLotAsString(rawLot: any): string {
  if (rawLot === null || rawLot === undefined) return 'S/L';
  const str = String(rawLot).trim();
  return str.length > 0 ? str : 'S/L';
}

/**
 * Heurística inteligente local para detecção de colunas
 */
export function detectColumnsHeuristic(headers: string[]): ColumnMapping {
  let nartColumn = '';
  let lotColumn = '';
  let qtyColumn = '';
  let warehouseColumn = '';
  let descriptionColumn = '';

  for (const h of headers) {
    const norm = h.trim().toLowerCase();

    // Código: Cadastro, Produto, Código, Codigo, NART, Nart, Cod., etc.
    if (!nartColumn && (
      norm === 'cadastro' || norm.includes('cadastro') ||
      norm === 'produto' || norm === 'código' || norm === 'codigo' ||
      norm === 'nart' || norm === 'cod' || norm.startsWith('cod.') ||
      norm.includes('produto') || norm.includes('nart') || norm.includes('código') || norm.includes('codigo')
    )) {
      nartColumn = h;
    }
    // Lote
    else if (!lotColumn && (norm === 'lote' || norm.includes('lote') || norm === 'batch')) {
      lotColumn = h;
    }
    // Saldo: Saldo, Saldo Lote, Saldo do Lote, Quantidade, Qtd
    else if (!qtyColumn && (
      norm === 'saldo' || norm === 'saldo lote' || norm === 'saldo do lote' ||
      norm === 'quantidade' || norm === 'qtd' || norm.includes('saldo') || norm.includes('quant')
    )) {
      qtyColumn = h;
    }
    // Armazém (12)
    else if (!warehouseColumn && (norm.includes('armaz') || norm.includes('origem') || norm.includes('deposito'))) {
      warehouseColumn = h;
    }
    // Descrição
    else if (!descriptionColumn && (norm.includes('descri') || norm.includes('material') || norm.includes('texto'))) {
      descriptionColumn = h;
    }
  }

  // Fallbacks
  if (!nartColumn && headers.length > 0) nartColumn = headers[0];
  if (!lotColumn && headers.length > 1) lotColumn = headers[1];
  if (!qtyColumn && headers.length > 2) qtyColumn = headers[2];

  return {
    nartColumn,
    lotColumn,
    qtyColumn,
    warehouseColumn: warehouseColumn || undefined,
    descriptionColumn: descriptionColumn || undefined,
    method: 'heuristic',
  };
}

/**
 * Consulta a IA Gemini via endpoint do backend com fallback automático
 */
export async function detectColumnsWithAI(headers: string[], sampleRows: any[][]): Promise<ColumnMapping> {
  try {
    const res = await fetch('/api/gemini/parse-columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, sampleRows }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        nartColumn: data.nartColumn,
        lotColumn: data.lotColumn,
        qtyColumn: data.qtyColumn,
        warehouseColumn: data.warehouseColumn,
        descriptionColumn: data.descriptionColumn,
        confidence: data.confidence || 0.95,
        method: data.method || 'ai',
      };
    }
  } catch (e) {
    console.warn('Falha na requisição da IA Gemini, aplicando fallback heurístico:', e);
  }

  return detectColumnsHeuristic(headers);
}

/**
 * Processa linhas brutas usando um mapeamento de colunas definido e o catálogo de tecidos
 */
export function buildPreviewRowsFromMapping(
  rawMatrix: any[][],
  mapping: ColumnMapping,
  catalog: CatalogItem[],
  existingItems: StockItem[] = []
): {
  rows: ImportPreviewRow[];
  duplicateMergedCount: number;
  errorCount: number;
  notInCatalogCount: number;
} {
  if (rawMatrix.length < 2) {
    return { rows: [], duplicateMergedCount: 0, errorCount: 0, notInCatalogCount: 0 };
  }

  const headers = rawMatrix[0].map((h: any) => String(h || '').trim());
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

  for (let i = 1; i < rawMatrix.length; i++) {
    const row = rawMatrix[i];
    if (!row || row.every((c: any) => String(c).trim() === '')) {
      continue; // Ignora linhas em branco
    }

    const rawNart = String(row[nartIdx] !== undefined ? row[nartIdx] : '').trim();

    // Ignora linhas de total ou sem código
    const nartUpper = rawNart.toUpperCase();
    if (!rawNart || nartUpper.includes('TOTAL') || nartUpper === 'SUBTOTAL') {
      continue;
    }

    const rawLot = preserveLotAsString(row[lotIdx]);
    const parsedQty = parseBrazilianNumber(row[qtyIdx]);
    const rowDesc = descIdx >= 0 && row[descIdx] ? String(row[descIdx]).trim() : '';

    // Cruzamento oficial Neve Medical: tabela dos 13 tecidos e catálogo
    const resolved = resolveItemType(rawNart, rowDesc, catalogMap);
    const notInCatalog = resolved.isNewCode;

    if (notInCatalog) {
      notInCatalogCount++;
    }

    const finalDescription = resolved.description || (rowDesc || `Produto ${rawNart} (Código novo - sem descrição)`);
    const finalType: MaterialType = resolved.type;

    let isValid = true;
    let errorMessage = '';

    if (!rawNart) {
      isValid = false;
      errorMessage = 'Código/NART ausente.';
    } else if (isNaN(parsedQty) || parsedQty < 0) {
      isValid = false;
      errorMessage = `Saldo inválido ("${row[qtyIdx]}").`;
    }

    if (!isValid) {
      errorCount++;
    }

    const key = `${nartUpper}__${rawLot.toUpperCase()}`;

    // Checa se já existe em outra pasta
    const existingMatch = existingItems.find(
      (item) =>
        item.nart.toUpperCase() === nartUpper &&
        item.lot.toUpperCase() === rawLot.toUpperCase()
    );

    if (fileKeyMap.has(key) && isValid) {
      // Mescla duplicatas no mesmo arquivo (soma a quantidade)
      const entry = fileKeyMap.get(key)!;
      entry.row.systemQty += parsedQty;
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
      };

      fileKeyMap.set(key, { row: previewRow, count: 1 });
    }
  }

  const rows = Array.from(fileKeyMap.values()).map((e) => e.row);
  return { rows, duplicateMergedCount, errorCount, notInCatalogCount };
}

/**
 * Lê o arquivo Excel/CSV e invoca a detecção de colunas
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

  const headers = rawMatrix[0].map((cell: any) => String(cell || '').trim());
  const sampleRows = rawMatrix.slice(1, 4);

  // Detecção via IA com fallback
  const detectedMapping = await detectColumnsWithAI(headers, sampleRows);

  const { rows, duplicateMergedCount, errorCount, notInCatalogCount } = buildPreviewRowsFromMapping(
    rawMatrix,
    detectedMapping,
    catalog,
    existingItems
  );

  return {
    fileName: file.name,
    headers,
    sampleRows,
    rawMatrix,
    detectedMapping,
    rows,
    totalRawRows: rawMatrix.length - 1,
    duplicateMergedCount,
    errorCount,
    notInCatalogCount,
  };
}

/**
 * Exporta a lista de materiais conferidos de uma pasta para Excel (.xlsx)
 */
export function exportMaterialsToExcel(items: StockItem[], folderName: string = 'Estoque_Neve'): void {
  const data = items.map((item) => {
    let destinoTexto = 'Pendente';
    if (item.allocations && item.allocations.length > 0) {
      destinoTexto = item.allocations
        .map((a) => `${a.warehouse} (${a.quantity} un)`)
        .join(' + ');
    } else if (item.status === 'NAO_ENCONTRADO') {
      destinoTexto = item.type === 'CAMPO' ? 'ARMAZÉM 04' : 'ARMAZÉM 06';
    }

    return {
      'NART': item.nart,
      'Descrição': item.description,
      'Lote': item.lot,
      'Origem': item.originWarehouse || 'ARMAZÉM 12',
      'Saldo Sistêmico': item.systemQty,
      'Quantidade Física': item.physicalFound === null ? '' : item.physicalQty,
      'Diferença': item.physicalFound === null ? '' : item.difference,
      'Tipo': item.type,
      'Armazém Destino': destinoTexto,
      'Status': item.status,
      'Transferido ERP': item.transferred ? 'SIM' : 'NÃO',
      'Operador Conferente': item.checkedBy || '-',
      'Data Conferência': item.checkedAt ? formatDateTime(item.checkedAt) : '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);

  worksheet['!cols'] = [
    { wch: 14 }, // NART
    { wch: 45 }, // Descrição
    { wch: 16 }, // Lote
    { wch: 14 }, // Origem
    { wch: 16 }, // Saldo Sistêmico
    { wch: 18 }, // Quantidade Física
    { wch: 12 }, // Diferença
    { wch: 14 }, // Tipo
    { wch: 30 }, // Armazém Destino
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
  const data: any[] = [];

  for (const item of items) {
    if (item.allocations && item.allocations.length > 0) {
      for (const alloc of item.allocations) {
        data.push({
          'Destino': alloc.warehouse,
          'NART': item.nart,
          'Descrição': item.description,
          'Lote': item.lot,
          'Origem': 'ARMAZÉM 12',
          'Quantidade': alloc.quantity,
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
        'NART': item.nart,
        'Descrição': item.description,
        'Lote': item.lot,
        'Origem': 'ARMAZÉM 12',
        'Quantidade': item.systemQty,
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
        'NART': item.nart,
        'Descrição': item.description,
        'Lote': item.lot,
        'Origem': 'ARMAZÉM 12',
        'Quantidade': item.surplusQty,
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
    { wch: 16 }, // NART
    { wch: 45 }, // Descrição
    { wch: 16 }, // Lote
    { wch: 14 }, // Origem
    { wch: 16 }, // Quantidade
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
 * Lê arquivo Excel ou CSV para importação direta no Catálogo de Tecidos
 * Trata colunas: Cadastro (= NART), Descrição do Material (= Descrição), Tipo (opcional)
 * Ignora colunas como Família e Saldo em Estoque
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

  if (nartIdx === -1) nartIdx = 0;
  if (descIdx === -1) descIdx = 1;

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

    catalogItems.push({
      id: `cat-${rawNart.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      nart: rawNart,
      description: rawDesc,
      type: resolvedType,
      createdAt: now,
      updatedAt: now,
      createdBy: 'Importação Catálogo',
    });
  }

  return catalogItems;
}
