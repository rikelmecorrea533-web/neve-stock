import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  getDocFromServer,
  query,
  orderBy,
  writeBatch,
  getDocs,
  where,
} from 'firebase/firestore';
import {
  StockItem,
  Folder,
  HistoryLog,
  CatalogItem,
  UserProfile,
  StoredFileInfo,
  FileChunkDoc,
} from '../types/stock';
import { INITIAL_CATALOG_ITEMS } from './defaultData';
import firebaseConfig from '../../firebase-applet-config.json';

// Inicialização segura do Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Converte matrícula ou usuário para e-mail interno transparente
export function matriculaToEmail(matricula: string): string {
  const clean = matricula
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_.-]/g, '');
  return `${clean}@neve-stock.app`;
}

// Criação de Conta (Login por Matrícula)
export async function registerWithMatricula(
  nome: string,
  matricula: string,
  senha: string
): Promise<UserProfile> {
  const cleanMatricula = matricula.trim();
  const email = matriculaToEmail(cleanMatricula);

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    const userProfile: UserProfile = {
      uid: cred.user.uid,
      nome: nome.trim(),
      matricula: cleanMatricula,
      criadoEm: new Date().toISOString(),
    };

    // Salva perfil no Firestore em usuarios/{uid}
    await setDoc(doc(db, 'usuarios', cred.user.uid), userProfile);
    return userProfile;
  } catch (error: any) {
    if (error.code === 'auth/operation-not-allowed') {
      throw new Error('AUTH_OPERATION_NOT_ALLOWED');
    }
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Essa matrícula já tem login.');
    }
    if (error.code === 'auth/weak-password') {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }
    if (error.code === 'auth/network-request-failed') {
      throw new Error('Sem conexão com a internet. Verifique sua rede.');
    }
    throw new Error(error.message || 'Erro ao criar conta. Tente novamente.');
  }
}

// Login por Matrícula
export async function loginWithMatricula(
  matricula: string,
  senha: string
): Promise<UserProfile> {
  const cleanMatricula = matricula.trim();
  const email = matriculaToEmail(cleanMatricula);

  try {
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    const userDocRef = doc(db, 'usuarios', cred.user.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }

    // Se o documento do perfil ainda não existir, cria perfil automático com a matrícula
    const fallbackProfile: UserProfile = {
      uid: cred.user.uid,
      nome: cleanMatricula,
      matricula: cleanMatricula,
      criadoEm: new Date().toISOString(),
    };
    await setDoc(userDocRef, fallbackProfile);
    return fallbackProfile;
  } catch (error: any) {
    if (error.code === 'auth/operation-not-allowed') {
      throw new Error('AUTH_OPERATION_NOT_ALLOWED');
    }
    if (
      error.code === 'auth/wrong-password' ||
      error.code === 'auth/invalid-credential'
    ) {
      throw new Error('Senha incorreta.');
    }
    if (
      error.code === 'auth/user-not-found' ||
      error.code === 'auth/invalid-email'
    ) {
      throw new Error('Matrícula não encontrada. Verifique ou crie seu login.');
    }
    if (error.code === 'auth/network-request-failed') {
      throw new Error('Sem conexão com a internet. Verifique sua rede.');
    }
    if (error.code === 'auth/too-many-requests') {
      throw new Error('Muitas tentativas sem sucesso. Aguarde alguns minutos e tente novamente.');
    }
    throw new Error(error.message || 'Erro ao realizar login.');
  }
}

// Troca de Senha do Usuário Logado
export async function changeUserPassword(novaSenha: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Nenhum usuário conectado.');
  }
  if (novaSenha.length < 6) {
    throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
  }
  try {
    await updatePassword(auth.currentUser, novaSenha);
  } catch (error: any) {
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('Por segurança, saia e entre novamente antes de alterar a senha.');
    }
    throw new Error(error.message || 'Erro ao alterar a senha.');
  }
}

// Logout
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Observer de autenticação em tempo real
export function subscribeToAuth(
  onProfileChange: (profile: UserProfile | null) => void
) {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (!user) {
      onProfileChange(null);
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'usuarios', user.uid));
      if (snap.exists()) {
        onProfileChange(snap.data() as UserProfile);
      } else {
        const emailPrefix = user.email ? user.email.split('@')[0] : 'Operador';
        const fallback: UserProfile = {
          uid: user.uid,
          nome: emailPrefix,
          matricula: emailPrefix,
          criadoEm: new Date().toISOString(),
        };
        await setDoc(doc(db, 'usuarios', user.uid), fallback);
        onProfileChange(fallback);
      }
    } catch (e) {
      console.warn('Erro ao carregar perfil do usuário:', e);
      const emailPrefix = user.email ? user.email.split('@')[0] : 'Operador';
      onProfileChange({
        uid: user.uid,
        nome: emailPrefix,
        matricula: emailPrefix,
        criadoEm: new Date().toISOString(),
      });
    }
  });
}

// Helper: Converte arquivo para base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// Salva arquivo original fatiado em pedaços de até 600 KB na subcoleção folders/{folderId}/arquivo/{partIndex}
export async function saveOriginalFileChunks(
  folderId: string,
  file: File,
  user: UserProfile
): Promise<StoredFileInfo> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Arquivo muito grande. O limite é 5 MB.');
  }

  const base64Data = await fileToBase64(file);
  const CHUNK_SIZE = 600 * 1024; // 600 KB por fatia (limite doc Firestore é 1 MB)
  const totalParts = Math.ceil(base64Data.length / CHUNK_SIZE);

  const batch = writeBatch(db);
  const now = new Date().toISOString();

  for (let i = 0; i < totalParts; i++) {
    const chunkSlice = base64Data.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const chunkDocRef = doc(db, 'folders', folderId, 'arquivo', `part_${i}`);
    const chunkData: FileChunkDoc = {
      folderId,
      partIndex: i,
      totalParts,
      chunkData: chunkSlice,
      createdAt: now,
    };
    batch.set(chunkDocRef, chunkData);
  }

  const fileInfo: StoredFileInfo = {
    fileName: file.name,
    fileSize: file.size,
    fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
    fileType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    totalParts,
    uploadedByNome: user.nome,
    uploadedByMatricula: user.matricula,
    uploadedAt: now,
  };

  // Atualiza a pasta com as informações do arquivo original
  batch.update(doc(db, 'folders', folderId), {
    originalFile: fileInfo,
  });

  await batch.commit();
  return fileInfo;
}

// Baixa o arquivo original remontando os pedaços da subcoleção folders/{folderId}/arquivo
export async function downloadOriginalFile(
  folderId: string,
  originalFile: StoredFileInfo
): Promise<void> {
  const partsSnap = await getDocs(
    collection(db, 'folders', folderId, 'arquivo')
  );

  if (partsSnap.empty) {
    throw new Error('Nenhum dado encontrado para o arquivo original desta pasta.');
  }

  const chunks: FileChunkDoc[] = [];
  partsSnap.forEach((d) => {
    chunks.push(d.data() as FileChunkDoc);
  });

  chunks.sort((a, b) => a.partIndex - b.partIndex);
  const fullBase64 = chunks.map((c) => c.chunkData).join('');

  // Converte dataURL base64 para Blob e faz download no aparelho
  const res = await fetch(fullBase64);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = originalFile.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Migração automática de pastas locais antigas para o Firestore compartilhado
export async function migrateLocalFoldersToFirestore(
  user: UserProfile
): Promise<number> {
  try {
    const migratedFlag = localStorage.getItem('neve_stock_migrated_v3');
    if (migratedFlag === 'true') return 0;

    const rawLocalFolders = localStorage.getItem('neve_stock_folders_v2');
    const rawLocalItems = localStorage.getItem('neve_stock_items_v2');

    if (!rawLocalFolders) {
      localStorage.setItem('neve_stock_migrated_v3', 'true');
      return 0;
    }

    const localFolders: Folder[] = JSON.parse(rawLocalFolders);
    const localItems: StockItem[] = rawLocalItems ? JSON.parse(rawLocalItems) : [];

    if (!Array.isArray(localFolders) || localFolders.length === 0) {
      localStorage.setItem('neve_stock_migrated_v3', 'true');
      return 0;
    }

    // Busca quais pastas já existem no Firestore para não sobrescrever
    const existingFoldersSnap = await getDocs(collection(db, 'folders'));
    const existingIds = new Set(existingFoldersSnap.docs.map((d) => d.id));

    let migratedCount = 0;
    for (const folder of localFolders) {
      if (!existingIds.has(folder.id)) {
        const folderItems = localItems.filter((i) => i.folderId === folder.id);
        const log: HistoryLog = {
          id: `log-migrate-${folder.id}`,
          timestamp: new Date().toISOString(),
          operator: `${user.nome} (${user.matricula})`,
          action: 'IMPORT',
          details: `Pasta "${folder.name}" migrada automaticamente do aparelho para o Firestore compartilhado.`,
          folderId: folder.id,
        };

        const batch = writeBatch(db);
        batch.set(doc(db, 'folders', folder.id), {
          ...folder,
          operator: folder.operator || `${user.nome} (${user.matricula})`,
          operatorMatricula: folder.operatorMatricula || user.matricula,
        });

        for (const item of folderItems) {
          batch.set(doc(db, 'items', item.id), item);
        }

        batch.set(doc(db, 'history', log.id), log);
        await batch.commit();
        migratedCount++;
      }
    }

    localStorage.setItem('neve_stock_migrated_v3', 'true');
    return migratedCount;
  } catch (error) {
    console.warn('Erro ao verificar ou migrar pastas locais:', error);
    return 0;
  }
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
