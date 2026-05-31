import AdminTable from './AdminTable.js';
import type { FieldConfig } from './AdminTable.js';
import type { Product } from '../../../shared/api.interface.js';

const fields: FieldConfig[] = [
  { key: 'productCode', label: '产品编码' },
  { key: 'name', label: '产品名称' },
  { key: 'spec', label: '规格' },
  { key: 'brand', label: '品牌' },
  { key: 'category', label: '品类' },
  { key: 'unit', label: '单位' },
  { key: 'length', label: '长(cm)', type: 'number' },
  { key: 'width', label: '宽(cm)', type: 'number' },
  { key: 'height', label: '高(cm)', type: 'number' },
  { key: 'grossWeight', label: '毛重(kg)', type: 'number' },
  { key: 'hsCodeCn', label: '中国HS编码' },
  { key: 'hsCodeMx', label: '墨西哥HS编码' },
  { key: 'suggestedPrice', label: '建议进价(CNY)', type: 'number' },
  { key: 'isMagnetic', label: '带磁', type: 'checkbox' },
  { key: 'isElectric', label: '带电', type: 'checkbox' },
  { key: 'needNom', label: '需要NOM', type: 'checkbox' },
  { key: 'imageUrl', label: '图片URL' },
];

const columns = fields.filter((field) =>
  ['productCode', 'name', 'spec', 'brand', 'category', 'unit', 'grossWeight', 'hsCodeMx', 'suggestedPrice', 'needNom'].includes(field.key),
);

export default function ProductManage() {
  return <AdminTable<Product> title="产品管理" endpoint="/products" searchPlaceholder="产品编码 / 名称 / 品类" fields={fields} columns={columns} />;
}
