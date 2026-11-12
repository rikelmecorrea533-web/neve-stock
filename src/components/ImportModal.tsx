import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ArrowRight,
  Plus,
  Info,
} from 'lucide-react';
import { StockItem, Folder, ImportPreviewRow, CatalogItem, ColumnMapping } from '../types/stock';
import { detectMaterialType } from '../utils/destinationRules';
import { parseExcelOrCsv, buildPreviewRowsFromMapping, ParseResult } from '../utils/excelService';
import { formatTimeAgo } from '../utils/timeAgo';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  operatorName: string;
  catalog: CatalogItem[];
  existingItems: StockItem[];
  onConfirmImport: (folderName: string, items: ImportPreviewRow[], rawFile?: File) => Promise<void>;
  onSaveCatalogItem: (item: CatalogItem) => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  operatorName,
  catalog,
  existingItems,
  onConfirmImport,
  onSaveCatalogItem,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [ignoreCrossFolderDuplicates, setIgnoreCrossFolderDuplicates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal rápido para cadastrar tecido fora do catálogo
  const [quickCatalogRow, setQuickCatalogRow] = useState<ImportPreviewRow | null>(null);
  const [quickDesc, setQuickDesc] = useState('');
  const [quickType, setQuickType] = useState<'CAMPO' | 'COMPRESSA'>('CAMPO');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Processa o arquivo selecionado
  const handleFileSelect = async (selectedFile: File) => {
    // Validação de limite de 5 MB
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande. O limite é 5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);
    try {
      const result = await parseExcelOrCsv(selectedFile, catalog, existingItems);
      setParseResult(result);
      setColumnMapping(result.detectedMapping);
      setPreviewRows(result.rows);
    } catch (err: any) {
      alert(`Erro ao ler a planilha: ${err.message || 'Verifique o formato do arquivo'}`);
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  // Se o operador alterar o mapeamento manual de alguma coluna
  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    if (!parseResult || !columnMapping) return;

    const newMapping: ColumnMapping = {
      ...columnMapping,
      [field]: value,
      method: 'manual',
    };

    setColumnMapping(newMapping);
    const { rows } = buildPreviewRowsFromMapping(
      parseResult.rawMatrix,
      newMapping,
      catalog,
      existingItems
    );
    setPreviewRows(rows);
  };

  // Abre modal rápido para cadastrar descrição de código novo sem descrição
  const handleOpenQuickCatalog = (row: ImportPreviewRow) => {
    setQuickCatalogRow(row);
    setQuickDesc(row.description.includes('(Código novo') || row.description.includes('(Fora do catálogo)') ? '' : row.description);
    const initialType = detectMaterialType(row.description);
    setQuickType(initialType === 'REVISAR' ? 'COMPRESSA' : initialType);
  };

  // Salva no catálogo apenas com a descrição informada (tipo é inferido automaticamente)
  const handleSaveQuickCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCatalogRow || !quickDesc.trim()) return;

    // Regra Neve Medical: Tem CAMPO? CAMPO. Não tem CAMPO? COMPRESSA. Tem ALVEJADO? alvejado = true
    const cleanDesc = quickDesc.trim().toUpperCase();
    const inferredType: 'CAMPO' | 'COMPRESSA' = cleanDesc.includes('CAMPO') ? 'CAMPO' : 'COMPRESSA';
    const inferredAlvejado = cleanDesc.includes('ALVEJADO');

    const newItem: CatalogItem = {
      id: `cat-${quickCatalogRow.nart.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      nart: quickCatalogRow.nart,
      description: cleanDesc,
      type: inferredType,
      alvejado: inferredAlvejado,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: operatorName || 'Operador',
    };

    await onSaveCatalogItem(newItem);

    // Atualiza catálogo local e reprocessa a prévia
    const updatedCatalog = [...catalog, newItem];
    if (parseResult && columnMapping) {
      const { rows } = buildPreviewRowsFromMapping(
        parseResult.rawMatrix,
        columnMapping,
        updatedCatalog,
        existingItems
      );
      setPreviewRows(rows);
    }

    setQuickCatalogRow(null);
  };

  // Submete a importação criando a nova pasta e auto-salvando códigos novos no catálogo
  const handleConfirm = async () => {
    if (previewRows.length === 0) return;

    // Se houver algum código novo pendente de descrição:
    const pendingDesc = previewRows.find((r) => r.needsDescription);
    if (pendingDesc) {
      alert(`O material de código "${pendingDesc.nart}" não veio com descrição na planilha. Por favor, clique em "Informar Descrição" antes de confirmar.`);
      handleOpenQuickCatalog(pendingDesc);
      return;
    }

    setIsSubmitting(true);
    try {
      // Auto-salva códigos novos com descrição no Catálogo do Firestore
      for (const row of previewRows) {
        if (row.isNewCode && row.description && !row.description.includes('(Código novo')) {
          const alreadyInCat = catalog.some((c) => c.nart.trim().toUpperCase() === row.nart.trim().toUpperCase());
          if (!alreadyInCat) {
            const cleanDesc = row.description.trim().toUpperCase();
            const autoType = cleanDesc.includes('CAMPO') ? 'CAMPO' : 'COMPRESSA';
            const autoAlvejado = row.alvejado || cleanDesc.includes('ALVEJADO');
            const catItem: CatalogItem = {
              id: `cat-${row.nart.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
              nart: row.nart,
              description: cleanDesc,
              type: autoType,
              alvejado: autoAlvejado,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: operatorName || 'Auto-importação',
            };
            await onSaveCatalogItem(catItem);
          }
        }
      }

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dataFormatada = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const folderName = `Importação ${dataFormatada} – por ${operatorName || 'Operador'}`;

      // Filtra itens se optou por ignorar duplicatas entre pastas
      const finalItems = ignoreCrossFolderDuplicates
        ? previewRows.filter((r) => !r.alreadyExistsInOtherFolder)
        : previewRows;

      await onConfirmImport(folderName, finalItems, file || undefined);
      onClose();
    } catch (err: any) {
      alert(`Erro ao salvar importação: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const crossFolderDuplicatesCount = previewRows.filter((r) => r.alreadyExistsInOtherFolder).length;
  const notInCatalogCount = previewRows.filter((r) => r.notInCatalog).length;
  const totalSystemQty = previewRows.reduce((acc, r) => acc + (r.systemQty || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-700">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Importar Planilha de Estoque
              </h2>
              <p className="text-xs text-slate-500">
                Armazém 12 (Origem) &bull; Leitura inteligente com IA Gemini
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Seletor de Arquivo */}
          {!parseResult && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-8 text-center bg-blue-50/50 hover:bg-blue-50 transition-all cursor-pointer space-y-3"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
                {isParsing ? (
                  <Sparkles className="w-7 h-7 animate-spin text-blue-600" />
                ) : (
                  <FileSpreadsheet className="w-7 h-7" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {isParsing ? 'Identificando colunas com IA Gemini...' : 'Toque para escolher a planilha (.xlsx ou .csv)'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Ex: Armazem 12 | Produto 79092-50040-01 | Lote 2607010089 | Saldo Lote 423,86
                </p>
              </div>
            </div>
          )}

          {/* Prévia e Mapeamento de Colunas */}
          {parseResult && columnMapping && (
            <div className="space-y-4">
              {/* Barra de Status da IA e Mapeamento */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-800">
                      Mapeamento de Colunas ({columnMapping.method === 'ai' ? 'Identificado pela IA' : 'Heurística Automática'})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setParseResult(null);
                      setFile(null);
                    }}
                    className="text-xs text-blue-700 font-bold hover:underline"
                  >
                    Trocar arquivo
                  </button>
                </div>

                {/* Dropdowns para trocar coluna se necessário */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                      Coluna NART / Código:
                    </label>
                    <select
                      value={columnMapping.nartColumn}
                      onChange={(e) => handleMappingChange('nartColumn', e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      {parseResult.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                      Coluna Lote:
                    </label>
                    <select
                      value={columnMapping.lotColumn}
                      onChange={(e) => handleMappingChange('lotColumn', e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      {parseResult.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                      Coluna Saldo / Qtd:
                    </label>
                    <select
                      value={columnMapping.qtyColumn}
                      onChange={(e) => handleMappingChange('qtyColumn', e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      {parseResult.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Banners de Avisos e Métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 bg-slate-100 rounded-xl">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Itens Válidos</span>
                  <span className="text-base font-black text-slate-900">{previewRows.length} linhas</span>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-xl text-blue-900">
                  <span className="text-blue-600 block text-[10px] font-bold uppercase">Soma dos Saldos</span>
                  <span className="text-base font-black">{totalSystemQty.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</span>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-xl text-amber-900">
                  <span className="text-amber-600 block text-[10px] font-bold uppercase">Duplicatas Somadas</span>
                  <span className="text-base font-black">{parseResult.duplicateMergedCount} no arquivo</span>
                </div>
                <div className="p-2.5 bg-purple-50 rounded-xl text-purple-900">
                  <span className="text-purple-600 block text-[10px] font-bold uppercase">Fora do Catálogo</span>
                  <span className="text-base font-black">{notInCatalogCount} itens</span>
                </div>
              </div>

              {/* Aviso se houver materiais já lançados em outra importação */}
              {crossFolderDuplicatesCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>{crossFolderDuplicatesCount} material(is)</strong> já foram lançados em importações anteriores.
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={ignoreCrossFolderDuplicates}
                      onChange={(e) => setIgnoreCrossFolderDuplicates(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Ignorar os já lançados</span>
                  </label>
                </div>
              )}

              {/* Banner de Conferência Automática com a Célula Original */}
              {parseResult.auditAdjustedCount > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2 text-xs text-emerald-900">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Conferência automática:</strong> {parseResult.auditAdjustedCount} valor(es) conferido(s) e garantido(s) diretamente da célula original da planilha.
                  </span>
                </div>
              )}

              {/* Seção 1: MATERIAIS NORMAIS (Não Alvejados) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                    <span>Materiais Normais ({previewRows.filter((r) => !r.alvejado).length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Soma: {previewRows.filter((r) => !r.alvejado).reduce((s, r) => s + r.systemQty, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">NART</th>
                          <th className="py-2.5 px-3">Descrição (Catálogo)</th>
                          <th className="py-2.5 px-3">Lote</th>
                          <th className="py-2.5 px-3 text-right">Saldo (kg)</th>
                          <th className="py-2.5 px-3 text-center">Tipo</th>
                          <th className="py-2.5 px-3 text-right">Status / Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewRows
                          .filter((r) => !r.alvejado)
                          .map((row, idx) => (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                row.notInCatalog ? 'bg-amber-50/40' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                {row.nart}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate font-medium">
                                {row.description}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-800 whitespace-nowrap">
                                {row.lot}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                                {row.systemQty.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    row.type === 'CAMPO'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-teal-100 text-teal-800'
                                  }`}
                                >
                                  {row.type}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                {row.needsDescription ? (
                                  <button
                                    onClick={() => handleOpenQuickCatalog(row)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Informar Descrição</span>
                                  </button>
                                ) : row.isNewCode ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                    Código novo &bull; {row.type}
                                  </span>
                                ) : row.alreadyExistsInOtherFolder ? (
                                  <span className="text-[10px] text-amber-700 font-bold">
                                    Já em {row.existingFolderInfo?.folderName || 'outra pasta'}
                                  </span>
                                ) : row.isDuplicateInFile ? (
                                  <span className="text-[10px] text-blue-700 font-bold">
                                    Somado ({row.duplicateCountInFile}x)
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-emerald-700 font-bold">✓ Catálogo</span>
                                    {row.auditNotice && (
                                      <span className="text-[9px] text-emerald-600 font-medium" title={row.auditNotice}>
                                        ✓ Célula conferida
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Seção 2: ALVEJADOS (SEMPRE EMBAIXO) */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block"></span>
                    <span>ALVEJADOS – Ciclos ({previewRows.filter((r) => r.alvejado).length})</span>
                  </h4>
                  <span className="text-[11px] text-purple-700 font-bold">
                    Soma: {previewRows.filter((r) => r.alvejado).reduce((s, r) => s + r.systemQty, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                  </span>
                </div>

                <div className="border-2 border-purple-200 bg-purple-50/20 rounded-xl overflow-hidden shadow-xs">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-purple-100 text-purple-950 font-bold sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">NART</th>
                          <th className="py-2.5 px-3">Descrição (Catálogo)</th>
                          <th className="py-2.5 px-3">Ciclo (ou Ciclos)</th>
                          <th className="py-2.5 px-3 text-right">Saldo (kg)</th>
                          <th className="py-2.5 px-3 text-center">Tipo</th>
                          <th className="py-2.5 px-3 text-right">Status / Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100">
                        {previewRows.filter((r) => r.alvejado).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-400">
                              Nenhum tecido alvejado nesta planilha.
                            </td>
                          </tr>
                        ) : (
                          previewRows
                            .filter((r) => r.alvejado)
                            .map((row, idx) => (
                              <tr
                                key={idx}
                                className={`hover:bg-purple-100/40 transition-colors ${
                                  row.notInCatalog ? 'bg-amber-50/40' : ''
                                }`}
                              >
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span>{row.nart}</span>
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-200 text-purple-900">
                                      ALVEJADO
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate font-medium">
                                  {row.description}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-purple-900 whitespace-nowrap">
                                  {row.lot}
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                                  {row.systemQty.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      row.type === 'CAMPO'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-teal-100 text-teal-800'
                                    }`}
                                  >
                                    {row.type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  {row.needsDescription ? (
                                    <button
                                      onClick={() => handleOpenQuickCatalog(row)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Informar Descrição</span>
                                    </button>
                                  ) : row.isNewCode ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 font-bold bg-purple-100 border border-purple-300 px-2 py-0.5 rounded">
                                      Código novo &bull; {row.type}
                                    </span>
                                  ) : row.alreadyExistsInOtherFolder ? (
                                    <span className="text-[10px] text-amber-700 font-bold">
                                      Já em {row.existingFolderInfo?.folderName || 'outra pasta'}
                                    </span>
                                  ) : row.isDuplicateInFile ? (
                                    <span className="text-[10px] text-purple-700 font-bold">
                                      Somado ({row.duplicateCountInFile}x)
                                    </span>
                                  ) : (
                                    <div className="flex flex-col items-end">
                                      <span className="text-[10px] text-emerald-700 font-bold">✓ Catálogo</span>
                                      {row.auditNotice && (
                                        <span className="text-[9px] text-emerald-600 font-medium" title={row.auditNotice}>
                                          ✓ Célula conferida
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com botão de confirmação */}
        {parseResult && (
          <div className="border-t border-slate-200 pt-3 flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handleConfirm}
              disabled={isSubmitting || previewRows.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:bg-slate-300"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'Criando Pasta...' : 'Confirmar e Criar Pasta'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal Rápido de Cadastro no Catálogo */}
      {quickCatalogRow && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Cadastrar no Catálogo de Tecidos
              </h3>
              <button
                onClick={() => setQuickCatalogRow(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCatalog} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  NART
                </label>
                <input
                  type="text"
                  readOnly
                  value={quickCatalogRow.nart}
                  className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-xl font-mono text-xs text-slate-700"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Descrição do Tecido *
                </label>
                <textarea
                  required
                  rows={2}
                  value={quickDesc}
                  onChange={(e) => {
                    setQuickDesc(e.target.value);
                    const upper = e.target.value.toUpperCase();
                    if (upper.includes('COMPRESSA')) setQuickType('COMPRESSA');
                    else if (upper.includes('CAMPO')) setQuickType('CAMPO');
                  }}
                  placeholder="Ex: CAMPO CIRÚRGICO SIMPLES 50X50"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              {/* Tipo identificado automaticamente pela regra Neve (não pede para o operador escolher) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Tipo Automático (Regra Neve Medical):
                </span>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-full ${
                      quickDesc.toUpperCase().includes('CAMPO')
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : 'bg-teal-100 text-teal-900 border border-teal-300'
                    }`}
                  >
                    {quickDesc.toUpperCase().includes('CAMPO') ? 'CAMPO (Diferença no 04)' : 'COMPRESSA (Diferença no 06)'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {quickDesc.toUpperCase().includes('CAMPO') ? 'Palavra CAMPO detectada' : 'Sem palavra CAMPO'}
                  </span>
                </div>
              </div>


              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickCatalogRow(null)}
                  className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl"
                >
                  Gravar no Catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
