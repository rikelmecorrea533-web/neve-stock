import { MaterialType, StockStatus, DestinationAllocation, DestinationWarehouse } from '../utils/destinationRules';

export type { MaterialType, StockStatus, DestinationAllocation, DestinationWarehouse };

export type FolderStatus = 'PENDENTE' | 'EM_CONFERENCIA' | 'CONFERIDA_100' | 'VERIFICADA';

export interface CatalogItem {
  id: string; // normalizado pelo nart ou id aleatório
  nart: string; // Código do produto (ex: 201045 ou 79092-50040-01)
  description: string;
  type: 'CAMPO' | 'COMPRESSA';
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  createdBy?: string;
}

export interface StockItem {
  id: string;
  folderId: string;
  nart: string;
  description: string;
  lot: string;
  systemQty: number;
  type: MaterialType;
  originWarehouse: string; // "ARMAZÉM 12"
  physicalFound: boolean | null; // null = pendente, true = sim, false = não
  physicalQty: number | null;
  status: StockStatus;
  allocations: DestinationAllocation[];
  difference: number | null;
  hasSurplus?: boolean;
  surplusQty: number;
  surplusDecision?: 'PENDING_DECISION' | 'ALL_TO_01' | 'SYSTEM_TO_01_SURPLUS_FLAG';
  checkedAt?: string; // ISO String
  checkedBy?: string; // Nome do operador
  notes?: string;
  updatedAt?: string;
  previousState?: string;
  transferred?: boolean;
  transferredBy?: string;
  transferredAt?: string;
}

export interface Folder {
  id: string;
  name: string; // Ex: "Importação 11/11/2026 00:30 – por Rikelme"
  createdAt: string; // ISO String
  operator: string;
  itemCount: number;
  totalQty: number;
  checkedCount: number;
  status: FolderStatus;
  verifiedBy?: string;
  verifiedAt?: string; // ISO String
  notes?: string;
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
  lot: string;
  systemQty: number;
  type: MaterialType;
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
