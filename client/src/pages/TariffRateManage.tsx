import AdminTable from './AdminTable.js';
import type { FieldConfig } from './AdminTable.js';
import type { TariffRate } from '../../../shared/api.interface.js';

const fields: FieldConfig[] = [
  { key: 'deviceType', label: '设备类型' },
  { key: 'hsCode', label: 'HS编码' },
  { key: 'taxRate', label: '税率(%)', type: 'number', step: 'any' },
  { key: 'needNom', label: '需要NOM', type: 'checkbox' },
];

export default function TariffRateManage() {
  return <AdminTable<TariffRate> title="关税税率管理" endpoint="/tariff-rates" searchPlaceholder="设备类型/HS编码" fields={fields} columns={fields} />;
}
