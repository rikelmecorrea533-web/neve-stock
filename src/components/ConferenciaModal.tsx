import React, { useState, useEffect } from 'react';
import { StockItem, MaterialType } from '../types/stock';
import {
  computeDestination,
  DestinationResult,
  SurplusDecision,
} from '../utils/destinationRules';
import { formatQuantity, formatKg, formatKgNumber } from '../utils/formatters';
import { parseBrazilianNumber } from '../utils/excelService';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  Warehouse,
  FileText,
  Hash,
  Box,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface ConferenciaModalProps {
  item: StockItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    updatedItem: StockItem,
    actionType: 'CONFERENCIA' | 'DESFAZER',
    logDetails: string
  ) => void;
  operator: string;
}

export const ConferenciaModal: React.FC<ConferenciaModalProps> = ({
  item,
  isOpen,
  onClose,
  onConfirm,
  operator,
}) => {
  if (!isOpen || !item) return null;

  // Estados locais da conferência
  const [found, setFound] = useState<boolean | null>(
    item.physicalFound !== null ? item.physicalFound : true
  );
  const [physicalQty, setPhysicalQty] = useState<number>(
    item.physicalFound !== null ? (item.physicalQty ?? item.systemQty) : item.systemQty
  );
  const [selectedType, setSelectedType] = useState<MaterialType>(item.type);
  const [surplusDecision, setSurplusDecision] = useState<SurplusDecision>(
    item.surplusDecision || 'PENDING_DECISION'
  );

  // Recalcula a sugestão de destinação em tempo real
  const destinationResult: DestinationResult = computeDestination(
    item.systemQty,
    found === true,
    found === true ? physicalQty : 0,
    selectedType,
    surplusDecision
  );

  const isAlreadyChecked = item.status !== 'PENDENTE';

  const handleConfirm = () => {
    if (selectedType === 'REVISAR') {
      alert('Por favor, defina se o material é CAMPO ou COMPRESSA antes de confirmar.');
      return;
    }

    if (found === true && destinationResult.hasSurplus && surplusDecision === 'PENDING_DECISION') {
      alert('A quantidade física é maior que o saldo do sistema (SOBRA). Escolha como deseja destinar a sobra abaixo antes de confirmar.');
      return;
    }

    const updated: StockItem = {
      ...item,
      type: selectedType,
      physicalFound: found,
      physicalQty: found ? physicalQty : 0,
      status: destinationResult.status,
      allocations: destinationResult.allocations,
      difference: destinationResult.difference,
      hasSurplus: destinationResult.hasSurplus,
      surplusQty: destinationResult.surplusQty,
      surplusDecision,
      checkedAt: new Date().toISOString(),
      checkedBy: operator,
      updatedAt: new Date().toISOString(),
    };

    const diffStr =
      destinationResult.difference === 0
        ? 'Bateu 100%'
        : destinationResult.difference < 0
        ? `Falta ${formatKg(Math.abs(destinationResult.difference))}`
        : `Sobra +${formatKg(destinationResult.difference)}`;
    const details = `Tipo: ${selectedType} | Diferença: ${diffStr} | ${destinationResult.summaryText}`;

    onConfirm(updated, 'CONFERENCIA', details);
    onClose();
  };

  const handleUndo = () => {
    if (!window.confirm('Deseja realmente desfazer a conferência deste material e retorná-lo para PENDENTE?')) {
      return;
    }

    const resetItem: StockItem = {
      ...item,
      physicalFound: null,
      physicalQty: 0,
      status: 'PENDENTE',
      allocations: [],
      difference: 0,
      hasSurplus: false,
      surplusQty: 0,
      surplusDecision: 'PENDING_DECISION',
      checkedAt: undefined,
      checkedBy: undefined,
      updatedAt: new Date().toISOString(),
    };

    onConfirm(
      resetItem,
      'DESFAZER',
      `Conferência desfeita por ${operator}. Material retornado para PENDENTE.`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-auto animate-scale-up">
        {/* Cabeçalho do modal */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white p-4 sm:p-5 flex items-start justify-between">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="bg-blue-600/80 text-white text-[11px] font-black px-2 py-0.5 rounded tracking-wider">
                NART {item.nart}
              </span>
              <span className="bg-white/10 text-blue-200 text-[11px] font-semibold px-2 py-0.5 rounded">
                Lote {item.lot}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-400/20">
                Origem: {item.originWarehouse}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold leading-snug text-white line-clamp-2">
              {item.description}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Seletor de Tipo (CAMPO / COMPRESSA) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-700" />
                Tipo do Material
              </label>
              {selectedType === 'REVISAR' && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Revisar tipo
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedType('CAMPO')}
                className={`py-2 px-3 rounded-lg text-xs font-extrabold transition-all border cursor-pointer ${
                  selectedType === 'CAMPO'
                    ? 'bg-blue-900 text-white border-blue-950 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                CAMPO
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('COMPRESSA')}
                className={`py-2 px-3 rounded-lg text-xs font-extrabold transition-all border cursor-pointer ${
                  selectedType === 'COMPRESSA'
                    ? 'bg-blue-900 text-white border-blue-950 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                COMPRESSA
              </button>
            </div>
          </div>

          {/* Saldo Sistêmico */}
          <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 rounded-xl p-3.5">
            <div>
              <span className="text-xs font-semibold text-blue-900 block">Saldo Sistêmico (Sistema)</span>
              <span className="text-2xl font-black text-blue-950 tracking-tight">
                {formatQuantity(item.systemQty)}
              </span>
              <span className="text-xs text-blue-800 ml-1 font-semibold">unidades</span>
            </div>
            <div className="text-right text-xs text-blue-900">
              <span className="block font-bold">Armazém 12</span>
              <span className="text-[11px] opacity-75">Origem obrigatória</span>
            </div>
          </div>

          {/* Pergunta: Encontrado fisicamente? */}
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
              Encontrado fisicamente no estoque?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setFound(true);
                  if (physicalQty === 0) setPhysicalQty(item.systemQty);
                }}
                className={`py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                  found === true
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-4 ring-emerald-100'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>SIM</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFound(false);
                  setPhysicalQty(0);
                }}
                className={`py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                  found === false
                    ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-4 ring-rose-100'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <XCircle className="w-5 h-5" />
                <span>NÃO</span>
              </button>
            </div>
          </div>

          {/* Se SIM: Campo de Quantidade Física */}
          {found === true && (
            <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Quantidade Física Contada (kg)
                </label>
                <span className="text-xs font-bold text-blue-700">
                  {Math.abs(physicalQty - item.systemQty) < 0.005
                    ? '✓ Bate com sistema'
                    : physicalQty < item.systemQty
                    ? `Falta de ${formatKg(item.systemQty - physicalQty)}`
                    : `Sobra de +${formatKg(physicalQty - item.systemQty)}`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={physicalQty === 0 ? '' : formatKgNumber(physicalQty)}
                  onChange={(e) => {
                    const val = parseBrazilianNumber(e.target.value);
                    setPhysicalQty(val);
                    if (val <= item.systemQty) {
                      setSurplusDecision('PENDING_DECISION');
                    }
                  }}
                  placeholder="0,00"
                  className="flex-1 py-3 px-4 text-2xl font-black text-slate-900 bg-white border-2 border-slate-300 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none text-center"
                />
              </div>

              {/* Botões de Atalho Rápido */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setPhysicalQty(item.systemQty)}
                  className="py-2 px-1 text-xs font-bold rounded-lg bg-blue-100 text-blue-900 hover:bg-blue-200 border border-blue-300 cursor-pointer"
                >
                  Total ({formatKgNumber(item.systemQty)})
                </button>
                <button
                  type="button"
                  onClick={() => setPhysicalQty((prev) => Math.max(0, Math.round((prev - 50) * 100) / 100))}
                  className="py-2 px-1 text-xs font-bold rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 cursor-pointer"
                >
                  -50 kg
                </button>
                <button
                  type="button"
                  onClick={() => setPhysicalQty((prev) => Math.max(0, Math.round((prev - 10) * 100) / 100))}
                  className="py-2 px-1 text-xs font-bold rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 cursor-pointer"
                >
                  -10 kg
                </button>
                <button
                  type="button"
                  onClick={() => setPhysicalQty((prev) => Math.round((prev + 10) * 100) / 100)}
                  className="py-2 px-1 text-xs font-bold rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 cursor-pointer"
                >
                  +10 kg
                </button>
              </div>
            </div>
          )}

          {/* Tratamento especial de SOBRA */}
          {found === true && destinationResult.hasSurplus && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-900 font-extrabold text-xs uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Sobra detectada: físico ({formatKg(physicalQty)}) &gt; sistema ({formatKg(item.systemQty)})</span>
              </div>
              <p className="text-xs text-rose-800">
                Selecione como deseja destinar o excedente de +{formatKg(destinationResult.surplusQty)}:
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSurplusDecision('ALL_TO_01')}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    surplusDecision === 'ALL_TO_01'
                      ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                      : 'bg-white text-rose-950 border-rose-200 hover:bg-rose-100/50'
                  }`}
                >
                  ✓ Destinar todas as {formatKg(physicalQty)} para o ARMAZÉM 01 (ajustar saldo)
                </button>

                <button
                  type="button"
                  onClick={() => setSurplusDecision('SYSTEM_TO_01_SURPLUS_FLAG')}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    surplusDecision === 'SYSTEM_TO_01_SURPLUS_FLAG'
                      ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                      : 'bg-white text-rose-950 border-rose-200 hover:bg-rose-100/50'
                  }`}
                >
                  ✓ Destinar {formatKg(item.systemQty)} para ARMAZÉM 01 e isolar sobra (+{formatKg(destinationResult.surplusQty)})
                </button>
              </div>
            </div>
          )}

          {/* Sugestão de Destinação Automática (Preview antes de gravar) */}
          <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-xl p-4 shadow-md space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/15 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <Warehouse className="w-4 h-4 text-blue-400" />
                Sugestão de Destinação Neve
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30">
                {destinationResult.status}
              </span>
            </div>

            <div className="space-y-2">
              {destinationResult.allocations.map((alloc, idx) => (
                <div
                  key={idx}
                  className="bg-white/10 rounded-lg p-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-extrabold text-sm text-white block">
                      {alloc.warehouse}
                    </span>
                    <span className="text-[11px] text-blue-200">{alloc.reason}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-300">
                      {formatQuantity(alloc.quantity)}
                    </span>
                    <span className="text-[10px] text-blue-200 block">unidades</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-blue-200/90 pt-1 leading-snug">
              💡 {destinationResult.summaryText}
            </p>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between gap-2 flex-wrap">
          {isAlreadyChecked ? (
            <button
              type="button"
              onClick={handleUndo}
              className="py-3 px-3.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Desfazer Conferência</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
            >
              Cancelar
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3.5 px-6 rounded-xl text-sm font-extrabold text-white bg-blue-900 hover:bg-blue-800 active:bg-blue-950 shadow-lg shadow-blue-950/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Confirmar Destinação</span>
          </button>
        </div>
      </div>
    </div>
  );
};
