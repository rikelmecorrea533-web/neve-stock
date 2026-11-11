import React from 'react';
import { StockItem } from '../types/stock';
import { formatQuantity } from '../utils/formatters';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export type FilterWarehouse = 'TODOS' | 'ARMAZÉM 01' | 'ARMAZÉM 04' | 'ARMAZÉM 06' | 'PENDENTES' | 'SOBRAS';

interface SummaryCardsProps {
  items: StockItem[];
  activeFilter: FilterWarehouse;
  onSelectFilter: (filter: FilterWarehouse) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  items,
  activeFilter,
  onSelectFilter,
}) => {
  // Cálculos de itens e unidades por armazém e status
  let arm01Items = 0;
  let arm01Qty = 0;

  let arm04Items = 0;
  let arm04Qty = 0;

  let arm06Items = 0;
  let arm06Qty = 0;

  let pendentesItems = 0;
  let pendentesQty = 0;

  let sobrasItems = 0;
  let sobrasQty = 0;

  let conferidosCount = 0;

  for (const item of items) {
    if (item.status === 'PENDENTE') {
      pendentesItems++;
      pendentesQty += item.systemQty;
      continue;
    }

    conferidosCount++;

    if (item.status === 'SOBRA') {
      sobrasItems++;
      sobrasQty += item.surplusQty || ((item.physicalQty ?? 0) - item.systemQty);
    }

    // Calcula alocações
    if (item.allocations && item.allocations.length > 0) {
      for (const alloc of item.allocations) {
        if (alloc.warehouse === 'ARMAZÉM 01') {
          arm01Qty += alloc.quantity;
        } else if (alloc.warehouse === 'ARMAZÉM 04') {
          arm04Qty += alloc.quantity;
        } else if (alloc.warehouse === 'ARMAZÉM 06') {
          arm06Qty += alloc.quantity;
        }
      }
      if (item.allocations.some((a) => a.warehouse === 'ARMAZÉM 01')) arm01Items++;
      if (item.allocations.some((a) => a.warehouse === 'ARMAZÉM 04')) arm04Items++;
      if (item.allocations.some((a) => a.warehouse === 'ARMAZÉM 06')) arm06Items++;
    } else if (item.status === 'NAO_ENCONTRADO') {
      if (item.type === 'CAMPO') {
        arm04Items++;
        arm04Qty += item.systemQty;
      } else {
        arm06Items++;
        arm06Qty += item.systemQty;
      }
    }
  }

  const totalItems = items.length;
  const progressPercent = totalItems > 0 ? Math.round((conferidosCount / totalItems) * 100) : 0;

  const cards = [
    {
      id: 'ARMAZÉM 01' as FilterWarehouse,
      title: 'ARMAZÉM 01',
      subtitle: 'Conferido / Físico OK',
      itemCount: arm01Items,
      totalQty: arm01Qty,
      color: 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:border-emerald-500',
      activeColor: 'ring-2 ring-emerald-600 bg-emerald-100/80 border-emerald-500',
      badgeColor: 'bg-emerald-600 text-white',
      icon: CheckCircle2,
      iconColor: 'text-emerald-700',
    },
    {
      id: 'ARMAZÉM 04' as FilterWarehouse,
      title: 'ARMAZÉM 04',
      subtitle: 'Campos Falta/Não Enc.',
      itemCount: arm04Items,
      totalQty: arm04Qty,
      color: 'bg-amber-50 text-amber-950 border-amber-300 hover:border-amber-500',
      activeColor: 'ring-2 ring-amber-600 bg-amber-100/80 border-amber-500',
      badgeColor: 'bg-amber-600 text-white',
      icon: AlertTriangle,
      iconColor: 'text-amber-700',
    },
    {
      id: 'ARMAZÉM 06' as FilterWarehouse,
      title: 'ARMAZÉM 06',
      subtitle: 'Compressas Falta/Não Enc.',
      itemCount: arm06Items,
      totalQty: arm06Qty,
      color: 'bg-purple-50 text-purple-950 border-purple-300 hover:border-purple-500',
      activeColor: 'ring-2 ring-purple-600 bg-purple-100/80 border-purple-500',
      badgeColor: 'bg-purple-600 text-white',
      icon: Layers,
      iconColor: 'text-purple-700',
    },
    {
      id: 'PENDENTES' as FilterWarehouse,
      title: 'PENDENTES',
      subtitle: 'Aguardando Conferência',
      itemCount: pendentesItems,
      totalQty: pendentesQty,
      color: 'bg-slate-50 text-slate-900 border-slate-300 hover:border-slate-500',
      activeColor: 'ring-2 ring-slate-700 bg-slate-200/80 border-slate-600',
      badgeColor: 'bg-slate-700 text-white',
      icon: Clock,
      iconColor: 'text-slate-600',
    },
    {
      id: 'SOBRAS' as FilterWarehouse,
      title: 'SOBRAS',
      subtitle: 'Físico Maior que Sistema',
      itemCount: sobrasItems,
      totalQty: sobrasQty,
      color: 'bg-rose-50 text-rose-950 border-rose-300 hover:border-rose-500',
      activeColor: 'ring-2 ring-rose-600 bg-rose-100/80 border-rose-500',
      badgeColor: 'bg-rose-600 text-white',
      icon: TrendingUp,
      iconColor: 'text-rose-700',
    },
  ];

  return (
    <div className="w-full space-y-3">
      {/* Barra de Progresso Geral */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-blue-900 font-extrabold uppercase tracking-wide">
              Progresso da Conferência
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600">
              {conferidosCount} de {totalItems} materiais conferidos
            </span>
          </div>
          <span className="text-blue-900 font-black text-sm">{progressPercent}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className="h-full bg-gradient-to-r from-blue-700 to-emerald-500 transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Grid de Cartões de Resumo Interativos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {cards.map((card) => {
          const isSelected = activeFilter === card.id;
          const Icon = card.icon;

          return (
            <button
              key={card.id}
              onClick={() => onSelectFilter(isSelected ? 'TODOS' : card.id)}
              className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between shadow-sm cursor-pointer ${
                card.color
              } ${isSelected ? card.activeColor : ''}`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black tracking-wide">{card.title}</span>
                  <Icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
                <p className="text-[10px] opacity-75 font-medium leading-tight truncate">
                  {card.subtitle}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-black/5 flex items-baseline justify-between">
                <div>
                  <span className="text-lg font-black tracking-tight">
                    {formatQuantity(card.totalQty)}
                  </span>
                  <span className="text-[10px] ml-1 opacity-70 font-semibold">un.</span>
                </div>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${card.badgeColor}`}>
                  {card.itemCount} {card.itemCount === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {isSelected && (
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-900 text-white flex items-center justify-center text-[10px] font-bold shadow">
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Indicador de filtro ativo */}
      {activeFilter !== 'TODOS' && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-900">
          <span>
            Filtrando lista por: <strong>{activeFilter}</strong>
          </span>
          <button
            onClick={() => onSelectFilter('TODOS')}
            className="text-blue-700 font-bold hover:underline cursor-pointer"
          >
            Mostrar todos
          </button>
        </div>
      )}
    </div>
  );
};
