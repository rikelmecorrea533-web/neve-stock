import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  getDocFromServer,
  query,
  orderBy,
  writeBatch,
  getDocs,
  where,
} from 'firebase/firestore';
import { StockItem, Folder, HistoryLog, CatalogItem } from '../types/stock';
import { INITIAL_CATALOG_ITEMS } from './defaultData';
import firebaseConfig from '../../firebase-applet-config.json';

// Inicialização segura do Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Testa a conexão inicial com o servidor Firestore
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline:', error.message);
    }
    return false;
  }
}

// Storage local para dados offline e fallback instantâneo
const STORAGE_FOLDERS_KEY = 'neve_stock_folders_v2';
const STORAGE_ITEMS_KEY = 'neve_stock_items_v2';
const STORAGE_HISTORY_KEY = 'neve_stock_history_v2';
const STORAGE_CATALOG_KEY = 'neve_stock_catalog_v2';
const STORAGE_SYNC_QUEUE = 'neve_stock_sync_queue_v2';

export function getCachedFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(STORAGE_FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getCachedItems(): StockItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getCachedCatalog(): CatalogItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_CATALOG_KEY);
    return raw ? JSON.parse(raw) : INITIAL_CATALOG_ITEMS;
  } catch {
    return INITIAL_CATALOG_ITEMS;
  }
}

export function getCachedHistory(): HistoryLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Subscrição em tempo real para o Catálogo de Tecidos
export function subscribeToCatalog(
  onUpdate: (items: CatalogItem[]) => void,
  onError?: (err: any) => void
) {
  const q = query(collection(db, 'catalogo'), orderBy('nart', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CatalogItem[] = [];
      snapshot.forEach((d) => {
        items.push({ ...(d.data() as CatalogItem), id: d.id });
      });
      localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(items));
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'catalogo');
      if (onError) onError(err);
    }
  );
}

// Subscrição para Pastas
export function subscribeToFolders(
  onUpdate: (folders: Folder[]) => void,
  onError?: (err: any) => void
) {
  const q = query(collection(db, 'folders'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const folders: Folder[] = [];
      snapshot.forEach((d) => {
        folders.push({ ...(d.data() as Folder), id: d.id });
      });
      localStorage.setItem(STORAGE_FOLDERS_KEY, JSON.stringify(folders));
      onUpdate(folders);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'folders');
      if (onError) onError(err);
    }
  );
}

// Subscrição para Itens de Estoque
export function subscribeToItems(
  onUpdate: (items: StockItem[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, 'items');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: StockItem[] = [];
      snapshot.forEach((d) => {
        items.push({ ...(d.data() as StockItem), id: d.id });
      });
      localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items));
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'items');
      if (onError) onError(err);
    }
  );
}

// Subscrição para Histórico
export function subscribeToHistory(
  onUpdate: (history: HistoryLog[]) => void,
  onError?: (err: any) => void
) {
  const q = query(collection(db, 'history'), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs: HistoryLog[] = [];
      snapshot.forEach((d) => {
        logs.push({ ...(d.data() as HistoryLog), id: d.id });
      });
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(logs));
      onUpdate(logs);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'history');
      if (onError) onError(err);
    }
  );
}

// Inicializa o Catálogo de Tecidos com os 13 tecidos oficiais da Neve Medical e limpa antigos
export async function seedInitialDataIfEmpty(): Promise<void> {
  try {
    const catalogSnap = await getDocs(collection(db, 'catalogo'));
    const officialNarts = new Set(INITIAL_CATALOG_ITEMS.map((item) => item.nart));

    const batch = writeBatch(db);
    let changesCount = 0;

    // Remove tecidos antigos que não fazem parte do catálogo oficial dos 13 tecidos
    catalogSnap.forEach((d) => {
      const data = d.data();
      const nart = String(data.nart || '');
      if (!officialNarts.has(nart)) {
        batch.delete(d.ref);
        changesCount++;
      }
    });

    // Garante que os 13 tecidos oficiais estejam cadastrados com descrição e tipo exatos
    for (const item of INITIAL_CATALOG_ITEMS) {
      batch.set(doc(db, 'catalogo', item.id), item, { merge: true });
      changesCount++;
    }

    if (changesCount > 0) {
      await batch.commit();
      console.log('Catálogo oficial Neve Medical sincronizado com os 13 tecidos oficiais!');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'catalogo/seed');
  }
}

// Salva item no catálogo
export async function saveCatalogItem(item: CatalogItem): Promise<void> {
  const itemRef = doc(db, 'catalogo', item.id);
  try {
    await setDoc(itemRef, item, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `catalogo/${item.id}`);
    queueOfflineMutation('SAVE_CATALOG_ITEM', item);
  }
}

// Salva lista de itens no catálogo em batch
export async function saveCatalogBatch(items: CatalogItem[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const item of items) {
      batch.set(doc(db, 'catalogo', item.id), item, { merge: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'catalogo/batch');
    queueOfflineMutation('SAVE_CATALOG_BATCH', items);
  }
}

// Exclui item do catálogo
export async function deleteCatalogItem(itemId: string): Promise<void> {
  const itemRef = doc(db, 'catalogo', itemId);
  try {
    await deleteDoc(itemRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `catalogo/${itemId}`);
    queueOfflineMutation('DELETE_CATALOG_ITEM', { id: itemId });
  }
}

// Salva item de conferência
export async function saveStockItem(item: StockItem): Promise<void> {
  const itemRef = doc(db, 'items', item.id);
  try {
    await setDoc(itemRef, item, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `items/${item.id}`);
    queueOfflineMutation('SAVE_ITEM', item);
  }
}

// Marca/desmarca item como transferido no sistema ERP da Neve Medical
export async function toggleItemTransferred(
  itemId: string,
  transferred: boolean,
  operatorName: string
): Promise<void> {
  const itemRef = doc(db, 'items', itemId);
  const patch = {
    transferred,
    transferredBy: transferred ? operatorName : null,
    transferredAt: transferred ? new Date().toISOString() : null,
  };
  try {
    await updateDoc(itemRef, patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `items/${itemId}`);
    queueOfflineMutation('TOGGLE_TRANSFERRED', { id: itemId, ...patch });
  }
}

// Exclui item de estoque individual
export async function deleteStockItem(itemId: string): Promise<void> {
  const itemRef = doc(db, 'items', itemId);
  try {
    await deleteDoc(itemRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `items/${itemId}`);
    queueOfflineMutation('DELETE_ITEM', { id: itemId });
  }
}

// Salva ou atualiza pasta
export async function saveFolder(folder: Folder): Promise<void> {
  const folderRef = doc(db, 'folders', folder.id);
  try {
    await setDoc(folderRef, folder, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `folders/${folder.id}`);
    queueOfflineMutation('SAVE_FOLDER', folder);
  }
}

// Marca pasta como verificada (requer 100% dos itens conferidos)
export async function verifyFolder(folderId: string, operatorName: string): Promise<void> {
  const folderRef = doc(db, 'folders', folderId);
  const now = new Date().toISOString();
  const patch = {
    status: 'VERIFICADA',
    verifiedBy: operatorName,
    verifiedAt: now,
  };

  const log: HistoryLog = {
    id: `log-verify-${Date.now()}`,
    timestamp: now,
    operator: operatorName,
    action: 'VERIFICAR_PASTA',
    details: `Pasta ${folderId} marcada como VERIFICADA por ${operatorName}.`,
    folderId,
  };

  try {
    const batch = writeBatch(db);
    batch.update(folderRef, patch);
    batch.set(doc(db, 'history', log.id), log);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `folders/${folderId}/verify`);
    queueOfflineMutation('VERIFY_FOLDER', { folderId, patch, log });
  }
}

// Exclusão completa de pasta em cascata (apaga a pasta e todos os seus itens)
export async function deleteFolderCascade(
  folderId: string,
  folderName: string,
  operatorName: string
): Promise<void> {
  try {
    // Busca itens pertencentes à pasta
    const itemsQuery = query(collection(db, 'items'), where('folderId', '==', folderId));
    const itemsSnap = await getDocs(itemsQuery);

    const batch = writeBatch(db);
    // Remove doc da pasta
    batch.delete(doc(db, 'folders', folderId));

    // Remove todos os itens associados
    itemsSnap.forEach((d) => {
      batch.delete(d.ref);
    });

    // Registra log da exclusão no histórico
    const log: HistoryLog = {
      id: `log-del-folder-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operator: operatorName,
      action: 'EXCLUIR_PASTA',
      details: `Pasta "${folderName}" e suas ${itemsSnap.size} conferências foram excluídas por ${operatorName}.`,
      folderId,
    };
    batch.set(doc(db, 'history', log.id), log);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `folders/${folderId}/cascade`);
    queueOfflineMutation('DELETE_FOLDER_CASCADE', { folderId, folderName, operatorName });
  }
}

// Salva importação de lote inteiro (pasta + itens + log)
export async function saveImportBatch(folder: Folder, items: StockItem[], log: HistoryLog): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'folders', folder.id), folder);

    for (const item of items) {
      batch.set(doc(db, 'items', item.id), item);
    }

    batch.set(doc(db, 'history', log.id), log);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'folders/batch');
    queueOfflineMutation('SAVE_BATCH', { folder, items, log });
  }
}

// Registra auditoria no histórico
export async function addHistoryLog(log: HistoryLog): Promise<void> {
  const logRef = doc(db, 'history', log.id);
  try {
    await setDoc(logRef, log);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `history/${log.id}`);
    queueOfflineMutation('ADD_HISTORY', log);
  }
}

function queueOfflineMutation(type: string, payload: any) {
  try {
    const queue = JSON.parse(localStorage.getItem(STORAGE_SYNC_QUEUE) || '[]');
    queue.push({ type, payload, timestamp: Date.now() });
    localStorage.setItem(STORAGE_SYNC_QUEUE, JSON.stringify(queue));
  } catch (e) {
    console.error('Erro ao salvar na fila offline:', e);
  }
}

export async function flushOfflineQueue(onProgress?: (count: number) => void): Promise<number> {
  try {
    const raw = localStorage.getItem(STORAGE_SYNC_QUEUE);
    if (!raw) return 0;
    const queue = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) return 0;

    let processed = 0;
    for (const task of queue) {
      if (task.type === 'SAVE_ITEM') {
        await setDoc(doc(db, 'items', task.payload.id), task.payload, { merge: true });
      } else if (task.type === 'DELETE_ITEM') {
        await deleteDoc(doc(db, 'items', task.payload.id));
      } else if (task.type === 'SAVE_FOLDER') {
        await setDoc(doc(db, 'folders', task.payload.id), task.payload, { merge: true });
      } else if (task.type === 'ADD_HISTORY') {
        await setDoc(doc(db, 'history', task.payload.id), task.payload);
      } else if (task.type === 'SAVE_CATALOG_ITEM') {
        await setDoc(doc(db, 'catalogo', task.payload.id), task.payload, { merge: true });
      } else if (task.type === 'DELETE_CATALOG_ITEM') {
        await deleteDoc(doc(db, 'catalogo', task.payload.id));
      } else if (task.type === 'TOGGLE_TRANSFERRED') {
        await updateDoc(doc(db, 'items', task.payload.id), {
          transferred: task.payload.transferred,
          transferredBy: task.payload.transferredBy,
          transferredAt: task.payload.transferredAt,
        });
      }
      processed++;
      if (onProgress) onProgress(processed);
    }

    localStorage.removeItem(STORAGE_SYNC_QUEUE);
    return processed;
  } catch (err) {
    console.warn('Falha ao processar fila offline:', err);
    return 0;
  }
}
