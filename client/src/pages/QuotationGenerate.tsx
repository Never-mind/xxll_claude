import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiWrite } from '../api.js';
import type { CreateQuotationDto, Customer, CustomerPage, Product, ProductPage, QuotationDetail, TariffPage, TariffRate } from '../api.js';
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
  customerId: '',
  customerName: '',
  remark: '',
};

export default function QuotationGenerate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tariffs, setTariffs] = useState<TariffRate[]>([]);
  const [items, setItems] = useState<CreateQuotationItemDto[]>([]);
  const [params, setParams] = useState(defaultParams);
  const [productKeyword, setProductKeyword] = useState('');
  const [status, setStatus] = useState<'draft' | 'completed'>('draft');
  const [detail, setDetail] = useState<QuotationDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<ProductPage>('/products?page=1&pageSize=50').then((result) => setProducts(result.items)).catch((err) => setError(err.message));
    apiGet<CustomerPage>('/customers?page=1&pageSize=50').then((result) => setCustomers(result.items)).catch((err) => setError(err.message));
    apiGet<TariffPage>('/tariff-rates?page=1&pageSize=50').then((result) => setTariffs(result.items)).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!id) return;
    apiGet<QuotationDetail>(`/quotations/${id}`).then((result) => {
      if (result.quotation.status === 'completed') {
        setError('已完成报价单不可修改');
        return;
      }
      setParams((current) => ({
        ...current,
        exchangeRateUsd: result.quotation.exchangeRateUsd,
        exchangeRateMxn: result.quotation.exchangeRateMxn,
        capitalCostRate: result.quotation.capitalCostRate,
        accountPeriod: result.quotation.accountPeriod,
        badDebtRate: result.quotation.badDebtRate,
        customsFeeRate: result.quotation.customsFeeRate,
        vatOverseas: result.quotation.vatOverseas,
        markupRate: result.quotation.markupRate,
        seaFreightRate: result.quotation.seaFreightRate,
        airFreightRate: result.quotation.airFreightRate,
        nomFee: result.quotation.nomFee,
        customsMiscFee: result.quotation.customsMiscFee,
        lastMileFee: result.quotation.lastMileFee,
        storageOperationFee: result.quotation.storageOperationFee,
        implementationFee: result.quotation.implementationFee,
        publicFeeTotal: result.quotation.publicFeeTotal,
        customerId: result.quotation.customerId || '',
        customerName: result.quotation.customerName || '',
        remark: result.quotation.remark || '',
      }));
      setStatus(result.quotation.status);
      setItems(result.items.map((item) => ({
        productId: item.productId,
        purchaseQty: item.purchaseQty,
        purchasePriceCny: item.purchasePriceCny,
        transportType: item.transportType,
        isCustomsClearance: item.isCustomsClearance,
        markupRate: item.markupRate,
        enableNom: item.enableNom,
      })));
    }).catch((err) => setError(err.message));
  }, [id]);

  const productOptions = useMemo(() => products.map((product) => ({ value: product.id, label: `${product.productCode} ${product.name}` })), [products]);
  const filteredProducts = useMemo(() => {
    const keyword = productKeyword.trim().toLowerCase();
    if (!keyword) return [];
    return products.filter((product) =>
      [product.productCode, product.name, product.category].some((value) => String(value ?? '').toLowerCase().includes(keyword)),
    ).slice(0, 10);
  }, [productKeyword, products]);
  const effectiveParams = useMemo(() => ({
    ...params,
    publicFeeTotal: Number(params.customsMiscFee || 0)
      + Number(params.lastMileFee || 0)
      + Number(params.storageOperationFee || 0)
      + Number(params.implementationFee || 0),
  }), [params]);
  const previewItems = useMemo(() => calculatePreview(effectiveParams, items, products, tariffs), [items, effectiveParams, products, tariffs]);
  const totals = useMemo(() => summarizePreview(items, previewItems, effectiveParams.publicFeeTotal), [items, previewItems, effectiveParams.publicFeeTotal]);

  function addItem(product = products[0]) {
    if (!product) return;
    setItems((current) => [
      ...current,
      {
        productId: product.id,
        purchaseQty: 1,
        purchasePriceCny: product.suggestedPrice || 0,
        transportType: 'sea',
        isCustomsClearance: true,
        enableNom: product.needNom,
      },
    ]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!params.customerId) {
      setError('请先从客户列表选择已建档客户');
      return;
    }
    const selectedCustomer = customers.find((customer) => customer.id === params.customerId);
    const dto = Object.fromEntries(Object.keys(defaultParams).map((key) => [key, effectiveParams[key as keyof typeof defaultParams]])) as unknown as CreateQuotationDto;
    dto.customerName = selectedCustomer?.name || '';
    dto.status = status;
    dto.items = items;
    const created = await apiWrite<QuotationDetail>(id ? `/quotations/${id}` : '/quotations', id ? 'PUT' : 'POST', dto);
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
      </header>
      {error && <div className="alert">{error}</div>}
      <form onSubmit={submit}>
        <div className="panel">
          <h2>报价参数</h2>
          <div className="form-grid compact">
            {Object.entries(defaultParams).map(([key]) => (
              <label key={key}>
                <span>{paramLabel(key)}</span>
                {key === 'customerId' ? (
                  <select name={key} value={params.customerId} onChange={(event) => selectCustomer(event.target.value)}>
                    <option value="">请选择已建档客户</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </select>
                ) : key === 'customerName' ? (
                  <input name={key} value={params.customerName} readOnly />
                ) : (
                  <input
                    name={key}
                    type={['remark'].includes(key) ? 'text' : 'number'}
                    step={['remark'].includes(key) ? undefined : '0.01'}
                    value={String(effectiveParams[key as keyof typeof defaultParams])}
                    readOnly={key === 'publicFeeTotal'}
                    onChange={(event) => updateParam(key as keyof typeof defaultParams, event.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
        <div className="panel product-picker">
          <h2>选品</h2>
          <div className="search-group picker-search">
            <input value={productKeyword} onChange={(event) => setProductKeyword(event.target.value)} placeholder="搜索产品名称/编码..." />
            <button className="primary-action search-action" type="button">搜索</button>
          </div>
          <div className="product-chip-grid">
            {filteredProducts.map((product) => (
              <button className="product-chip" type="button" key={product.id} onClick={() => addItem(product)}>
                <span>{product.name}</span>
                <small>({product.productCode}) ${Number(product.suggestedPrice || 0).toFixed(2)}</small>
                <strong>+ 添加</strong>
              </button>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>选品清单 ({items.length})</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>产品名称</th>
                  <th>数量</th>
                  <th>采购单价(CNY)</th>
                  <th>运输方式</th>
                  <th>清关</th>
                  <th>NOM认证</th>
                  <th>CIF(USD)</th>
                  <th>关税税率(%)</th>
                  <th>关税金额(USD)</th>
                  <th>资金成本(USD)</th>
                  <th>清关手续费(USD)</th>
                  <th>NOM认证费(USD)</th>
                  <th>到仓总价(USD)</th>
                  <th>到仓单价(USD)</th>
                  <th>加成比例(%)</th>
                  <th>DDP不含税单价(USD)</th>
                  <th>DDP不含税总价(USD)</th>
                  <th>利润(USD)</th>
                  <th>毛利率</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const preview = previewItems[index];
                  return (
                  <tr key={index}>
                    <td>
                      <select value={item.productId} onChange={(event) => updateProduct(index, event.target.value)}>
                        {productOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </td>
                    <td><input type="number" step="1" value={item.purchaseQty} onChange={(event) => updateItem(index, { purchaseQty: Number(event.target.value) })} /></td>
                    <td><input type="number" step="0.01" value={item.purchasePriceCny} onChange={(event) => updateItem(index, { purchasePriceCny: Number(event.target.value) })} /></td>
                    <td>
                      <select value={item.transportType} onChange={(event) => updateItem(index, { transportType: event.target.value as CreateQuotationItemDto['transportType'] })}>
                        <option value="air">air</option>
                        <option value="sea">sea</option>
                        <option value="none">none</option>
                      </select>
                    </td>
                    <td><input type="checkbox" checked={item.isCustomsClearance} onChange={(event) => updateItem(index, { isCustomsClearance: event.target.checked })} /></td>
                    <td><input type="checkbox" checked={Boolean(item.enableNom)} onChange={(event) => updateItem(index, { enableNom: event.target.checked })} /></td>
                    <td className="numeric-cell">{money(preview?.cifUsd)}</td>
                    <td className="numeric-cell">{percent(preview?.igiTaxRate)}</td>
                    <td className="numeric-cell">{money(preview?.tariffUsd)}</td>
                    <td className="numeric-cell">{money(preview?.capitalCostUsd)}</td>
                    <td className="numeric-cell">{money(preview?.customsFeeUsd)}</td>
                    <td className="numeric-cell">{money(preview?.nomFeeUsd)}</td>
                    <td className="numeric-cell">{money(preview?.ddpTotalUsd)}</td>
                    <td className="numeric-cell">{money(preview?.ddpUnitPriceUsd)}</td>
                    <td><input type="number" step="0.01" value={item.markupRate ?? ''} onChange={(event) => updateItem(index, { markupRate: event.target.value ? Number(event.target.value) : undefined })} /></td>
                    <td><input type="number" step="0.01" value={money(preview?.ddpQuoteUnitUsd)} onChange={(event) => updateDdpQuoteUnit(index, Number(event.target.value), preview?.ddpUnitPriceUsd ?? 0)} /></td>
                    <td className="numeric-cell">{money(preview?.revenueUsd)}</td>
                    <td className="numeric-cell">{money(preview?.operatingProfitUsd)}</td>
                    <td className="numeric-cell">{percent(preview?.grossMarginRate)}</td>
                    <td><button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>删除</button></td>
                  </tr>
                  );
                })}
                {!items.length && (
                  <tr>
                    <td colSpan={20} className="empty-cell">选品清单为空，请先添加产品</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="quotation-summary">
            <div>
              <span>总数量</span>
              <strong>{money(totals.totalQty)}</strong>
            </div>
            <div>
              <span>公共费用合计(USD)</span>
              <strong>{money(totals.publicFeeTotal)}</strong>
            </div>
            <div>
              <span>CIF合计(USD)</span>
              <strong>{money(totals.totalCifUsd)}</strong>
            </div>
            <div>
              <span>到仓总价</span>
              <strong>{money(totals.totalDdpUsd)}</strong>
            </div>
            <div>
              <span>收入合计(USD)</span>
              <strong>{money(totals.totalRevenueUsd)}</strong>
            </div>
            <div>
              <span>利润合计(USD)</span>
              <strong>{money(totals.totalProfitUsd)}</strong>
            </div>
            <div>
              <span>综合毛利率</span>
              <strong>{percent(totals.grossMarginRate)}</strong>
            </div>
          </div>
        </div>
        <footer className="sticky-actions">
          <button type="submit" onClick={() => setStatus('draft')}>保存草稿</button>
          <button type="submit" onClick={() => setStatus('completed')}>确认报价单</button>
        </footer>
      </form>
      {detail && <pre>{JSON.stringify(detail.quotation, null, 2)}</pre>}
    </section>
  );

  function updateItem(index: number, patch: Partial<CreateQuotationItemDto>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function updateProduct(index: number, productId: string) {
    const product = products.find((candidate) => candidate.id === productId);
    updateItem(index, {
      productId,
      purchasePriceCny: product?.suggestedPrice ?? 0,
      enableNom: product?.needNom ?? false,
    });
  }

  function updateDdpQuoteUnit(index: number, quoteUnitUsd: number, warehouseUnitUsd: number) {
    const markupRate = warehouseUnitUsd > 0 ? (quoteUnitUsd / warehouseUnitUsd - 1) * 100 : 0;
    updateItem(index, { markupRate: Math.round(markupRate * 10_000) / 10_000 });
  }

  function updateParam(key: keyof typeof defaultParams, raw: string) {
    setParams((current) => ({
      ...current,
      [key]: ['customerName', 'remark'].includes(key) ? raw : Number(raw || 0),
    }));
  }

  function selectCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId);
    setParams((current) => ({
      ...current,
      customerId,
      customerName: customer?.name || '',
    }));
  }
}

interface PreviewItem {
  cifUsd: number;
  igiTaxRate: number;
  tariffUsd: number;
  capitalCostUsd: number;
  customsFeeUsd: number;
  nomFeeUsd: number;
  ddpTotalUsd: number;
  ddpUnitPriceUsd: number;
  ddpQuoteUnitUsd: number;
  revenueUsd: number;
  operatingProfitUsd: number;
  grossMarginRate: number;
}

function calculatePreview(params: typeof defaultParams, items: CreateQuotationItemDto[], products: Product[], tariffs: TariffRate[]): PreviewItem[] {
  const initial = items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) return emptyPreview();
    const tariff = tariffs.find((candidate) => candidate.hsCode === product.hsCodeMx);
    const purchaseQty = Number(item.purchaseQty || 0);
    const purchasePriceCny = Number(item.purchasePriceCny || 0);
    const totalTaxIncludedCny = purchaseQty * purchasePriceCny;
    const totalExclTaxCny = totalTaxIncludedCny / 1.13;
    const length = Number(product.length || 0);
    const width = Number(product.width || 0);
    const height = Number(product.height || 0);
    const volumetricWeight = length * width * height / 6000;
    const chargeableWeight = Math.max(volumetricWeight, Number(product.grossWeight));
    const firstMileFreightCny = item.transportType === 'air'
      ? chargeableWeight * params.airFreightRate * purchaseQty
      : item.transportType === 'sea'
        ? length * width * height / 1000 * purchaseQty * params.seaFreightRate
        : 0;
    const cifCny = totalExclTaxCny + firstMileFreightCny;
    const cifUsd = safeDivide(cifCny, params.exchangeRateUsd);
    const igiTaxRate = item.isCustomsClearance ? Number(tariff?.taxRate ?? 0) : 0;
    const tariffUsd = cifUsd * igiTaxRate / 100;
    const capitalCostUsd = cifUsd * params.capitalCostRate / 100 * params.accountPeriod / 12;
    const customsFeeUsd = item.isCustomsClearance ? cifUsd * params.customsFeeRate / 100 : 0;
    const enableNom = Boolean(item.enableNom ?? product.needNom ?? tariff?.needNom);
    const nomFeeUsd = enableNom && item.isCustomsClearance ? params.nomFee : 0;
    const ddpTotalUsd = cifUsd + tariffUsd + capitalCostUsd + customsFeeUsd + nomFeeUsd;
    const markupRate = Number(item.markupRate ?? params.markupRate);
    const ddpUnitPriceUsd = safeDivide(ddpTotalUsd, purchaseQty);
    return {
      cifUsd,
      igiTaxRate,
      tariffUsd,
      capitalCostUsd,
      customsFeeUsd,
      nomFeeUsd,
      ddpTotalUsd,
      ddpUnitPriceUsd,
      ddpQuoteUnitUsd: ddpUnitPriceUsd * (1 + markupRate / 100),
      markupRate,
      purchaseQty,
    };
  });

  const totalCifUsd = initial.reduce((sum, item) => sum + item.cifUsd, 0);
  return initial.map((item) => {
    const allocation = totalCifUsd > 0 ? params.publicFeeTotal * item.cifUsd / totalCifUsd : 0;
    const ddpTotalUsd = item.ddpTotalUsd + allocation;
    const ddpUnitPriceUsd = safeDivide(ddpTotalUsd, item.purchaseQty);
    const ddpQuoteUnitUsd = ddpUnitPriceUsd * (1 + item.markupRate / 100);
    const revenueUsd = ddpQuoteUnitUsd * item.purchaseQty;
    const operatingProfitUsd = revenueUsd - ddpTotalUsd;
    return roundPreview({
      ...item,
      ddpTotalUsd,
      ddpUnitPriceUsd,
      ddpQuoteUnitUsd,
      revenueUsd,
      operatingProfitUsd,
      grossMarginRate: revenueUsd > 0 ? operatingProfitUsd / revenueUsd * 100 : 0,
    });
  });
}

function summarizePreview(items: CreateQuotationItemDto[], previewItems: PreviewItem[], publicFeeTotal: number) {
  const totalQty = items.reduce((sum, item) => sum + Number(item.purchaseQty || 0), 0);
  const totalCifUsd = previewItems.reduce((sum, item) => sum + item.cifUsd, 0);
  const totalDdpUsd = previewItems.reduce((sum, item) => sum + item.ddpTotalUsd, 0);
  const totalRevenueUsd = previewItems.reduce((sum, item) => sum + item.revenueUsd, 0);
  const totalProfitUsd = previewItems.reduce((sum, item) => sum + item.operatingProfitUsd, 0);
  return {
    totalQty,
    publicFeeTotal,
    totalCifUsd,
    totalDdpUsd,
    totalRevenueUsd,
    totalProfitUsd,
    grossMarginRate: totalRevenueUsd > 0 ? totalProfitUsd / totalRevenueUsd * 100 : 0,
  };
}

function emptyPreview(): PreviewItem {
  return {
    cifUsd: 0,
    igiTaxRate: 0,
    tariffUsd: 0,
    capitalCostUsd: 0,
    customsFeeUsd: 0,
    nomFeeUsd: 0,
    ddpTotalUsd: 0,
    ddpUnitPriceUsd: 0,
    ddpQuoteUnitUsd: 0,
    revenueUsd: 0,
    operatingProfitUsd: 0,
    grossMarginRate: 0,
  };
}

function safeDivide(value: number, divisor: number) {
  return divisor ? value / divisor : 0;
}

function roundPreview<T extends Record<string, number>>(input: T): T {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Math.round(value * 10_000) / 10_000])) as T;
}

function money(value = 0) {
  return Number(value || 0).toFixed(2);
}

function percent(value = 0) {
  return `${Number(value || 0).toFixed(2)}%`;
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
