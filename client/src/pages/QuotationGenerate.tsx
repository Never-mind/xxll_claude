import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiWrite } from '../api.js';
import type { CreateQuotationDto, Product, ProductPage, QuotationDetail } from '../api.js';
import type { CreateQuotationItemDto } from '../../../shared/api.interface.js';

const defaultParams = {
  exchangeRateUsd: 7.1,
  exchangeRateMxn: 0.42,
  capitalCostRate: 12,
  accountPeriod: 3,
  badDebtRate: 2,
  customsFeeRate: 1,
  vatOverseas: 16,
  markupRate: 20,
  seaFreightRate: 800,
  airFreightRate: 30,
  nomFee: 100,
  customsMiscFee: 0,
  lastMileFee: 0,
  storageOperationFee: 0,
  implementationFee: 0,
  publicFeeTotal: 0,
  customerName: '',
  remark: '',
};

export default function QuotationGenerate() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<CreateQuotationItemDto[]>([]);
  const [status, setStatus] = useState<'draft' | 'completed'>('draft');
  const [detail, setDetail] = useState<QuotationDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<ProductPage>('/products?page=1&pageSize=50').then((result) => setProducts(result.items)).catch((err) => setError(err.message));
  }, []);

  const productOptions = useMemo(() => products.map((product) => ({ value: product.id, label: `${product.productCode} ${product.name}` })), [products]);

  function addItem() {
    if (!products[0]) return;
    setItems((current) => [
      ...current,
      {
        productId: products[0].id,
        purchaseQty: 1,
        purchasePriceCny: products[0].suggestedPrice || 0,
        transportType: 'sea',
        isCustomsClearance: true,
        enableNom: products[0].needNom,
      },
    ]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dto = Object.fromEntries(
      Object.keys(defaultParams).map((key) => {
        const raw = form.get(key);
        return [key, ['customerName', 'remark'].includes(key) ? raw : Number(raw || 0)];
      }),
    ) as unknown as CreateQuotationDto;
    dto.status = status;
    dto.items = items;
    const created = await apiWrite<QuotationDetail>('/quotations', 'POST', dto);
    setDetail(created);
    navigate(`/quotation/detail/${created.quotation.id}`);
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>报价生成</h1>
          <p>配置参数、添加商品并保存报价单</p>
        </div>
        <div className="toolbar">
          <button onClick={addItem}>添加产品</button>
        </div>
      </header>
      {error && <div className="alert">{error}</div>}
      <form onSubmit={submit}>
        <div className="panel">
          <h2>报价参数</h2>
          <div className="form-grid compact">
            {Object.entries(defaultParams).map(([key, value]) => (
              <label key={key}>
                <span>{paramLabel(key)}</span>
                <input name={key} defaultValue={String(value)} />
              </label>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>产品明细</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>产品</th>
                  <th>数量</th>
                  <th>采购单价</th>
                  <th>运输</th>
                  <th>清关</th>
                  <th>加价率</th>
                  <th>NOM</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <select value={item.productId} onChange={(event) => updateItem(index, { productId: event.target.value })}>
                        {productOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </td>
                    <td><input type="number" value={item.purchaseQty} onChange={(event) => updateItem(index, { purchaseQty: Number(event.target.value) })} /></td>
                    <td><input type="number" value={item.purchasePriceCny} onChange={(event) => updateItem(index, { purchasePriceCny: Number(event.target.value) })} /></td>
                    <td>
                      <select value={item.transportType} onChange={(event) => updateItem(index, { transportType: event.target.value as CreateQuotationItemDto['transportType'] })}>
                        <option value="air">air</option>
                        <option value="sea">sea</option>
                        <option value="none">none</option>
                      </select>
                    </td>
                    <td><input type="checkbox" checked={item.isCustomsClearance} onChange={(event) => updateItem(index, { isCustomsClearance: event.target.checked })} /></td>
                    <td><input type="number" value={item.markupRate ?? ''} onChange={(event) => updateItem(index, { markupRate: event.target.value ? Number(event.target.value) : undefined })} /></td>
                    <td><input type="checkbox" checked={Boolean(item.enableNom)} onChange={(event) => updateItem(index, { enableNom: event.target.checked })} /></td>
                    <td><button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>删除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <footer className="sticky-actions">
          <button type="submit" onClick={() => setStatus('draft')}>保存草稿</button>
          <button type="submit" onClick={() => setStatus('completed')}>保存完成</button>
        </footer>
      </form>
      {detail && <pre>{JSON.stringify(detail.quotation, null, 2)}</pre>}
    </section>
  );

  function updateItem(index: number, patch: Partial<CreateQuotationItemDto>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }
}

function paramLabel(key: string) {
  const labels: Record<string, string> = {
    exchangeRateUsd: 'USD汇率',
    exchangeRateMxn: 'MXN汇率',
    capitalCostRate: '资金成本率(%)',
    accountPeriod: '账期(月)',
    badDebtRate: '坏账率(%)',
    customsFeeRate: '清关手续费率(%)',
    vatOverseas: '海外增值税率(%)',
    markupRate: '加价率(%)',
    seaFreightRate: '海运费率',
    airFreightRate: '空运费率',
    nomFee: 'NOM费(USD)',
    customsMiscFee: '清关杂费',
    lastMileFee: '尾程费',
    storageOperationFee: '仓储操作费',
    implementationFee: '实施费',
    publicFeeTotal: '公共费用总计',
    customerName: '客户名称',
    remark: '备注',
  };
  return labels[key] ?? key;
}
