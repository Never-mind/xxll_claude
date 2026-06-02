import AdminTable from './AdminTable.js';
import type { FieldConfig } from './AdminTable.js';
import type { Customer } from '../../../shared/api.interface.js';

const fields: FieldConfig[] = [
  { key: 'name', label: '客户名称' },
  { key: 'address', label: '客户地址' },
  { key: 'contactName', label: '客户联系人' },
  { key: 'contactPhone', label: '客户联系方式' },
];

export default function CustomerManage() {
  return <AdminTable<Customer> title="客户列表" endpoint="/customers" searchPlaceholder="客户名称/联系人/联系方式" fields={fields} columns={fields} />;
}
