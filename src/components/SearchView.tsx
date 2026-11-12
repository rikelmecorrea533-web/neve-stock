import React, { useState, useMemo } from 'react';
import { StockItem, Folder } from '../types/stock';
import { Search, Folder as FolderIcon, CheckCircle2, Clock, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { formatDateTime, formatKg } from '../utils/formatters';
import { sortItemsBySectionAndNart } from '../utils/destinationRules';

interface SearchViewProps {
  items: StockItem[];
  folders: Folder[];
  onOpenFolder: (folderId: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  items,
  folders,
  onOpenFolder,
}) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDENTE' | 'CONFERIDO'>('ALL');

  // Mapa de pastas para busca rápida por id
  const folderMap = useMemo(() => {
    const map = new Map<string, Folder>();
    for (const f of folders) {
      map.set(f.id, f);
    }
    return map;
  }, [folders]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matched = items.filter((item) => {
      const matchQuery =
        item.nart.toLowerCase().includes(q) ||
        item.lot.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);

      if (!matchQuery) return false;

      if (statusFilter === 'PENDENTE') {
        return item.status === 'PENDENTE';
      }
      if (statusFilter === 'CONFERIDO') {
        return item.status !== 'PENDENTE';
      }

      return true;
    });

    return sortItemsBySectionAndNart(matched);
  }, [items, query, statusFilter]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 space-y-4 pb-24">
      {/* Barra de Pesquisa */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite NART, Lote ou parte da descrição..."
            className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtros de Status */}
        <div className="flex gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              statusFilter === 'ALL'
                ? 'bg-[#0a192f] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('CONFERIDO')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              statusFilter === 'CONFERIDO'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Apenas Conferidos
          </button>
          <button
            onClick={() => setStatusFilter('PENDENTE')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              statusFilter === 'PENDENTE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Apenas Pendentes
          </button>
        </div>
      </div>

      {/* Resultados */}
      {query.trim() === '' ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">Busca Rápida em Todas as Pastas</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Digite o NART (ex: 201045), o Lote (ex: 2607010089) ou parte da descrição para localizar qualquer material.
          </p>
        </div>
      ) : searchResults.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-800">Nenhum resultado encontrado para "{query}"</p>
          <p className="text-xs text-slate-500 mt-1">Verifique a ortografia do NART ou lote.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-500 px-1">
            Encontrados {searchResults.length} {searchResults.length === 1 ? 'item' : 'itens'}:
          </div>

          <div className="space-y-2">
            {searchResults.map((item) => {
              const folder = folderMap.get(item.folderId);
              const isChecked = item.status !== 'PENDENTE';

              return (
                <div
                  key={item.id}
                  onClick={() => onOpenFolder(item.folderId)}
                  className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {item.nart}
                        </span>
                        {item.alvejado ? (
                          <>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                              ALVEJADO
                            </span>
                            <span className="text-xs font-mono font-bold text-purple-900">
                              Ciclo: {item.lot}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-mono font-medium text-slate-700">
                            Lt: {item.lot}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.type === 'CAMPO' ? 'bg-blue-100 text-blue-800' : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {item.type}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-700 mt-1">
                        {item.description}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                        isChecked
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isChecked ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Conferido</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Pendente</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Informações de Saldo & Pasta */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-2 border-t border-slate-100 gap-2">
                    <div className="flex items-center gap-3 text-slate-600">
                      <span>
                        Saldo Sistêmico: <strong className="text-slate-900">{formatKg(item.systemQty)}</strong>
                      </span>
                      {isChecked && item.physicalQty !== null && (
                        <span>
                          Físico: <strong className="text-emerald-800">{formatKg(item.physicalQty)}</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-blue-700 font-semibold hover:underline">
                      <FolderIcon className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[200px]">
                        {folder ? folder.name : `Pasta ${item.folderId}`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
