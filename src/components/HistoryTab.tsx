import React, { useState } from 'react';
import { HistoryLog } from '../types/stock';
import { formatDateTime } from '../utils/formatters';
import { History, Search, User, Filter, Calendar, FileText, ArrowUpDown } from 'lucide-react';

interface HistoryTabProps {
  logs: HistoryLog[];
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('TODOS');
  const [selectedDate, setSelectedDate] = useState('');

  // Lista única de operadores nos logs
  const operators = Array.from(new Set(logs.map((l) => l.operator))).filter(Boolean);

  // Filtros combinados: NART / Material / Ação, Operador, Data
  const filteredLogs = logs.filter((log) => {
    // Filtro por termo (NART, descrição ou lote)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match =
        (log.nart?.toLowerCase().includes(term) ?? false) ||
        (log.description?.toLowerCase().includes(term) ?? false) ||
        (log.lot?.toLowerCase().includes(term) ?? false) ||
        (log.details?.toLowerCase().includes(term) ?? false);
      if (!match) return false;
    }

    // Filtro por operador
    if (selectedOperator !== 'TODOS' && log.operator !== selectedOperator) {
      return false;
    }

    // Filtro por data (YYYY-MM-DD)
    if (selectedDate) {
      const logDate = log.timestamp.slice(0, 10);
      if (logDate !== selectedDate) return false;
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Topo da Aba */}
      <div>
        <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
          <History className="w-5 h-5 text-blue-900" />
          Histórico e Auditoria de Ações
        </h2>
        <p className="text-xs text-slate-500">
          Registro imutável de todas as conferências, importações e destinações
        </p>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Busca por NART ou Material */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por NART, material ou lote..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
          />
        </div>

        {/* Filtro por Operador */}
        <div className="relative">
          <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={selectedOperator}
            onChange={(e) => setSelectedOperator(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none bg-white cursor-pointer font-medium"
          >
            <option value="TODOS">Todos os Operadores</option>
            {operators.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Data */}
        <div className="relative">
          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none bg-white cursor-pointer font-medium"
          />
        </div>
      </div>

      {/* Lista de Registros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Nenhum registro encontrado para os filtros selecionados.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isConferencia = log.action === 'CONFERENCIA';
            const isDesfazer = log.action === 'DESFAZER';
            const isImport = log.action === 'IMPORT';

            return (
              <div key={log.id} className="p-3.5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                        isConferencia
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : isDesfazer
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : isImport
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : 'bg-slate-100 text-slate-800 border border-slate-300'
                      }`}
                    >
                      {log.action}
                    </span>

                    <span className="text-xs font-mono font-bold text-slate-900">
                      NART {log.nart}
                    </span>

                    {log.lot && log.lot !== 'S/L' && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        (Lote: {log.lot})
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-slate-800 leading-snug">
                    {log.description}
                  </p>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/80 leading-relaxed">
                    {log.details}
                  </p>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <span className="text-xs font-black text-slate-800 block">
                    {formatDateTime(log.timestamp)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    <User className="w-3 h-3 text-blue-700" />
                    {log.operator}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
