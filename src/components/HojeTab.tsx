import React, { useMemo } from 'react';
import { 
  Play, 
  CheckCircle2, 
  Folder as FolderIcon, 
  Clock, 
  ArrowRight, 
  Package, 
  ShieldCheck, 
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { Folder, StockItem, HistoryLog } from '../types/stock';
import { formatRelativeTime } from '../utils/formatters';

interface HojeTabProps {
  folders: Folder[];
  items: StockItem[];
  history: HistoryLog[];
  currentOperator: string;
  onContinueConferencia: (folderId: string, itemId: string) => void;
  onOpenFolder: (folderId: string) => void;
}

export const HojeTab: React.FC<HojeTabProps> = ({
  folders,
  items,
  history,
  onContinueConferencia,
  onOpenFolder,
}) => {
  // 1. Identificar o próximo tecido não conferido da pasta mais antiga em aberto
  const nextPendingTarget = useMemo(() => {
    // Pastas abertas (não 100% ou não verificadas) ordenadas da mais antiga para a mais nova (createdAt ASC)
    const sortedOldestFirst = [...folders]
      .filter((f) => f.status !== 'VERIFICADA')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const folder of sortedOldestFirst) {
      const folderItems = items.filter((it) => it.folderId === folder.id);
      const pendingItem = folderItems.find((it) => it.physicalFound === null);
      if (pendingItem) {
        return {
          folder,
          item: pendingItem,
          total: folderItems.length,
          checked: folderItems.filter((it) => it.physicalFound !== null).length,
        };
      }
    }

    return null;
  }, [folders, items]);

  // 2. Pastas pendentes ou em conferência
  const pendingFolders = useMemo(() => {
    return folders.filter((f) => {
      const folderItems = items.filter((it) => it.folderId === f.id);
      const hasUnchecked = folderItems.some((it) => it.physicalFound === null);
      return f.status !== 'VERIFICADA' && (hasUnchecked || folderItems.length === 0);
    });
  }, [folders, items]);

  // 3. Pastas com 100% esperando VERIFICAR
  const readyToVerifyFolders = useMemo(() => {
    return folders.filter((f) => {
      const folderItems = items.filter((it) => it.folderId === f.id);
      const isComplete = folderItems.length > 0 && folderItems.every((it) => it.physicalFound !== null);
      return isComplete && f.status !== 'VERIFICADA';
    });
  }, [folders, items]);

  // 4. Totais do dia calculados a partir dos itens conferidos
  const warehouseTotals = useMemo(() => {
    let armazem01 = 0;
    let armazem04 = 0;
    let armazem06 = 0;
    let sobras = 0;
    let pendingTransferCount = 0;

    for (const item of items) {
      if (item.physicalFound === null) continue; // ainda não conferido

      if (!item.transferred) {
        pendingTransferCount++;
      }

      // Alocações calculadas
      if (item.allocations && item.allocations.length > 0) {
        for (const alloc of item.allocations) {
          if (alloc.warehouse === 'ARMAZÉM 01') armazem01 += alloc.quantity;
          if (alloc.warehouse === 'ARMAZÉM 04') armazem04 += alloc.quantity;
          if (alloc.warehouse === 'ARMAZÉM 06') armazem06 += alloc.quantity;
        }
      } else if (item.status === 'NAO_ENCONTRADO') {
        if (item.type === 'CAMPO') {
          armazem04 += item.systemQty;
        } else {
          armazem06 += item.systemQty;
        }
      }

      if (item.hasSurplus && item.surplusQty > 0) {
        sobras += item.surplusQty;
      }
    }

    return {
      armazem01,
      armazem04,
      armazem06,
      sobras,
      pendingTransferCount,
    };
  }, [items]);

  // 5. Últimas 5 ações do grupo
  const recentActions = useMemo(() => {
    return [...history].slice(0, 5);
  }, [history]);

  return (
    <div className="space-y-5 pb-8 animate-in fade-in duration-200">
      {/* 1. BOTÃO GRANDE CONTINUAR CONFERÊNCIA */}
      <section>
        {nextPendingTarget ? (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a192f] via-[#112d4e] to-[#1e3a8a] p-5 text-white shadow-xl border border-blue-900/50">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Conferência em Aberto
              </span>
              <span className="text-xs text-blue-200 font-medium">
                {nextPendingTarget.checked} de {nextPendingTarget.total} conferidos
              </span>
            </div>

            <div className="mb-4">
              <div className="text-xs text-blue-300 font-mono truncate mb-1">
                {nextPendingTarget.folder.name}
              </div>
              <h2 className="text-xl font-black text-white leading-tight">
                {nextPendingTarget.item.description}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-blue-100 font-bold">
                  NART: {nextPendingTarget.item.nart}
                </span>
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-blue-100">
                  Lote: {nextPendingTarget.item.lot}
                </span>
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-blue-100">
                  Saldo: {nextPendingTarget.item.systemQty} un
                </span>
              </div>
            </div>

            <button
              onClick={() => onContinueConferencia(nextPendingTarget.folder.id, nextPendingTarget.item.id)}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-extrabold text-base shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              CONTINUAR CONFERÊNCIA
              <ArrowRight className="w-5 h-5 ml-auto" />
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-[#0a192f] to-[#1e3a8a] p-6 text-white text-center shadow-lg border border-blue-900/40">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Tudo Conferido no Momento!</h2>
            <p className="text-xs text-blue-200 max-w-xs mx-auto">
              Nenhuma pasta com tecidos pendentes de conferência. Importe uma nova planilha na aba Pastas.
            </p>
          </div>
        )}
      </section>

      {/* 2. PASTAS PENDENTES OU EM CONFERÊNCIA */}
      {pendingFolders.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FolderIcon className="w-4 h-4 text-blue-600" />
              Pastas Pendentes / Em Conferência ({pendingFolders.length})
            </h3>
          </div>

          <div className="space-y-2">
            {pendingFolders.map((folder) => {
              const folderItems = items.filter((it) => it.folderId === folder.id);
              const checkedCount = folderItems.filter((it) => it.physicalFound !== null).length;
              const totalCount = folderItems.length;
              const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

              return (
                <div
                  key={folder.id}
                  onClick={() => onOpenFolder(folder.id)}
                  className="bg-white rounded-xl p-3.5 border border-slate-200/90 hover:border-blue-400 shadow-xs cursor-pointer transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-[#0a192f] truncate">
                        {folder.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatRelativeTime(folder.createdAt)}</span>
                        <span>•</span>
                        <span>por {folder.operator}</span>
                      </div>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                      {checkedCount} de {totalCount} ({pct}%)
                    </span>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. PASTAS COM 100% ESPERANDO VERIFICAR */}
      {readyToVerifyFolders.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              100% Conferidas • Aguardando Verificação ({readyToVerifyFolders.length})
            </h3>
          </div>

          <div className="space-y-2">
            {readyToVerifyFolders.map((folder) => {
              const folderItems = items.filter((it) => it.folderId === folder.id);
              const pendingTransfers = folderItems.filter((it) => !it.transferred).length;

              return (
                <div
                  key={folder.id}
                  className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white">
                        100%
                      </span>
                      <h4 className="font-bold text-sm text-emerald-950 truncate">
                        {folder.name}
                      </h4>
                    </div>
                    <p className="text-xs text-emerald-800 mt-1">
                      {folderItems.length} tecidos conferidos • {pendingTransfers > 0 ? `${pendingTransfers} transferências pendentes` : 'Transferências concluídas'}
                    </p>
                  </div>

                  <button
                    onClick={() => onOpenFolder(folder.id)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    <span>Abrir Pasta</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. CARTÕES COM O TOTAL DO DIA */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-blue-600" />
          Totais do Dia (Destinação de Materiais)
        </h3>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Armazém 01 */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Armazém 01 (OK)
            </div>
            <div className="text-2xl font-black text-slate-900">
              {warehouseTotals.armazem01.toLocaleString('pt-BR')}
              <span className="text-xs font-medium text-slate-400 ml-1">un</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Saldo físico localizado</div>
          </div>

          {/* Armazém 04 (Campos faltantes) */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Armazém 04 (Campo)
            </div>
            <div className="text-2xl font-black text-slate-900">
              {warehouseTotals.armazem04.toLocaleString('pt-BR')}
              <span className="text-xs font-medium text-slate-400 ml-1">un</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Falta de Campos</div>
          </div>

          {/* Armazém 06 (Compressas faltantes) */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Armazém 06 (Compressa)
            </div>
            <div className="text-2xl font-black text-slate-900">
              {warehouseTotals.armazem06.toLocaleString('pt-BR')}
              <span className="text-xs font-medium text-slate-400 ml-1">un</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Falta de Compressas</div>
          </div>

          {/* Sobras */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Sobras
            </div>
            <div className="text-2xl font-black text-slate-900">
              {warehouseTotals.sobras.toLocaleString('pt-BR')}
              <span className="text-xs font-medium text-slate-400 ml-1">un</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Físico &gt; sistêmico</div>
          </div>
        </div>

        {/* Card de Itens Pendentes de Transferência no ERP */}
        <div className="bg-blue-50 border border-blue-200/80 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-950">
                Itens Pendentes de Transferência ERP
              </div>
              <div className="text-[11px] text-blue-700">
                Marcados dentro de cada pasta com 100%
              </div>
            </div>
          </div>
          <span className="text-base font-black text-blue-900 px-2.5 py-0.5 rounded-full bg-blue-100">
            {warehouseTotals.pendingTransferCount}
          </span>
        </div>
      </section>

      {/* 5. ÚLTIMAS 5 AÇÕES DO GRUPO */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-blue-600" />
          Últimas 5 Ações da Equipe
        </h3>

        {recentActions.length === 0 ? (
          <div className="bg-white rounded-xl p-4 text-center text-xs text-slate-400 border border-slate-200">
            Nenhuma ação registrada ainda.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-xs overflow-hidden">
            {recentActions.map((log) => (
              <div key={log.id} className="p-3 text-xs flex items-start gap-2.5 hover:bg-slate-50/50">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-bold text-[#0a192f] truncate">
                      {log.operator}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatRelativeTime(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-600 line-clamp-2">
                    {log.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
