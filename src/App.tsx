import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  StockItem,
  CatalogItem,
  HistoryLog,
  ImportPreviewRow,
  UserProfile,
} from './types/stock';
import {
  subscribeToAuth,
  logoutUser,
  saveOriginalFileChunks,
  migrateLocalFoldersToFirestore,
  subscribeToFolders,
  subscribeToItems,
  subscribeToCatalog,
  subscribeToHistory,
  saveStockItem,
  deleteStockItem,
  saveFolder,
  verifyFolder,
  deleteFolderCascade,
  saveImportBatch,
  addHistoryLog,
  saveCatalogItem,
  deleteCatalogItem,
  saveCatalogBatch,
  seedInitialDataIfEmpty,
  flushOfflineQueue,
  subscribeToCloudErrors,
  getCachedFolders,
  getCachedItems,
  getCachedCatalog,
  getCachedHistory,
  testFirestoreConnection,
  toggleItemTransferred,
} from './services/firebase';
import { Header } from './components/Header';
import { BottomNav, MainTab } from './components/BottomNav';
import { HojeTab } from './components/HojeTab';
import { FoldersTab } from './components/FoldersTab';
import { FolderDetailView } from './components/FolderDetailView';
import { CatalogoView } from './components/CatalogoView';
import { SearchView } from './components/SearchView';
import { HistoryTab } from './components/HistoryTab';
import { ImportModal } from './components/ImportModal';
import { LoginScreen } from './components/LoginScreen';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { formatKg } from './utils/formatters';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function App() {
  // Autenticação do Usuário por Matrícula
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);

  // Mensagem toast temporária (ex: "X Pastas enviadas para o sistema")
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Status de rede & sincronização & erros de nuvem
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // Dados centrais compartilhados em tempo real via Firestore
  const [folders, setFolders] = useState<Folder[]>(getCachedFolders);
  const [items, setItems] = useState<StockItem[]>(getCachedItems);
  const [catalog, setCatalog] = useState<CatalogItem[]>(getCachedCatalog);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>(getCachedHistory);

  // Navegação principal: 'hoje' (padrão) | 'pastas' | 'buscar' | 'catalogo' | 'historico'
  const [currentTab, setCurrentTab] = useState<MainTab>('hoje');

  // Pasta ativa sendo conferida (null = lista aberta)
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeFolderInitialItemId, setActiveFolderInitialItemId] = useState<string | null>(null);

  // Modal de importação de planilha
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // Listener de Autenticação Firebase
  useEffect(() => {
    const unsubAuth = subscribeToAuth((profile) => {
      setCurrentUser(profile);
      setAuthLoading(false);
    });

    return () => unsubAuth();
  }, []);

  // Monitoramento de erros de sincronização com a nuvem Firestore
  useEffect(() => {
    return subscribeToCloudErrors((err) => {
      setCloudError(err);
    });
  }, []);

  // Inicialização e listeners em tempo real do Firebase quando o usuário estiver autenticado
  useEffect(() => {
    if (!currentUser) return;

    testFirestoreConnection();
    seedInitialDataIfEmpty();
    flushOfflineQueue();

    // Migração automática de pastas salvas apenas no aparelho para o Firestore compartilhado
    migrateLocalFoldersToFirestore(currentUser).then((migratedCount) => {
      if (migratedCount > 0) {
        showToast(`${migratedCount} ${migratedCount === 1 ? 'Pasta enviada' : 'Pastas enviadas'} para o sistema`);
      }
    });

    const unsubFolders = subscribeToFolders(
      (updatedFolders) => {
        setFolders(updatedFolders);
      },
      () => setIsOnline(false)
    );

    const unsubItems = subscribeToItems(
      (updatedItems) => {
        setItems(updatedItems);
      },
      () => setIsOnline(false)
    );

    const unsubCatalog = subscribeToCatalog(
      (updatedCatalog) => {
        setCatalog(updatedCatalog);
      },
      () => setIsOnline(false)
    );

    const unsubHistory = subscribeToHistory(
      (updatedHistory) => {
        setHistoryLogs(updatedHistory);
      },
      () => setIsOnline(false)
    );

    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      await flushOfflineQueue();
      setIsSyncing(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubFolders();
      unsubItems();
      unsubCatalog();
      unsubHistory();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Nome oficial do operador logado: "Nome (Matrícula)"
  const operator = useMemo(() => {
    if (!currentUser) return 'Operador';
    return `${currentUser.nome} (${currentUser.matricula})`;
  }, [currentUser]);

  // Logout do usuário
  const handleLogout = async () => {
    if (window.confirm('Deseja realmente sair da conta deste aparelho?')) {
      await logoutUser();
      setCurrentUser(null);
      setActiveFolderId(null);
      setCurrentTab('hoje');
    }
  };

  // Pasta selecionada
  const activeFolder = useMemo(() => {
    if (!activeFolderId) return null;
    return folders.find((f) => f.id === activeFolderId) || null;
  }, [folders, activeFolderId]);

  // Criação de Nova Pasta de Importação
  const handleConfirmImport = async (
    folderName: string,
    previewRows: ImportPreviewRow[],
    rawFile?: File
  ) => {
    if (!currentUser) return;
    setIsSyncing(true);
    const now = new Date().toISOString();
    const folderId = `folder-${Date.now()}`;

    const newFolder: Folder = {
      id: folderId,
      name: folderName,
      createdAt: now,
      operator: operator,
      operatorMatricula: currentUser.matricula,
      itemCount: previewRows.length,
      totalQty: previewRows.reduce((acc, r) => acc + (r.systemQty || 0), 0),
      checkedCount: 0,
      status: 'PENDENTE',
    };

    const newItems: StockItem[] = previewRows.map((row, idx) => ({
      id: `item-${Date.now()}-${idx + 1}`,
      folderId,
      nart: row.nart,
      description: row.description,
      lot: row.lot,
      cycle: row.alvejado ? row.lot : null,
      systemQty: row.systemQty,
      type: row.type,
      alvejado: !!row.alvejado,
      originWarehouse: 'ARMAZÉM 12',
      physicalFound: null,
      physicalQty: null,
      status: 'PENDENTE',
      allocations: [],
      difference: null,
      hasSurplus: false,
      surplusQty: 0,
      surplusDecision: 'PENDING_DECISION',
      transferred: false,
      transferredBy: null,
      transferredAt: null,
      checkedBy: null,
      checkedByMatricula: null,
      checkedAt: null,
      updatedAt: now,
    }));

    const log: HistoryLog = {
      id: `log-import-${Date.now()}`,
      timestamp: now,
      operator: operator,
      action: 'IMPORT',
      details: `Importação de "${folderName}" com ${newItems.length} materiais totalizando ${formatKg(newFolder.totalQty)}.`,
      folderId,
    };

    // Atualização otimista
    setFolders((prev) => [newFolder, ...prev]);
    setItems((prev) => [...newItems, ...prev]);

    try {
      await saveImportBatch(newFolder, newItems, log);
    } catch (saveErr) {
      console.warn('Erro ao salvar lote no Firestore:', saveErr);
      showToast('Não foi salvo na nuvem, tentando de novo');
    }

    // Salva arquivo original fatiado na subcoleção se fornecido
    if (rawFile) {
      try {
        const fileInfo = await saveOriginalFileChunks(folderId, rawFile, currentUser);
        setFolders((prev) =>
          prev.map((f) => (f.id === folderId ? { ...f, originalFile: fileInfo } : f))
        );
      } catch (err: any) {
        console.warn('Erro ao guardar planilha original:', err);
      }
    }

    // Abre a pasta recém criada para conferência imediata
    setActiveFolderId(folderId);
    setCurrentTab('pastas');
    setIsSyncing(false);
  };

  // Salvar ou Desfazer Conferência de Item
  const handleSaveStockItem = async (
    updatedItem: StockItem,
    action: 'CONFERENCIA' | 'DESFAZER',
    details: string
  ) => {
    setIsSyncing(true);

    const itemToSave: StockItem = {
      ...updatedItem,
      checkedBy: action === 'CONFERENCIA' ? operator : null,
      checkedByMatricula: action === 'CONFERENCIA' ? (currentUser?.matricula || null) : null,
    };

    // Atualização otimista do item
    setItems((prev) => prev.map((i) => (i.id === itemToSave.id ? itemToSave : i)));

    await saveStockItem(itemToSave);

    // Registra log de auditoria
    const log: HistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      operator: operator,
      nart: itemToSave.nart,
      description: itemToSave.description,
      lot: itemToSave.lot,
      action,
      details,
      folderId: itemToSave.folderId,
    };
    await addHistoryLog(log);

    // Atualiza contadores e status dinâmico da pasta
    if (activeFolder) {
      const folderItems = items
        .map((i) => (i.id === itemToSave.id ? itemToSave : i))
        .filter((i) => i.folderId === activeFolder.id);

      const checkedCount = folderItems.filter((i) => i.status !== 'PENDENTE').length;
      const is100 = folderItems.length > 0 && checkedCount === folderItems.length;

      let nextStatus = activeFolder.status;
      if (activeFolder.status !== 'VERIFICADA') {
        if (is100) nextStatus = 'CONFERIDA_100';
        else if (checkedCount > 0) nextStatus = 'EM_CONFERENCIA';
        else nextStatus = 'PENDENTE';
      }

      const updatedFolder: Folder = {
        ...activeFolder,
        checkedCount,
        status: nextStatus,
      };
      await saveFolder(updatedFolder);
    }

    setIsSyncing(false);
  };

  // Verificar pasta (Ação realizada por outro operador ao atingir 100%)
  const handleVerifyFolder = async (folderId: string) => {
    setIsSyncing(true);
    await verifyFolder(folderId, operator);
    setIsSyncing(false);
  };

  // Excluir pasta completa em cascata
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    setIsSyncing(true);
    if (activeFolderId === folderId) {
      setActiveFolderId(null);
    }
    await deleteFolderCascade(folderId, folderName, operator);
    setIsSyncing(false);
  };

  // Marcar/Desmarcar como transferido no ERP (Seção de Transferências da Pasta)
  const handleToggleTransferred = async (itemId: string, transferred: boolean) => {
    setIsSyncing(true);
    // Atualização otimista
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              transferred,
              transferredBy: transferred ? operator : null,
              transferredAt: transferred ? new Date().toISOString() : null,
            }
          : i
      )
    );
    await toggleItemTransferred(itemId, transferred, operator);
    setIsSyncing(false);
  };

  // CRUD do Catálogo de Tecidos
  const handleSaveCatalogItem = async (item: CatalogItem) => {
    setIsSyncing(true);
    await saveCatalogItem(item);
    setIsSyncing(false);
  };

  const handleDeleteCatalogItem = async (itemId: string) => {
    setIsSyncing(true);
    await deleteCatalogItem(itemId);
    setIsSyncing(false);
  };

  const handleSaveCatalogBatch = async (batchItems: CatalogItem[]) => {
    setIsSyncing(true);
    await saveCatalogBatch(batchItems);
    setIsSyncing(false);
  };

  // Se ainda estiver checando o estado de autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
        <p className="text-sm font-semibold tracking-wide">Carregando NEVE STOCK...</p>
      </div>
    );
  }

  // Se NÃO estiver logado: tela bloqueada com Login por Matrícula
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(profile) => setCurrentUser(profile)} />;
  }

  // Determina se estamos na tela inicial (Aba Hoje sem pasta aberta)
  const isHomeScreen = currentTab === 'hoje' && !activeFolder;

  // Título dinâmico para telas secundárias (cálculo simples sem hook)
  const getScreenTitle = (): string => {
    if (activeFolder) return activeFolder.name;
    if (currentTab === 'hoje') return 'Hoje';
    if (currentTab === 'pastas') return 'Pastas de Importação';
    if (currentTab === 'buscar') return 'Buscar Materiais';
    if (currentTab === 'catalogo') return 'Catálogo de Tecidos';
    if (currentTab === 'historico') return 'Histórico de Auditoria';
    return 'NEVE STOCK';
  };
  const screenTitle = getScreenTitle();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans antialiased selection:bg-blue-900 selection:text-white">
      {/* Toast flutuante de notificação */}
      {toastMessage && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-[#0a192f] text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cabeçalho */}
      <Header
        isHome={isHomeScreen}
        screenTitle={screenTitle}
        onBack={
          activeFolder
            ? () => {
                setActiveFolderId(null);
                setActiveFolderInitialItemId(null);
              }
            : currentTab !== 'hoje'
            ? () => setCurrentTab('hoje')
            : undefined
        }
        operatorName={operator}
        onOpenOperatorModal={() => setIsChangePasswordOpen(true)}
        isOnline={isOnline}
        isSyncing={isSyncing}
      />

      {/* Aviso visível de sincronização pendente com a nuvem */}
      {cloudError && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm font-semibold shadow-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-slate-950" />
            <span>{cloudError}</span>
          </div>
          <button
            onClick={async () => {
              setIsSyncing(true);
              try {
                await flushOfflineQueue();
              } finally {
                setIsSyncing(false);
              }
            }}
            className="ml-3 px-3 py-1 bg-slate-950 text-white rounded text-xs font-bold hover:bg-slate-800 transition active:scale-95 shrink-0 cursor-pointer"
          >
            Tentar agora
          </button>
        </div>
      )}

      {/* Conteúdo Principal com scroll livre */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
        {/* Visualização de Detalhe / Conferência de Pasta */}
        {activeFolder ? (
          <FolderDetailView
            folder={activeFolder}
            items={items}
            operatorName={operator}
            currentMatricula={currentUser.matricula}
            initialItemId={activeFolderInitialItemId}
            onBack={() => {
              setActiveFolderId(null);
              setActiveFolderInitialItemId(null);
            }}
            onSaveStockItem={handleSaveStockItem}
            onVerifyFolder={handleVerifyFolder}
            onToggleTransferred={handleToggleTransferred}
            onUndoLastConference={async () => {
              // Desfazer última conferência
              const checked = items
                .filter((i) => i.folderId === activeFolder.id && i.checkedAt)
                .sort((a, b) => new Date(b.checkedAt!).getTime() - new Date(a.checkedAt!).getTime());
              if (checked.length > 0) {
                const target = checked[0];
                const resetItem: StockItem = {
                  ...target,
                  physicalFound: null,
                  physicalQty: 0,
                  status: 'PENDENTE',
                  allocations: [],
                  difference: 0,
                  hasSurplus: false,
                  surplusQty: 0,
                  surplusDecision: 'PENDING_DECISION',
                  checkedAt: null,
                  checkedBy: null,
                  checkedByMatricula: null,
                  updatedAt: new Date().toISOString(),
                };
                await handleSaveStockItem(
                  resetItem,
                  'DESFAZER',
                  `Conferência desfeita por ${operator}.`
                );
              }
            }}
          />
        ) : (
          <>
            {/* Aba 1: Hoje (Painel Inicial de Conferência) */}
            {currentTab === 'hoje' && (
              <div className="px-3 sm:px-6 py-4">
                <HojeTab
                  folders={folders}
                  items={items}
                  history={historyLogs}
                  currentOperator={operator}
                  onContinueConferencia={(folderId, itemId) => {
                    setActiveFolderId(folderId);
                    setActiveFolderInitialItemId(itemId);
                  }}
                  onOpenFolder={(folderId) => {
                    setActiveFolderId(folderId);
                    setActiveFolderInitialItemId(null);
                  }}
                />
              </div>
            )}

            {/* Aba 2: Pastas de Importação */}
            {currentTab === 'pastas' && (
              <div className="px-3 sm:px-6 py-4">
                <FoldersTab
                  folders={folders}
                  items={items}
                  activeFolderId={activeFolderId}
                  onSelectFolder={(id) => {
                    setActiveFolderId(id);
                    setActiveFolderInitialItemId(null);
                  }}
                  onOpenImportModal={() => setIsImportModalOpen(true)}
                  onDeleteFolder={handleDeleteFolder}
                />
              </div>
            )}

            {/* Aba 3: Buscar em Todas as Pastas */}
            {currentTab === 'buscar' && (
              <SearchView
                items={items}
                folders={folders}
                onOpenFolder={(id) => {
                  setActiveFolderId(id);
                  setActiveFolderInitialItemId(null);
                  setCurrentTab('pastas');
                }}
              />
            )}

            {/* Aba 4: Catálogo de Tecidos */}
            {currentTab === 'catalogo' && (
              <CatalogoView
                catalog={catalog}
                operatorName={operator}
                onSaveItem={handleSaveCatalogItem}
                onDeleteItem={handleDeleteCatalogItem}
                onSaveBatch={handleSaveCatalogBatch}
              />
            )}

            {/* Sub-Aba: Histórico de Auditoria */}
            {currentTab === 'historico' && (
              <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 pb-24">
                <HistoryTab logs={historyLogs} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Menu Inferior Fixo de 4 Abas */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setActiveFolderId(null);
          setCurrentTab(tab);
        }}
        currentUser={currentUser}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
      />

      {/* Modal de Troca de Senha */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        matricula={currentUser.matricula}
      />

      {/* Modal de Importação com IA Gemini e Cruzamento com Catálogo */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        operatorName={operator}
        catalog={catalog}
        existingItems={items}
        onConfirmImport={handleConfirmImport}
        onSaveCatalogItem={handleSaveCatalogItem}
      />
    </div>
  );
}
