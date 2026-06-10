import { useEffect, useState } from 'react';
import AdminTable from './AdminTable.js';
import type { FieldConfig } from './AdminTable.js';
import { apiGet } from '../api.js';
import type { Product, TariffPage, TariffRate } from '../api.js';

const fields: FieldConfig[] = [
  { key: 'imageUrl', label: '图片', type: 'image' },
  { key: 'productCode', label: '产品编码' },
  { key: 'name', label: '产品名称' },
  { key: 'spec', label: '规格' },
  { key: 'brand', label: '品牌' },
  { key: 'category', label: '品类' },
  { key: 'unit', label: '单位' },
  { key: 'length', label: '长(cm)', type: 'number' },
  { key: 'width', label: '宽(cm)', type: 'number' },
  { key: 'height', label: '高(cm)', type: 'number' },
  { key: 'grossWeight', label: '毛重(kg)', type: 'number', step: '0.01' },
  { key: 'hsCodeCn', label: '中国HS编码' },
  { key: 'hsCodeMx', label: '墨西哥HS编码' },
  { key: 'suggestedPrice', label: '建议进价(CNY)', type: 'number' },
  { key: 'contactName1', label: '联系人姓名1' },
  { key: 'contactPhone1', label: '联系方式1' },
  { key: 'contactName2', label: '联系人姓名2' },
  { key: 'contactPhone2', label: '联系方式2' },
  { key: 'isMagnetic', label: '带磁', type: 'checkbox' },
  { key: 'isElectric', label: '带电', type: 'checkbox' },
  { key: 'needNom', label: '需要NOM', type: 'checkbox' },
];

const columns: FieldConfig[] = [
  { key: 'imageUrl', label: '图片' },
  { key: 'productCode', label: '产品编码' },
  { key: 'name', label: '产品名称' },
  { key: 'spec', label: '规格' },
  { key: 'brand', label: '品牌' },
  { key: 'category', label: '品类' },
  { key: 'unit', label: '单位' },
  { key: 'dimensions', label: '尺寸(cm)' },
  { key: 'grossWeight', label: '毛重(kg)' },
  { key: 'hsCodeCn', label: '中国HS编码' },
  { key: 'hsCodeMx', label: '墨西哥HS编码' },
  { key: 'mxTaxRate', label: '墨西哥关税(%)' },
  { key: 'suggestedPrice', label: '建议进价' },
  { key: 'contacts', label: '联系方式' },
  { key: 'features', label: '特性' },
];

export default function ProductManage() {
  const [tariffs, setTariffs] = useState<TariffRate[]>([]);

  useEffect(() => {
    apiGet<TariffPage>('/tariff-rates?page=1&pageSize=50').then((result) => setTariffs(result.items)).catch(() => setTariffs([]));
  }, []);

  return (
    <AdminTable<Product>
      title="产品信息管理"
      endpoint="/products"
      searchPlaceholder="产品编码/名称"
      fields={fields}
      columns={columns}
      enableBulkDelete
      getCellValue={(row, column) => {
        if (column.key === 'dimensions') return `${number(row.length)}×${number(row.width)}×${number(row.height)}`;
        if (column.key === 'mxTaxRate') {
          const rate = tariffs.find((item) => item.hsCode === row.hsCodeMx)?.taxRate;
          return rate === undefined ? '' : `${Number(rate).toFixed(2)}%`;
        }
        if (column.key === 'features') return row;
        if (column.key === 'contacts') return row;
        return row[column.key as keyof Product];
      }}
    />
  );
}

function number(value: number) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
