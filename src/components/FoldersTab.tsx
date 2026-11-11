import React, { useState, useEffect } from 'react';
import { Folder, StockItem } from '../types/stock';
import { formatDateTime, formatQuantity } from '../utils/formatters';
import { formatTimeAgo } from '../utils/timeAgo';
import { exportMaterialsToExcel } from '../utils/excelService';
import {
  Folder as FolderIcon,
  FolderOpen,
  Calendar,
  User,
  Download,
  ArrowRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  X,
} from 'lucide-react';

interface FoldersTabProps {
  folders: Folder[];
  items: StockItem[];
  activeFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
  onOpenImportModal: () => void;
  onDeleteFolder: (folderId: string, folderName: string) => Promise<void>;
}

export const FoldersTab: React.FC<FoldersTabProps> = ({
  folders,
  items,
  activeFolderId,
  onSelectFolder,
  onOpenImportModal,
  onDeleteFolder,
}) => {
  // Timer para forçar atualização do texto relativo "há X min" a cada 60 segundos
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Estado para modal de exclusão de pasta
  const [folderToDelete, setFolderToDelete] = useState<{
    folder: Folder;
    itemCount: number;
    isVerified: boolean;
  } | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Ordena da mais nova para a mais antiga
  const sortedFolders = [...folders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleOpenDeleteModal = (folder: Folder, itemCount: number, isVerified: boolean) => {
    setFolderToDelete({ folder, itemCount, isVerified });
    setConfirmationInput('');
  };

  const handleConfirmDelete = async () => {
    if (!folderToDelete) return;
    if (folderToDelete.isVerified && confirmationInput.trim().toUpperCase() !== 'EXCLUIR') {
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteFolder(folderToDelete.folder.id, folderToDelete.folder.name);
      setFolderToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-20">
      {/* Cabeçalho da Aba de Pastas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FolderIcon className="w-5 h-5 text-blue-900" />
            <span>Pastas de Importação</span>
          </h2>
          <p className="text-xs text-slate-500">
            Cada arquivo importado vira uma pasta compartilhada em tempo real com todo o time.
          </p>
        </div>

        <button
          onClick={onOpenImportModal}
          className="py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Importação Excel</span>
        </button>
      </div>

      {/* Lista de Pastas */}
      {sortedFolders.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <FolderIcon className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Nenhuma pasta importada ainda</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Toque no botão "Nova Importação Excel" acima para importar sua primeira planilha (.xlsx ou .csv).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFolders.map((folder) => {
            const isActive = folder.id === activeFolderId;
            const folderItems = items.filter((i) => i.folderId === folder.id);
            const checkedCount = folderItems.filter((i) => i.status !== 'PENDENTE').length;
            const totalUnits = folderItems.reduce((acc, i) => acc + (i.systemQty || 0), 0);
            const is100Percent = folderItems.length > 0 && checkedCount === folderItems.length;
            const isVerified = folder.status === 'VERIFICADA' || !!folder.verifiedAt;

            // Define o status real
            let currentStatus = folder.status;
            if (isVerified) {
              currentStatus = 'VERIFICADA';
            } else if (is100Percent) {
              currentStatus = 'CONFERIDA_100';
            } else if (checkedCount > 0) {
              currentStatus = 'EM_CONFERENCIA';
            } else {
              currentStatus = 'PENDENTE';
            }

            const percent = folderItems.length > 0
              ? Math.round((checkedCount / folderItems.length) * 100)
              : 0;

            return (
              <div
                key={folder.id}
                className={`p-4 rounded-2xl border-2 transition-all bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isActive
                    ? 'border-blue-600 ring-4 ring-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isVerified
                          ? 'bg-emerald-100 text-emerald-800'
                          : is100Percent
                          ? 'bg-lime-100 text-lime-800'
                          : checkedCount > 0
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isVerified ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-700" />
                      ) : is100Percent ? (
                        <CheckCircle2 className="w-5 h-5 text-lime-700" />
                      ) : isActive ? (
                        <FolderOpen className="w-5 h-5" />
                      ) : (
                        <FolderIcon className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug truncate">
                          {folder.name}
                        </h3>

                        {/* Selo Colorido de Status */}
                        {currentStatus === 'VERIFICADA' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-700 text-white shadow-xs">
                            <ShieldCheck className="w-3 h-3" />
                            <span>VERIFICADA</span>
                          </span>
                        ) : currentStatus === 'CONFERIDA_100' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-lime-100 text-lime-900 border border-lime-300">
                            <CheckCircle2 className="w-3 h-3 text-lime-700" />
                            <span>CONFERIDA 100%</span>
                          </span>
                        ) : currentStatus === 'EM_CONFERENCIA' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                            <Clock className="w-3 h-3 text-blue-700" />
                            <span>EM CONFERÊNCIA ({checkedCount}/{folderItems.length})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>PENDENTE</span>
                          </span>
                        )}
                      </div>

                      {/* Informações de tempo e operador */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {formatTimeAgo(folder.createdAt)}
                        </span>
                        <span>•</span>
                        <span>{formatDateTime(folder.createdAt)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <User className="w-3 h-3 text-slate-400" />
                          {folder.operator}
                        </span>
                      </div>

                      {/* Verificado Por (se aplicável) */}
                      {isVerified && folder.verifiedBy && (
                        <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg mt-1.5 inline-flex items-center gap-1">
                          <span>✓ Verificado por {folder.verifiedBy}</span>
                          {folder.verifiedAt && (
                            <span>em {formatDateTime(folder.verifiedAt)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 font-medium mb-1">
                      <span>
                        {checkedCount} de {folderItems.length} itens ({formatQuantity(totalUnits)} un. totais)
                      </span>
                      <span className="font-bold text-slate-800">{percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isVerified
                            ? 'bg-emerald-700'
                            : is100Percent
                            ? 'bg-lime-600'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Ações da Pasta */}
                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* Exportar Excel */}
                  <button
                    type="button"
                    onClick={() => exportMaterialsToExcel(folderItems, folder.name)}
                    title="Exportar esta pasta para Excel"
                    className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {/* Excluir Pasta (com lixeira) */}
                  <button
                    type="button"
                    onClick={() => handleOpenDeleteModal(folder, folderItems.length, isVerified)}
                    title="Excluir pasta com confirmação"
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Abrir Pasta */}
                  <button
                    type="button"
                    onClick={() => onSelectFolder(folder.id)}
                    className="py-2.5 px-4 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all bg-blue-700 hover:bg-blue-800 text-white shadow-sm active:scale-95"
                  >
                    <span>Conferir</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Confirmação de Exclusão de Pasta */}
      {folderToDelete && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="p-2 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Excluir Pasta de Importação</h3>
                <p className="text-xs text-rose-600 font-semibold">Esta ação é irreversível!</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Excluir a pasta <strong>"{folderToDelete.folder.name}"</strong> e as{' '}
              <strong>{folderToDelete.itemCount} conferências</strong> dela? Isso não pode ser desfeito.
            </p>

            {/* Se a pasta for VERIFICADA, exigir digitar 'EXCLUIR' */}
            {folderToDelete.isVerified && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Esta pasta já foi VERIFICADA pela chefia!</span>
                </div>
                <p className="text-xs text-slate-600">
                  Para confirmar a exclusão de uma pasta verificada, digite a palavra{' '}
                  <strong className="text-rose-700">EXCLUIR</strong> abaixo:
                </p>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="Digite EXCLUIR para confirmar"
                  className="w-full px-3 py-2 text-xs border border-rose-300 rounded-lg font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={
                  isDeleting ||
                  (folderToDelete.isVerified && confirmationInput.trim().toUpperCase() !== 'EXCLUIR')
                }
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 rounded-xl shadow-sm transition-all"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir Pasta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
