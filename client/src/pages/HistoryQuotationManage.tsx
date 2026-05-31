import AdminTable from './AdminTable.js';
import type { FieldConfig } from './AdminTable.js';
import type { HistoryQuotation } from '../../../shared/api.interface.js';

const fields: FieldConfig[] = [
  { key: 'quotationDate', label: '报价日期', type: 'date' },
  { key: 'customerName', label: '客户名称' },
  { key: 'productCode', label: '产品编码' },
  { key: 'productName', label: '产品名称' },
  { key: 'spec', label: '规格' },
  { key: 'brand', label: '品牌' },
  { key: 'transportType', label: '运输方式', type: 'select', options: ['air', 'sea', 'none'] },
  { key: 'customerPriceUsd', label: '客户报价(USD)', type: 'number' },
];

export default function HistoryQuotationManage() {
  return <AdminTable<HistoryQuotation> title="历史报价" endpoint="/history-quotations" searchPlaceholder="客户 / 产品编码 / 产品名称" fields={fields} columns={fields} />;
}
