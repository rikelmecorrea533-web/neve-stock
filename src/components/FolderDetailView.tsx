import React, { useState, useMemo } from 'react';
import { Folder, StockItem } from '../types/stock';
import {
  computeDestination,
  DestinationResult,
  SurplusDecision,
} from '../utils/destinationRules';
import { exportMaterialsToExcel, exportTransferListToExcel } from '../utils/excelService';
import { formatDateTime, formatQuantity } from '../utils/formatters';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldCheck,
  Download,
  AlertTriangle,
  Clock,
  ArrowRight,
  Warehouse,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';

interface FolderDetailViewProps {
  folder: Folder;
  items: StockItem[];
  operatorName: string;
  initialItemId?: string | null;
  onBack: () => void;
  onSaveStockItem: (
    item: StockItem,
    action: 'CONFERENCIA' | 'DESFAZER',
    details: string
  ) => Promise<void>;
  onVerifyFolder: (folderId: string) => Promise<void>;
  onUndoLastConference: (folderId: string) => Promise<void>;
  onToggleTransferred: (itemId: string, transferred: boolean) => Promise<void>;
}

export const FolderDetailView: React.FC<FolderDetailViewProps> = ({
  folder,
  items,
  operatorName,
  initialItemId,
  onBack,
  onSaveStockItem,
  onVerifyFolder,
  onUndoLastConference,
  onToggleTransferred,
}) => {
  // Itens desta pasta
  const folderItems = useMemo(() => {
    return items.filter((i) => i.folderId === folder.id);
  }, [items, folder.id]);

  // Contagens e status de progresso
  const totalCount = folderItems.length;
  const checkedCount = folderItems.filter((i) => i.physicalFound !== null && i.status !== 'PENDENTE').length;
  const is100Percent = totalCount > 0 && checkedCount === totalCount;
  const isVerified = folder.status === 'VERIFICADA' || !!folder.verifiedAt;
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  // Busca interna na pasta
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PENDENTE' | 'CONFERIDO'>('ALL');

  // Item selecionado para conferência rápida inline / modal
  const [activeItemId, setActiveItemId] = useState<string | null>(initialItemId || null);

  // Filtro de aba na seção de Transferências (quando 100%)
  const [transferFilter, setTransferFilter] = useState<'TODOS' | '01' | '04' | '06' | 'SOBRAS'>('TODOS');

  // Estados do formulário de conferência do item ativo
  const [found, setFound] = useState<boolean | null>(true);
  const [physicalQty, setPhysicalQty] = useState<number>(0);
  const [surplusDecision, setSurplusDecision] = useState<SurplusDecision>('PENDING_DECISION');
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ text: string; type: 'success' | 'alert' } | null>(null);

  // Último item gravado para botão DESFAZER
  const lastCheckedItem = useMemo(() => {
    const checked = folderItems
      .filter((i) => i.checkedAt)
      .sort((a, b) => new Date(b.checkedAt!).getTime() - new Date(a.checkedAt!).getTime());
    return checked[0] || null;
  }, [folderItems]);

  const activeItem = useMemo(() => {
    return folderItems.find((i) => i.id === activeItemId) || null;
  }, [folderItems, activeItemId]);

  // Sincroniza initialItemId caso fornecido
  React.useEffect(() => {
    if (initialItemId) {
      const target = folderItems.find((i) => i.id === initialItemId);
      if (target) {
        handleOpenItem(target);
      }
    }
  }, [initialItemId]);

  // Ao abrir um item para conferir
  const handleOpenItem = (item: StockItem) => {
    setActiveItemId(item.id);
    const initialFound = item.physicalFound !== null ? item.physicalFound : true;
    setFound(initialFound);
    setPhysicalQty(
      item.physicalFound !== null ? (item.physicalQty ?? item.systemQty) : item.systemQty
    );
    setSurplusDecision(item.surplusDecision || 'PENDING_DECISION');
  };

  // Cálculo da destinação instantânea para o item ativo
  const destResult: DestinationResult | null = useMemo(() => {
    if (!activeItem) return null;
    return computeDestination(
      activeItem.systemQty,
      found === true,
      found === true ? physicalQty : 0,
      activeItem.type,
      surplusDecision
    );
  }, [activeItem, found, physicalQty, surplusDecision]);

  // Grava a conferência do item e pula sozinho para o próximo não conferido
  const handleGravar = async () => {
    if (!activeItem || !destResult) return;

    if (found === true && destResult.hasSurplus && surplusDecision === 'PENDING_DECISION') {
      alert('Sobra detectada! Selecione uma opção para a sobra antes de gravar.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedItem: StockItem = {
        ...activeItem,
        physicalFound: found,
        physicalQty: found ? physicalQty : 0,
        status: destResult.status,
        allocations: destResult.allocations,
        difference: destResult.difference,
        hasSurplus: destResult.hasSurplus,
        surplusQty: destResult.surplusQty,
        surplusDecision,
        checkedAt: new Date().toISOString(),
        checkedBy: operatorName || 'Operador',
        updatedAt: new Date().toISOString(),
      };

      const diffStr = destResult.difference === 0 ? 'Bateu 100%' : destResult.difference < 0 ? `Falta ${destResult.difference} un` : `Sobra +${destResult.difference} un`;
      const details = `Tipo: ${activeItem.type} | Diferença: ${diffStr} | ${destResult.summaryText}`;

      await onSaveStockItem(updatedItem, 'CONFERENCIA', details);

      setFeedbackToast({
        text: `✓ ${activeItem.nart} [Tipo: ${activeItem.type}] [Dif: ${diffStr}] ➔ ${destResult.summaryText}`,
        type: destResult.hasSurplus ? 'alert' : 'success',
      });
      setTimeout(() => setFeedbackToast(null), 5000);

      // Avanço automático: busca o próximo não conferido da mesma pasta
      const nextPending = folderItems.find(
        (it) => it.id !== activeItem.id && it.physicalFound === null
      );

      if (nextPending) {
        handleOpenItem(nextPending);
      } else {
        setActiveItemId(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Desfazer última conferência gravada
  const handleUndoLast = async () => {
    if (!lastCheckedItem || isVerified) return;

    if (
      !window.confirm(
        `Desfazer a conferência do material ${lastCheckedItem.nart} (${lastCheckedItem.description}) e retorná-lo para PENDENTE?`
      )
    ) {
      return;
    }

    setIsUndoing(true);
    try {
      const resetItem: StockItem = {
        ...lastCheckedItem,
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

      await onSaveStockItem(
        resetItem,
        'DESFAZER',
        `Conferência de ${lastCheckedItem.nart} desfeita por ${operatorName}.`
      );
    } finally {
      setIsUndoing(false);
    }
  };

  // Botão VERIFICAR (só habilitado em 100%)
  const handleVerificarFolder = async () => {
    if (!is100Percent || isVerified) return;

    if (
      !window.confirm(
        `Confirmar a VERIFICAÇÃO desta pasta como conferida por ${operatorName}?`
      )
    ) {
      return;
    }

    setIsVerifying(true);
    try {
      await onVerifyFolder(folder.id);
    } finally {
      setIsVerifying(false);
    }
  };

  // Itens filtrados para exibição
  const filteredItems = useMemo(() => {
    return folderItems.filter((item) => {
      const matchSearch =
        item.nart.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.lot.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (filterType === 'PENDENTE') return item.status === 'PENDENTE';
      if (filterType === 'CONFERIDO') return item.status !== 'PENDENTE';

      return true;
    });
  }, [folderItems, searchTerm, filterType]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 space-y-4 pb-24">
      {/* Barra de Status e Cabeçalho da Pasta */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">{folder.name}</h2>
              {isVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-700 text-white shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>VERIFICADA</span>
                </span>
              ) : is100Percent ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-lime-100 text-lime-900 border border-lime-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-lime-700" />
                  <span>CONFERIDA 100%</span>
                </span>
              ) : checkedCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                  <Clock className="w-3.5 h-3.5 text-blue-700" />
                  <span>EM CONFERÊNCIA</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>PENDENTE</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Importada por {folder.operator} em {formatDateTime(folder.createdAt)}
            </p>
          </div>

          {/* Botões de Ação no Topo da Pasta */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botão Exportar */}
            <button
              onClick={() => exportMaterialsToExcel(folderItems, folder.name)}
              className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              title="Exportar para Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar</span>
            </button>

            {/* Botão DESFAZER */}
            {!isVerified && lastCheckedItem && (
              <button
                onClick={handleUndoLast}
                disabled={isUndoing}
                className="flex items-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-all"
                title="Desfazer a última conferência realizada"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Desfazer Último</span>
              </button>
            )}

            {/* Botão VERIFICAR (TRAVADO até 100%) */}
            <button
              onClick={handleVerificarFolder}
              disabled={!is100Percent || isVerified || isVerifying}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl transition-all shadow-sm ${
                isVerified
                  ? 'bg-emerald-800 text-white cursor-default'
                  : is100Percent
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              }`}
              title={
                !is100Percent
                  ? 'O botão VERIFICAR só é liberado quando 100% dos materiais estiverem conferidos'
                  : 'Revisar e marcar esta pasta como VERIFICADA'
              }
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {isVerified
                  ? `Verificada por ${folder.verifiedBy || 'Chefia'}`
                  : is100Percent
                  ? 'VERIFICAR PASTA'
                  : `VERIFICAR (${progressPct}%)`}
              </span>
            </button>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Progresso da Conferência</span>
            <span>
              {checkedCount} de {totalCount} itens conferidos ({progressPct}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                isVerified
                  ? 'bg-emerald-700'
                  : is100Percent
                  ? 'bg-lime-600'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Barra de Filtro e Busca interna */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar material nesta pasta..."
            className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
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
            Todos ({totalCount})
          </button>
          <button
            onClick={() => setFilterType('PENDENTE')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterType === 'PENDENTE'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pendentes ({totalCount - checkedCount})
          </button>
          <button
            onClick={() => setFilterType('CONFERIDO')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterType === 'CONFERIDO'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Conferidos ({checkedCount})
          </button>
        </div>
      </div>

      {/* Lista de Materiais da Pasta (Conferência um a um) */}
      <div className="space-y-3">
        {filteredItems.map((item) => {
          const isChecked = item.status !== 'PENDENTE';
          const isExpanded = activeItemId === item.id;

          return (
            <div
              key={item.id}
              className={`rounded-2xl border-2 transition-all bg-white shadow-xs overflow-hidden ${
                isExpanded
                  ? 'border-blue-600 ring-4 ring-blue-50'
                  : isChecked
                  ? 'border-emerald-200 hover:border-emerald-300 bg-emerald-50/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Card Resumo do Material */}
              <div
                onClick={() => handleOpenItem(item)}
                className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      NART {item.nart}
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-600">
                      Lt: {item.lot}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.type === 'CAMPO'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-teal-100 text-teal-800'
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Origem: {item.originWarehouse || 'ARMAZÉM 12'}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-800 leading-snug">
                    {item.description}
                  </h3>

                  {/* Feedback de Destinação se já conferido */}
                  {isChecked && (
                    <div className="pt-1 flex items-center gap-2 flex-wrap text-xs">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>✓ Conferido</span>
                      </span>

                      {item.allocations && item.allocations.length > 0 ? (
                        item.allocations.map((a, i) => (
                          <span
                            key={i}
                            className={`font-bold px-2 py-0.5 rounded ${
                              a.warehouse === 'ARMAZÉM 01'
                                ? 'bg-blue-100 text-blue-900'
                                : a.warehouse === 'ARMAZÉM 04'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-purple-100 text-purple-900'
                            }`}
                          >
                            &rarr; {a.warehouse}: {formatQuantity(a.quantity)} un
                          </span>
                        ))
                      ) : item.status === 'NAO_ENCONTRADO' ? (
                        <span className="font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                          &rarr; Não encontrado &rarr; {item.type === 'CAMPO' ? 'ARMAZÉM 04' : 'ARMAZÉM 06'}
                        </span>
                      ) : null}

                      {item.hasSurplus && (
                        <span className="font-bold bg-rose-100 text-rose-900 px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>SOBRA +{item.surplusQty} un</span>
                        </span>
                      )}

                      {item.checkedBy && (
                        <span className="text-[11px] text-slate-400">
                          • por {item.checkedBy}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Saldos e Botão de Ação */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">
                      Saldo Sistema
                    </span>
                    <span className="text-base font-black text-slate-900">
                      {formatQuantity(item.systemQty)} un
                    </span>
                  </div>

                  {isChecked && item.physicalFound !== null && (
                    <div className="text-left sm:text-right pl-3 border-l border-slate-200">
                      <span className="text-[10px] text-emerald-700 font-bold block uppercase">
                        Físico
                      </span>
                      <span className="text-base font-black text-emerald-800">
                        {formatQuantity(item.physicalQty)} un
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-900 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Painel de Conferência Expandido (Um a um) */}
              {isExpanded && activeItem && (
                <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pergunta: Encontrado fisicamente? */}
                    <div className="space-y-3">
                      <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                        1. Encontrado fisicamente no estoque?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFound(true);
                            if (physicalQty === 0) setPhysicalQty(activeItem.systemQty);
                          }}
                          className={`py-3 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 border-2 transition-all ${
                            found === true
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-200'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>SIM (ENCONTRADO)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFound(false);
                            setPhysicalQty(0);
                          }}
                          className={`py-3 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 border-2 transition-all ${
                            found === false
                              ? 'bg-rose-600 text-white border-rose-700 shadow-sm ring-2 ring-rose-200'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <XCircle className="w-4 h-4" />
                          <span>NÃO (FALTA TOTAL)</span>
                        </button>
                      </div>

                      {/* Se SIM: Quantidade Física */}
                      {found === true && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700">Quantidade Física:</span>
                            <span className="font-bold text-blue-700">
                              {physicalQty === activeItem.systemQty
                                ? '✓ 100% Conferido com sistema'
                                : physicalQty < activeItem.systemQty
                                ? `Falta de ${activeItem.systemQty - physicalQty} un`
                                : `Sobra de +${physicalQty - activeItem.systemQty} un`}
                            </span>
                          </div>

                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={physicalQty === 0 ? '' : physicalQty}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                              setPhysicalQty(val);
                              if (val <= activeItem.systemQty) {
                                setSurplusDecision('PENDING_DECISION');
                              }
                            }}
                            placeholder="0"
                            className="w-full py-2.5 px-3 text-xl font-black text-center bg-white border-2 border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                          />

                          {/* Botões Rápidos */}
                          <div className="grid grid-cols-4 gap-1 pt-1">
                            <button
                              type="button"
                              onClick={() => setPhysicalQty(activeItem.systemQty)}
                              className="py-1.5 text-xs font-bold bg-blue-100 text-blue-900 rounded-lg border border-blue-200 hover:bg-blue-200"
                            >
                              Total ({activeItem.systemQty})
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhysicalQty((p) => Math.max(0, p - 50))}
                              className="py-1.5 text-xs font-bold bg-white text-slate-700 rounded-lg border border-slate-300 hover:bg-slate-100"
                            >
                              -50
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhysicalQty((p) => Math.max(0, p - 10))}
                              className="py-1.5 text-xs font-bold bg-white text-slate-700 rounded-lg border border-slate-300 hover:bg-slate-100"
                            >
                              -10
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhysicalQty((p) => p + 10)}
                              className="py-1.5 text-xs font-bold bg-white text-slate-700 rounded-lg border border-slate-300 hover:bg-slate-100"
                            >
                              +10
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Lado Direito: Feedback Instantâneo da Destinação */}
                    {destResult && (
                      <div className="bg-gradient-to-br from-[#0a192f] via-slate-900 to-[#1e3a8a] text-white p-4 rounded-xl space-y-3 flex flex-col justify-between border border-blue-900/50 shadow-md">
                        <div>
                          {/* Banner com Tipo e Diferença em destaque */}
                          <div className="flex items-center justify-between pb-2 border-b border-white/10 gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Tipo:</span>
                              <span
                                className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                  activeItem.type === 'CAMPO'
                                    ? 'bg-blue-500/30 text-blue-300 border border-blue-400/40'
                                    : 'bg-teal-500/30 text-teal-300 border border-teal-400/40'
                                }`}
                              >
                                {activeItem.type}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs font-bold">
                              <span className="text-[10px] uppercase text-blue-300">Diferença:</span>
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  destResult.difference === 0
                                    ? 'bg-emerald-500/30 text-emerald-300'
                                    : destResult.difference < 0
                                    ? 'bg-amber-500/30 text-amber-300'
                                    : 'bg-purple-500/30 text-purple-300'
                                }`}
                              >
                                {destResult.difference === 0
                                  ? '0 un (Bateu)'
                                  : destResult.difference < 0
                                  ? `${destResult.difference} un (Falta)`
                                  : `+${destResult.difference} un (Sobra)`}
                              </span>
                            </div>
                          </div>

                          {/* Destaque Prominente: 'X vai para o Armazém 0Y' */}
                          <div className="mt-3 p-3 rounded-xl bg-white/10 border border-white/15">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
                              Destinação Calculada Neve Medical:
                            </span>
                            <div className="text-sm sm:text-base font-black text-emerald-300 leading-snug">
                              {destResult.summaryText}
                            </div>
                          </div>

                          {/* Alocações discriminadas */}
                          <div className="space-y-1.5 mt-2.5">
                            {destResult.allocations.map((alloc, idx) => (
                              <div
                                key={idx}
                                className="bg-black/20 rounded-lg p-2 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-bold text-white block">
                                    {alloc.warehouse}
                                  </span>
                                  <span className="text-[10px] text-blue-200">
                                    {alloc.reason}
                                  </span>
                                </div>
                                <span className="text-sm font-black text-emerald-400">
                                  {formatQuantity(alloc.quantity)} un
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Tratamento de Sobra */}
                        {destResult.hasSurplus && (
                          <div className="bg-rose-900/60 border border-rose-500/50 rounded-lg p-2.5 space-y-1.5">
                            <span className="text-xs font-bold text-rose-200 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                              Sobra detectada (+{destResult.surplusQty} un)
                            </span>
                            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setSurplusDecision('ALL_TO_01')}
                                className={`p-1.5 rounded font-bold border ${
                                  surplusDecision === 'ALL_TO_01'
                                    ? 'bg-rose-600 text-white border-rose-400'
                                    : 'bg-white/10 text-rose-200 border-transparent hover:bg-white/20'
                                }`}
                              >
                                Tudo no 01
                              </button>
                              <button
                                type="button"
                                onClick={() => setSurplusDecision('SYSTEM_TO_01_SURPLUS_FLAG')}
                                className={`p-1.5 rounded font-bold border ${
                                  surplusDecision === 'SYSTEM_TO_01_SURPLUS_FLAG'
                                    ? 'bg-rose-600 text-white border-rose-400'
                                    : 'bg-white/10 text-rose-200 border-transparent hover:bg-white/20'
                                }`}
                              >
                                Isolar Sobra
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Botões do Rodapé de Edição do Item */}
                  <div className="flex gap-2 pt-2 border-t border-slate-200 justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveItemId(null)}
                      className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl"
                    >
                      Fechar
                    </button>

                    <button
                      type="button"
                      onClick={handleGravar}
                      disabled={isSaving}
                      className="flex-1 sm:flex-none px-6 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isSaving ? 'Gravando...' : 'GRAVAR CONFERÊNCIA'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toast flutuante de confirmação */}
      {feedbackToast && (
        <div
          className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-xl animate-in slide-in-from-bottom duration-200 ${
            feedbackToast.type === 'alert' ? 'bg-amber-600' : 'bg-[#0a192f] border border-blue-500'
          }`}
        >
          {feedbackToast.text}
        </div>
      )}

      {/* SEÇÃO DE TRANSFERÊNCIAS (APARECE QUANDO A PASTA CHEGA A 100%) */}
      {is100Percent && (
        <section className="mt-8 pt-6 border-t-2 border-slate-200 space-y-4">
          <div className="bg-gradient-to-r from-[#0a192f] to-[#1e3a8a] text-white p-4 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-white">
                  100% CONFERIDO
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Transferências da Pasta
                </h3>
              </div>
              <p className="text-xs text-blue-200 mt-1">
                Materiais agrupados para movimentação no ERP Neve (De 12 para XX). Marque como transferido.
              </p>
            </div>

            <button
              onClick={() => exportTransferListToExcel(folderItems, folder.name)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-black rounded-xl shadow-sm transition-all cursor-pointer self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>
          </div>

          {/* Abas de agrupamento: ARMAZÉM 01, 04, 06 e SOBRAS */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
            <button
              onClick={() => setTransferFilter('TODOS')}
              className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                transferFilter === 'TODOS'
                  ? 'bg-[#0a192f] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Todos os Destinos
            </button>
            <button
              onClick={() => setTransferFilter('01')}
              className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                transferFilter === '01'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              ARMAZÉM 01
            </button>
            <button
              onClick={() => setTransferFilter('04')}
              className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                transferFilter === '04'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              ARMAZÉM 04 (Campo)
            </button>
            <button
              onClick={() => setTransferFilter('06')}
              className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                transferFilter === '06'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
              }`}
            >
              ARMAZÉM 06 (Compressa)
            </button>
            <button
              onClick={() => setTransferFilter('SOBRAS')}
              className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                transferFilter === 'SOBRAS'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-purple-800 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              SOBRAS
            </button>
          </div>

          {/* Lista de Itens de Transferência */}
          <div className="space-y-2.5">
            {(() => {
              // Constrói linhas de transferência individuais baseadas nas alocações e status
              const transferRows: Array<{
                item: StockItem;
                targetWarehouse: string;
                fromTo: string;
                quantity: number;
                badgeColor: string;
              }> = [];

              for (const it of folderItems) {
                if (it.allocations && it.allocations.length > 0) {
                  for (const alloc of it.allocations) {
                    transferRows.push({
                      item: it,
                      targetWarehouse: alloc.warehouse,
                      fromTo: `De 12 para ${alloc.warehouse.replace('ARMAZÉM ', '')}`,
                      quantity: alloc.quantity,
                      badgeColor:
                        alloc.warehouse === 'ARMAZÉM 01'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : alloc.warehouse === 'ARMAZÉM 04'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300',
                    });
                  }
                } else if (it.status === 'NAO_ENCONTRADO') {
                  const dest = it.type === 'CAMPO' ? 'ARMAZÉM 04' : 'ARMAZÉM 06';
                  transferRows.push({
                    item: it,
                    targetWarehouse: dest,
                    fromTo: `De 12 para ${dest.replace('ARMAZÉM ', '')}`,
                    quantity: it.systemQty,
                    badgeColor:
                      dest === 'ARMAZÉM 04'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-rose-100 text-rose-900 border-rose-300',
                  });
                }

                if (it.hasSurplus && it.surplusQty > 0) {
                  transferRows.push({
                    item: it,
                    targetWarehouse: 'SOBRAS',
                    fromTo: 'De 12 para SOBRAS',
                    quantity: it.surplusQty,
                    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
                  });
                }
              }

              // Filtra por aba
              const visibleRows = transferRows.filter((row) => {
                if (transferFilter === 'TODOS') return true;
                if (transferFilter === '01') return row.targetWarehouse === 'ARMAZÉM 01';
                if (transferFilter === '04') return row.targetWarehouse === 'ARMAZÉM 04';
                if (transferFilter === '06') return row.targetWarehouse === 'ARMAZÉM 06';
                if (transferFilter === 'SOBRAS') return row.targetWarehouse === 'SOBRAS';
                return true;
              });

              if (visibleRows.length === 0) {
                return (
                  <div className="bg-white rounded-xl p-6 text-center text-xs text-slate-400 border border-slate-200">
                    Nenhum item nesta destinação.
                  </div>
                );
              }

              return visibleRows.map((row, idx) => {
                const it = row.item;
                const isTransferred = it.transferred === true;

                return (
                  <div
                    key={`${it.id}-${row.targetWarehouse}-${idx}`}
                    className={`bg-white rounded-xl p-3.5 border transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isTransferred ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded border ${row.badgeColor}`}>
                          {row.targetWarehouse}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {row.fromTo}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {it.nart}
                        </span>
                        <span className="font-mono text-xs text-slate-600">
                          Lt: {it.lot}
                        </span>
                      </div>

                      <div className="font-bold text-sm text-slate-800">
                        {it.description}
                      </div>

                      <div className="text-xs text-slate-500">
                        Quantidade a transferir: <strong className="text-slate-900">{formatQuantity(row.quantity)} un</strong>
                      </div>
                    </div>

                    {/* Caixa de seleção 'Transferido' */}
                    <div className="flex items-center sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isTransferred}
                          onChange={(e) => onToggleTransferred(it.id, e.target.checked)}
                          className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="text-left">
                          <span className={`text-xs font-black block ${isTransferred ? 'text-emerald-700' : 'text-slate-700'}`}>
                            {isTransferred ? '✓ Transferido no ERP' : 'Pendente Transferência'}
                          </span>
                          {isTransferred && it.transferredBy && (
                            <span className="text-[10px] text-slate-400 block">
                              por {it.transferredBy} {it.transferredAt ? `• ${formatDateTime(it.transferredAt)}` : ''}
                            </span>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </section>
      )}
    </div>
  );
};
