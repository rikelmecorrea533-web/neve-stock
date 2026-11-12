import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StockItem, Folder } from '../types/stock';

test('Estrutura de dados para exportação de CSV Consolidado', () => {
  const folder: Folder = {
    id: 'folder-1',
    name: 'Importação Teste 11/11/2026 – por Rikelme (1001)',
    createdAt: '2026-11-11T10:00:00.000Z',
    operator: 'Rikelme (1001)',
    operatorMatricula: '1001',
    itemCount: 2,
    totalQty: 708.34,
    checkedCount: 2,
    status: 'CONFERIDA_100',
    verifiedBy: 'Carlos (1002)',
    verifiedAt: '2026-11-11T11:00:00.000Z',
  };

  const items: StockItem[] = [
    {
      id: 'item-1',
      folderId: 'folder-1',
      nart: '79092-50040-01',
      description: 'TECIDO CROCHE CAMPO 34CM INA',
      lot: '2611010111',
      systemQty: 500,
      type: 'CAMPO',
      alvejado: false,
      originWarehouse: 'ARMAZÉM 12',
      physicalFound: true,
      physicalQty: 450,
      status: 'CONFERIDO',
      difference: -50,
      allocations: [
        { warehouse: 'ARMAZÉM 01', quantity: 450, reason: 'Físico conferido' },
        { warehouse: 'ARMAZÉM 04', quantity: 50, reason: 'Diferença de campo' },
      ],
      hasSurplus: false,
      surplusQty: 0,
      transferred: true,
      transferredBy: 'Rikelme (1001)',
      transferredAt: '2026-11-11T10:30:00.000Z',
      checkedBy: 'Rikelme (1001)',
      checkedAt: '2026-11-11T10:15:00.000Z',
    },
    {
      id: 'item-2',
      folderId: 'folder-1',
      nart: '79092-50118-00',
      description: 'TECIDO CROCHE 7,5CM VISCOSE RX INA',
      lot: '2611010107',
      systemQty: 208.34,
      type: 'COMPRESSA',
      alvejado: false,
      originWarehouse: 'ARMAZÉM 12',
      physicalFound: true,
      physicalQty: 208.34,
      status: 'CONFERIDO',
      difference: 0,
      allocations: [
        { warehouse: 'ARMAZÉM 01', quantity: 208.34, reason: 'Físico conferido' },
      ],
      hasSurplus: false,
      surplusQty: 0,
      transferred: false,
      checkedBy: 'Rikelme (1001)',
      checkedAt: '2026-11-11T10:20:00.000Z',
    },
  ];

  assert.equal(items.length, 2);
  assert.equal(folder.checkedCount, 2);
  const diffItems = items.filter((i) => i.difference !== 0);
  assert.equal(diffItems.length, 1);
  assert.equal(diffItems[0].difference, -50);
});
