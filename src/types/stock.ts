import { MaterialType, StockStatus, DestinationAllocation, DestinationWarehouse } from '../utils/destinationRules';

export type { MaterialType, StockStatus, DestinationAllocation, DestinationWarehouse };

export type FolderStatus = 'PENDENTE' | 'EM_CONFERENCIA' | 'CONFERIDA_100' | 'VERIFICADA';

export interface UserProfile {
  uid: string;
  nome: string;
  matricula: string;
  criadoEm: string;
}

export interface StoredFileInfo {
  fileName: string;
  fileSize: number;
  fileSizeKb: number;
  fileType: string;
  totalParts: number;
  uploadedByNome: string;
  uploadedByMatricula: string;
  uploadedAt: string;
}

export interface FileChunkDoc {
  folderId: string;
  partIndex: number;
  totalParts: number;
  chunkData: string;
  createdAt: string;
}

export interface CatalogItem {
  id: string; // normalizado pelo nart ou id aleatório
  nart: string; // Código do produto (ex: 201045 ou 79092-50040-01)
  description: string;
  type: 'CAMPO' | 'COMPRESSA';
  alvejado: boolean;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  createdBy?: string;
}

export interface StockItem {
  id: string;
  folderId: string;
  nart: string;
  description: string;
  lot: string; // Para não alvejados: Lote. Para alvejados: Ciclo / Ciclos (ex: "11491" ou "3782 ao 3789")
  systemQty: number; // Em kg com 2 decimais
  type: MaterialType;
  alvejado: boolean; // true = Alvejado (usa Ciclo e fica na seção ALVEJADOS), false = Não alvejado (usa Lote)
  cycle?: string | null; // Ciclo explícito (espelho de lot para alvejados)
  originWarehouse: string; // "ARMAZÉM 12"
  physicalFound: boolean | null; // null = pendente, true = sim, false = não
  physicalQty: number | null; // Em kg com 2 decimais
  status: StockStatus;
  allocations: DestinationAllocation[];
  difference: number | null;
  hasSurplus?: boolean;
  surplusQty: number;
  surplusDecision?: 'PENDING_DECISION' | 'ALL_TO_01' | 'SYSTEM_TO_01_SURPLUS_FLAG';
  checkedAt?: string | null; // ISO String
  checkedBy?: string | null; // Nome do operador
  checkedByMatricula?: string | null;
  notes?: string | null;
  updatedAt?: string;
  previousState?: string | null;
  transferred?: boolean;
  transferredBy?: string | null;
  transferredAt?: string | null;
}

export interface Folder {
  id: string;
  name: string; // Ex: "Importação 11/11/2026 00:30 – por Rikelme"
  createdAt: string; // ISO String
  operator: string;
  operatorMatricula?: string | null;
  itemCount: number;
  totalQty: number; // Em kg com 2 decimais
  checkedCount: number;
  status: FolderStatus;
  verifiedBy?: string | null;
  verifiedByMatricula?: string | null;
  verifiedAt?: string | null;
  notes?: string | null;
  originalFile?: StoredFileInfo;
}

export type StockFolder = Folder;

export interface HistoryLog {
  id: string;
  timestamp: string; // ISO String
  operator: string;
  nart?: string;
  description?: string;
  lot?: string;
  action:
    | 'IMPORT'
    | 'CONFERENCIA'
    | 'DESFAZER'
    | 'CRIAR'
    | 'EDITAR'
    | 'EXCLUIR'
    | 'AJUSTE_SOBRA'
    | 'VERIFICAR_PASTA'
    | 'EXCLUIR_PASTA'
    | 'CATALOGO_ADICIONAR'
    | 'CATALOGO_EDITAR'
    | 'CATALOGO_EXCLUIR'
    | 'TRANSFERENCIA';
  details: string;
  folderId?: string;
  previousState?: any;
}

export type HistoryRecord = HistoryLog;

export interface ImportPreviewRow {
  nart: string;
  description: string;
  lot: string; // Lote (se normal) ou Ciclo (se alvejado)
  systemQty: number; // Em kg com 2 decimais
  type: MaterialType;
  alvejado: boolean;
  typeReviewRequired: boolean;
  notInCatalog?: boolean;
  isNewCode?: boolean;
  needsDescription?: boolean;
  isDuplicateInFile?: boolean;
  duplicateCountInFile?: number;
  alreadyExistsInOtherFolder?: boolean;
  existingFolderInfo?: {
    date: string;
    operator: string;
    folderName: string;
  };
  isValid: boolean;
  errorMessage?: string;
  auditNotice?: string;
  originalLotCell?: string;
  originalQtyCell?: string;
}


export interface ColumnMapping {
  nartColumn: string;
  lotColumn: string;
  qtyColumn: string;
  warehouseColumn?: string;
  descriptionColumn?: string;
  confidence?: number;
  method?: 'ai' | 'heuristic' | 'manual';
}
