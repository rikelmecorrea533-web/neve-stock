import * as XLSX from 'xlsx';
import { StockItem } from '../types/stock';
import { formatDateTime } from './timeAgo';

export function exportConferenceToExcel(items: StockItem[], folderName: string = 'Conferência'): void {
  const rows = items.map((item) => {
    // Formatar armazéns destino
    const destinos = item.allocations && item.allocations.length > 0
      ? item.allocations.map((a) => `${a.warehouse} (${a.quantity} un)`).join(' + ')
      : item.status === 'PENDENTE'
      ? 'Pendente de conferência'
      : '-';

    return {
      'NART': item.nart,
      'Descrição': item.description,
      'Lote': item.lot,
      'Origem': item.originWarehouse || 'ARMAZÉM 12',
      'Saldo Sistêmico': item.systemQty,
      'Quantidade Física': item.physicalFound === false ? 0 : (item.physicalQty ?? '-'),
      'Diferença': item.difference !== null ? item.difference : '-',
      'Tipo': item.type,
      'Armazém Destino': destinos,
      'Status': item.status,
      'Operador': item.checkedBy || '-',
      'Data Conferência': item.checkedAt ? formatDateTime(item.checkedAt) : '-',
      'Observações': item.notes || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ajustar largura das colunas
  worksheet['!cols'] = [
    { wch: 12 }, // NART
    { wch: 45 }, // Descrição
    { wch: 15 }, // Lote
    { wch: 14 }, // Origem
    { wch: 16 }, // Saldo Sistêmico
    { wch: 18 }, // Quantidade Física
    { wch: 12 }, // Diferença
    { wch: 14 }, // Tipo
    { wch: 35 }, // Armazém Destino
    { wch: 16 }, // Status
    { wch: 18 }, // Operador
    { wch: 18 }, // Data Conferência
    { wch: 25 }, // Observações
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Conferência Neve');

  const safeFolderName = folderName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `NEVE_STOCK_${safeFolderName}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}
