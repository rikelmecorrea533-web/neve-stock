import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  StockItem,
  CatalogItem,
  HistoryLog,
  ImportPreviewRow,
} from './types/stock';
import {
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
import { OperatorModal } from './components/OperatorModal';
import { ImportModal } from './components/ImportModal';

export default function App() {
  // Operador salvo localmente no aparelho
  const [operator, setOperator] = useState<string>(() => {
    return localStorage.getItem('neve_stock_operator_v2') || '';
  });
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState<boolean>(!operator);

  // Status de rede & sincronização
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

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

  // Inicialização e listeners em tempo real do Firebase
  useEffect(() => {
    testFirestoreConnection();
    seedInitialDataIfEmpty();

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
  }, []);

  // Salvar Operador
  const handleSaveOperator = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem('neve_stock_operator_v2', trimmed);
    setOperator(trimmed);
    setIsOperatorModalOpen(false);
  };

  // Pasta selecionada
  const activeFolder = useMemo(() => {
    if (!activeFolderId) return null;
    return folders.find((f) => f.id === activeFolderId) || null;
  }, [folders, activeFolderId]);

  // Criação de Nova Pasta de Importação
  const handleConfirmImport = async (folderName: string, previewRows: ImportPreviewRow[]) => {
    setIsSyncing(true);
    const now = new Date().toISOString();
    const folderId = `folder-${Date.now()}`;

    const newFolder: Folder = {
      id: folderId,
      name: folderName,
      createdAt: now,
      operator: operator || 'Operador',
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
      systemQty: row.systemQty,
      type: row.type,
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
      updatedAt: now,
    }));

    const log: HistoryLog = {
      id: `log-import-${Date.now()}`,
      timestamp: now,
      operator: operator || 'Operador',
      action: 'IMPORT',
      details: `Importação de "${folderName}" com ${newItems.length} materiais totalizando ${newFolder.totalQty} unidades.`,
      folderId,
    };

    // Atualização otimista
    setFolders((prev) => [newFolder, ...prev]);
    setItems((prev) => [...newItems, ...prev]);

    await saveImportBatch(newFolder, newItems, log);

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

    // Atualização otimista do item
    setItems((prev) => prev.map((i) => (i.id === updatedItem.id ? updatedItem : i)));

    await saveStockItem(updatedItem);

    // Registra log de auditoria
    const log: HistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      operator: operator || 'Operador',
      nart: updatedItem.nart,
      description: updatedItem.description,
      lot: updatedItem.lot,
      action,
      details,
      folderId: updatedItem.folderId,
    };
    await addHistoryLog(log);

    // Atualiza contadores e status dinâmico da pasta
    if (activeFolder) {
      const folderItems = items
        .map((i) => (i.id === updatedItem.id ? updatedItem : i))
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

  // Verificar pasta (Ação da Chefia ao atingir 100%)
  const handleVerifyFolder = async (folderId: string) => {
    setIsSyncing(true);
    await verifyFolder(folderId, operator || 'Operador');
    setIsSyncing(false);
  };

  // Excluir pasta completa em cascata
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    setIsSyncing(true);
    if (activeFolderId === folderId) {
      setActiveFolderId(null);
    }
    await deleteFolderCascade(folderId, folderName, operator || 'Operador');
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
              transferredBy: transferred ? operator : undefined,
              transferredAt: transferred ? new Date().toISOString() : undefined,
            }
          : i
      )
    );
    await toggleItemTransferred(itemId, transferred, operator || 'Operador');
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

  // Determina se estamos na tela inicial (Aba Hoje sem pasta aberta)
  const isHomeScreen = currentTab === 'hoje' && !activeFolder;

  // Título dinâmico para telas secundárias
  const screenTitle = useMemo(() => {
    if (activeFolder) return activeFolder.name;
    if (currentTab === 'hoje') return 'Hoje';
    if (currentTab === 'pastas') return 'Pastas de Importação';
    if (currentTab === 'buscar') return 'Buscar Materiais';
    if (currentTab === 'catalogo') return 'Catálogo de Tecidos';
    if (currentTab === 'historico') return 'Histórico de Auditoria';
    return 'NEVE STOCK';
  }, [activeFolder, currentTab]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans antialiased selection:bg-blue-900 selection:text-white">
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
        onOpenOperatorModal={() => setIsOperatorModalOpen(true)}
        isOnline={isOnline}
        isSyncing={isSyncing}
      />

      {/* Conteúdo Principal com scroll livre */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
        {/* Visualização de Detalhe / Conferência de Pasta */}
        {activeFolder ? (
          <FolderDetailView
            folder={activeFolder}
            items={items}
            operatorName={operator}
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
                  checkedAt: undefined,
                  checkedBy: undefined,
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
        onOpenOperatorModal={() => setIsOperatorModalOpen(true)}
      />

      {/* Modal de Identificação do Operador */}
      <OperatorModal
        isOpen={isOperatorModalOpen}
        currentOperator={operator}
        onSave={handleSaveOperator}
        canClose={!!operator}
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
