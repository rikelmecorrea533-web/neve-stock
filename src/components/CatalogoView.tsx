import React, { useState, useMemo, useRef } from 'react';
import { CatalogItem } from '../types/stock';
import { Plus, Upload, Search, Trash2, Edit2, AlertTriangle, Check, X, BookOpen, FileSpreadsheet } from 'lucide-react';
import { detectMaterialType } from '../utils/destinationRules';
import { parseCatalogExcelOrCsv } from '../utils/excelService';

interface CatalogoViewProps {
  catalog: CatalogItem[];
  operatorName: string;
  onSaveItem: (item: CatalogItem) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onSaveBatch: (items: CatalogItem[]) => Promise<void>;
}

export const CatalogoView: React.FC<CatalogoViewProps> = ({
  catalog,
  operatorName,
  onSaveItem,
  onDeleteItem,
  onSaveBatch,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CAMPO' | 'COMPRESSA'>('ALL');

  // Modais de Criação/Edição
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [formNart, setFormNart] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<'CAMPO' | 'COMPRESSA'>('CAMPO');
  const [formAlvejado, setFormAlvejado] = useState(false);

  // Modal de Exclusão com Confirmação
  const [itemToDelete, setItemToDelete] = useState<CatalogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Importação de planilha de tecidos
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreviewList, setImportPreviewList] = useState<CatalogItem[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Filtragem
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const matchSearch =
        item.nart.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'ALL' || item.type === filterType;
      return matchSearch && matchType;
    });
  }, [catalog, searchTerm, filterType]);

  // Contagens
  const counts = useMemo(() => {
    let campos = 0;
    let compressas = 0;
    let alvejados = 0;
    catalog.forEach((i) => {
      if (i.type === 'CAMPO') campos++;
      else compressas++;
      if (i.alvejado) alvejados++;
    });
    return { total: catalog.length, campos, compressas, alvejados };
  }, [catalog]);

  // Abre form para adicionar novo
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormNart('');
    setFormDesc('');
    setFormType('CAMPO');
    setFormAlvejado(false);
    setIsFormOpen(true);
  };

  // Abre form para editar
  const handleOpenEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setFormNart(item.nart);
    setFormDesc(item.description);
    setFormType(item.type);
    setFormAlvejado(item.alvejado ?? item.description.toUpperCase().includes('ALVEJAD'));
    setIsFormOpen(true);
  };

  // Ao alterar a descrição, auto-detecta o tipo e alvejado
  const handleDescChange = (val: string) => {
    setFormDesc(val);
    const upper = val.toUpperCase();
    if (upper.includes('COMPRESSA')) {
      setFormType('COMPRESSA');
    } else if (upper.includes('CAMPO')) {
      setFormType('CAMPO');
    }
    if (upper.includes('ALVEJAD')) {
      setFormAlvejado(true);
    }
  };

  // Salva tecido
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNart.trim() || !formDesc.trim()) return;

    const cleanNart = formNart.trim();
    const itemToSave: CatalogItem = {
      id: editingItem ? editingItem.id : `cat-${cleanNart.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      nart: cleanNart,
      description: formDesc.trim().toUpperCase(),
      type: formType,
      alvejado: formAlvejado,
      createdAt: editingItem ? editingItem.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: editingItem ? editingItem.createdBy : operatorName || 'Operador',
    };

    await onSaveItem(itemToSave);
    setIsFormOpen(false);
  };

  // Confirma exclusão
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteItem(itemToDelete.id);
      setItemToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Processa arquivo de importação de catálogo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const items = await parseCatalogExcelOrCsv(file);
      setImportPreviewList(items);
    } catch (err: any) {
      alert(`Erro ao ler arquivo: ${err.message || 'Formato inválido'}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Salva lista importada
  const handleConfirmImport = async () => {
    if (!importPreviewList || importPreviewList.length === 0) return;
    await onSaveBatch(importPreviewList);
    setImportPreviewList(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4 pb-24">
      {/* Topo com título e ações rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-700" />
            <h2 className="text-lg font-bold text-slate-800">Catálogo Fixo de Tecidos</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastro único de NARTs da Neve Medical. O tipo é definido automaticamente pela descrição.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão Importar */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>{isImporting ? 'Lendo...' : 'Importar Lista'}</span>
          </button>

          {/* Botão Novo Tecido */}
          <button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Tecido</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por NART ou descrição..."
            className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs font-semibold">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterType === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({counts.total})
          </button>
          <button
            onClick={() => setFilterType('CAMPO')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterType === 'CAMPO'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Campos ({counts.campos})
          </button>
          <button
            onClick={() => setFilterType('COMPRESSA')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterType === 'COMPRESSA'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Compressas ({counts.compressas})
          </button>
        </div>
      </div>

      {/* Lista / Tabela do Catálogo */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredCatalog.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-500">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-sm">Nenhum tecido encontrado no catálogo</p>
            <p className="text-xs text-slate-400 mt-1">
              Adicione um novo tecido ou importe uma lista (.xlsx / .csv).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">NART</th>
                  <th className="py-3 px-4">Descrição do Tecido</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Alvejado</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCatalog.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {item.nart}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {item.description}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.type === 'CAMPO'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-teal-100 text-teal-800 border border-teal-200'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.alvejado ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-100 text-purple-900 border border-purple-200">
                          ALVEJADO (Ciclo)
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                          Normal (Lote)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Excluir com confirmação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Adicionar / Editar */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingItem ? 'Editar Tecido no Catálogo' : 'Cadastrar Novo Tecido'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NART (Código do Produto) *
                </label>
                <input
                  type="text"
                  required
                  value={formNart}
                  onChange={(e) => setFormNart(e.target.value)}
                  placeholder="Ex: 201045 ou 79092-50040-01"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição Completa *
                </label>
                <textarea
                  required
                  rows={2}
                  value={formDesc}
                  onChange={(e) => handleDescChange(e.target.value)}
                  placeholder="Ex: CAMPO CIRÚRGICO SIMPLES 50X50 CM ESTÉRIL"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Dica: Se a descrição contiver "CAMPO", define CAMPO. Se contiver "COMPRESSA", define COMPRESSA.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo Definido
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('CAMPO')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      formType === 'CAMPO'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    CAMPO
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('COMPRESSA')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      formType === 'COMPRESSA'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    COMPRESSA
                  </button>
                </div>
              </div>

              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-950 block">
                    Tecido Alvejado (Ciclo)
                  </span>
                  <span className="text-[11px] text-purple-700">
                    Muda o campo "Lote" para "Ciclo" e agrupa no Mapa de Alvejados
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formAlvejado}
                  onChange={(e) => setFormAlvejado(e.target.checked)}
                  className="w-5 h-5 rounded border-purple-300 text-purple-700 focus:ring-purple-600 cursor-pointer"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-sm"
                >
                  Salvar no Catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Confirmar Exclusão</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tem certeza que deseja excluir o tecido <strong>{itemToDelete.nart}</strong> ({itemToDelete.description}) do catálogo?
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Prévia de Importação de Catálogo */}
      {importPreviewList && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Prévia da Lista de Tecidos ({importPreviewList.length} itens)
                </h3>
              </div>
              <button
                onClick={() => setImportPreviewList(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Verifique os itens identificados antes de gravar no Catálogo do Firestore:
            </p>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {importPreviewList.map((item, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-slate-900">{item.nart}</span>
                    <p className="text-slate-600 truncate">{item.description}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      item.type === 'CAMPO' ? 'bg-blue-100 text-blue-800' : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {item.type}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setImportPreviewList(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmImport}
                className="flex-1 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-sm"
              >
                Salvar Todos no Catálogo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
