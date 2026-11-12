import { CatalogItem } from '../types/stock';

export interface OfficialFabricDefinition {
  nart: string;
  description: string;
  type: 'CAMPO' | 'COMPRESSA';
  alvejado: boolean;
}

export const OFFICIAL_NEVE_FABRICS: OfficialFabricDefinition[] = [
  {
    nart: '79092-50040-01',
    description: 'TECIDO CROCHE CAMPO 34CM INA',
    type: 'CAMPO',
    alvejado: false,
  },
  {
    nart: '79092-50118-00',
    description: 'TECIDO CROCHE 7,5CM VISCOSE RX INA',
    type: 'COMPRESSA',
    alvejado: false,
  },
  {
    nart: '79092-50119-00',
    description: 'TECIDO CROCHE 7,5CM VISCOSE',
    type: 'COMPRESSA',
    alvejado: false,
  },
  {
    nart: '79092-50119-01',
    description: 'TECIDO CROCHE 7,5CM 13 FIOS INA',
    type: 'COMPRESSA',
    alvejado: false,
  },
  {
    nart: '79092-50119-09',
    description: 'TECIDO CROCHE 7,5CM 09 FIOS INA',
    type: 'COMPRESSA',
    alvejado: false,
  },
  {
    nart: '79092-50119-11',
    description: 'TECIDO CROCHE 7,5CM 11 FIOS INA',
    type: 'COMPRESSA',
    alvejado: false,
  },
  {
    nart: '79092-50219-00',
    description: 'TECIDO CROCHE 7,5CM ALVEJADO',
    type: 'COMPRESSA',
    alvejado: true,
  },
  {
    nart: '79092-50220-00',
    description: 'TECIDO CROCHE 10CM ALVEJADO',
    type: 'COMPRESSA',
    alvejado: true,
  },
  {
    nart: '79092-50221-00',
    description: 'TECIDO CROCHE 10CM RX ALVEJADO',
    type: 'COMPRESSA',
    alvejado: true,
  },
  {
    nart: '79092-50222-00',
    description: 'TECIDO CROCHE 7,5CM RX ALVEJADO',
    type: 'COMPRESSA',
    alvejado: true,
  },
  {
    nart: '79092-50223-00',
    description: 'TECIDO CROCHE CAMPO 34CM C/RX ALVEJADO',
    type: 'CAMPO',
    alvejado: true,
  },
  {
    nart: '79092-50224-00',
    description: 'TECIDO CROCHE CAMPO 20CM ALVEJADO',
    type: 'CAMPO',
    alvejado: true,
  },
  {
    nart: '79092-50228-00',
    description: 'TECIDO CROCHE 7,5CM 11 FIOS ALVEJADO',
    type: 'COMPRESSA',
    alvejado: true,
  },
];

export const INITIAL_CATALOG_ITEMS: CatalogItem[] = OFFICIAL_NEVE_FABRICS.map((item) => ({
  id: `cat-${item.nart.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
  nart: item.nart,
  description: item.description,
  type: item.type,
  alvejado: item.alvejado,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'Catálogo Oficial Neve',
}));
