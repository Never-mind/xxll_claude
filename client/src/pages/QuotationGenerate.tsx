import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { apiGet, apiWrite } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import FieldVisibilityDialog from '../components/FieldVisibilityDialog.js';
import { findHistoricalDdpQuoteUsd } from './quotation-history.js';
import type { CreateQuotationDto, Customer, CustomerPage, HistoryPage, HistoryQuotation, Product, ProductPage, QuotationDetail, TariffPage, TariffRate } from '../api.js';
import type { CreateQuotationItemDto } from '../../../shared/api.interface.js';
import { writeFormalQuotationWorkbook } from '../../../shared/formal-quotation-export.js';

const defaultParams = {
  exchangeRateUsd: 6.82,
  exchangeRateMxn: 0.06,
  capitalCostRate: 6,
  accountPeriod: 2,
  badDebtRate: 1,
  customsFeeRate: 0.8,
  vatOverseas: 16,
  markupRate: 20,
  seaFreightRate: 3200,
  airFreightRate: 100,
  nomFee: 700,
  customsMiscFee: 0,
  lastMileFee: 0,
  storageOperationFee: 0,
  implementationFee: 0,
  publicFeeTotal: 0,
  customerId: '',
  customerName: '',
  remark: '',
};

const itemColumnOptions = [
  { key: 'productCode', label: '产品编码' },
  { key: 'productName', label: '产品名称' },
  { key: 'brand', label: '品牌' },
  { key: 'purchaseQty', label: '数量' },
  { key: 'purchaseCurrency', label: '币种' },
  { key: 'purchaseUnitPrice', label: '不含税采购单价' },
  { key: 'purchaseTotalOriginal', label: '不含税采购总价（原币种）' },
  { key: 'purchaseTotalUsd', label: '不含税采购总价（USD）' },
  { key: 'transportType', label: '运输方式' },
  { key: 'isCustomsClearance', label: '清关' },
  { key: 'enableNom', label: 'NOM认证' },
  { key: 'firstMileFreightUsd', label: '头程运费（USD）' },
  { key: 'cifUsd', label: 'CIF(USD)' },
  { key: 'igiTaxRate', label: '关税税率(%)' },
  { key: 'tariffUsd', label: '关税金额(USD)' },
  { key: 'capitalCostUsd', label: '资金成本(USD)' },
  { key: 'customsFeeUsd', label: '清关手续费(USD)' },
  { key: 'nomFeeUsd', label: 'NOM认证费(USD)' },
  { key: 'ddpTotalUsd', label: '到仓总价（USD）' },
  { key: 'ddpUnitPriceUsd', label: '到仓单价(USD)' },
  { key: 'markupRate', label: '加成比例(%)' },
  { key: 'historicalDdpQuoteUsd', label: '历史DDP不含税报价（USD）' },
  { key: 'ddpQuoteUnitUsd', label: 'DDP不含税单价(USD)' },
  { key: 'revenueUsd', label: 'DDP不含税总价(USD)' },
  { key: 'operatingProfitUsd', label: '利润(USD)' },
  { key: 'grossMarginRate', label: '毛利率' },
];

export default function QuotationGenerate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tariffs, setTariffs] = useState<TariffRate[]>([]);
  const [historyQuotations, setHistoryQuotations] = useState<HistoryQuotation[]>([]);
  const [items, setItems] = useState<CreateQuotationItemDto[]>([]);
  const [params, setParams] = useState(defaultParams);
  const [productKeyword, setProductKeyword] = useState('');
  const [productMatches, setProductMatches] = useState<Product[]>([]);
  const [rowProductQueries, setRowProductQueries] = useState<Record<number, string>>({});
  const [rowProductMatches, setRowProductMatches] = useState<Record<number, Product[]>>({});
  const [selectedItemIndexes, setSelectedItemIndexes] = useState<number[]>([]);
  const [status, setStatus] = useState<'draft' | 'completed'>('draft');
  const [detail, setDetail] = useState<QuotationDetail | null>(null);
  const [error, setError] = useState('');
  const [visibleItemColumns, setVisibleItemColumns] = useState<string[]>(() => itemColumnOptions.map((column) => column.key));
  const [showItemColumns, setShowItemColumns] = useState(false);
  const [manualQuoteUnitValues, setManualQuoteUnitValues] = useState<Record<number, string>>({});

  useEffect(() => {
    setVisibleItemColumns((current) => {
      const existing = new Set(current);
      const next = itemColumnOptions.map((column) => column.key).filter((key) => existing.has(key) || key === 'brand');
      return next.length === current.length && next.every((key, index) => key === current[index]) ? current : next;
    });
  }, []);

  useEffect(() => {
    apiGet<ProductPage>('/products?page=1&pageSize=50').then((result) => {
      setProducts((current) => mergeProducts(current, result.items));
    }).catch((err) => setError(err.message));
    apiGet<CustomerPage>('/customers?page=1&pageSize=50').then((result) => setCustomers(result.items)).catch((err) => setError(err.message));
    apiGet<TariffPage>('/tariff-rates?page=1&pageSize=50').then((result) => setTariffs(result.items)).catch((err) => setError(err.message));
    apiGet<HistoryPage>('/history-quotations?page=1&pageSize=50').then((result) => setHistoryQuotations(result.items)).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const keyword = productKeyword.trim();
    if (!keyword) {
      setProductMatches([]);
      return;
    }
    const timer = window.setTimeout(() => {
      apiGet<ProductPage>(`/products?keyword=${encodeURIComponent(keyword)}&page=1&pageSize=50`)
        .then((result) => {
          setProductMatches(result.items);
          setProducts((current) => mergeProducts(current, result.items));
        })
        .catch((err) => setError(err.message));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [productKeyword]);

  useEffect(() => {
    const entries = Object.entries(rowProductQueries)
      .map(([index, query]) => ({ index: Number(index), query: query.trim() }))
      .filter(({ query }) => query);
    if (!entries.length) {
      setRowProductMatches({});
      return;
    }
    const timer = window.setTimeout(() => {
      Promise.all(entries.map(({ query }) =>
        apiGet<ProductPage>(`/products?keyword=${encodeURIComponent(query)}&page=1&pageSize=50`),
      ))
        .then((pages) => {
          const nextMatches: Record<number, Product[]> = {};
          const nextProducts: Product[] = [];
          pages.forEach((page, pageIndex) => {
            const index = entries[pageIndex].index;
            nextMatches[index] = page.items.slice(0, 8);
            nextProducts.push(...page.items);
          });
          setRowProductMatches(nextMatches);
          setProducts((current) => mergeProducts(current, nextProducts));
        })
        .catch((err) => setError(err.message));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [rowProductQueries]);

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
        productCode: item.productCode,
        productName: item.productName,
        purchaseQty: item.purchaseQty,
        purchaseCurrency: item.purchaseCurrency || 'CNY',
        purchaseUnitPrice: item.purchaseUnitPrice ?? legacyPurchaseUnitPrice(item),
        transportType: item.transportType,
        isCustomsClearance: item.isCustomsClearance,
        markupRate: item.markupRate,
        ddpQuoteUnitUsd: item.ddpQuoteUnitUsd,
        enableNom: item.enableNom,
      })));
      setSelectedItemIndexes([]);
      setManualQuoteUnitValues(Object.fromEntries(result.items.flatMap((item, index) => (
        item.ddpQuoteUnitUsd === undefined || item.ddpQuoteUnitUsd === null
          ? []
          : [[index, decimalInputValue(item.ddpQuoteUnitUsd)]]
      ))));
      hydrateProductsForQuotationItems(result.items).catch((err) => setError(err.message));
    }).catch((err) => setError(err.message));
  }, [id]);

  const filteredProducts = useMemo(() => productMatches.slice(0, 10), [productMatches]);
  const effectiveParams = useMemo(() => ({
    ...params,
    publicFeeTotal: Number(params.customsMiscFee || 0)
      + Number(params.lastMileFee || 0)
      + Number(params.storageOperationFee || 0)
      + Number(params.implementationFee || 0),
  }), [params]);
  const previewItems = useMemo(() => calculatePreview(effectiveParams, items, products, tariffs, manualQuoteUnitValues), [items, effectiveParams, products, tariffs, manualQuoteUnitValues]);
  const totals = useMemo(() => summarizePreview(items, previewItems, effectiveParams.publicFeeTotal), [items, previewItems, effectiveParams.publicFeeTotal]);

  function addItem(product = products[0]) {
    if (!product) return;
    setItems((current) => [
      ...current,
        {
          productId: product.id,
          productCode: product.productCode,
          productName: product.name,
          purchaseQty: 1,
        purchaseCurrency: 'CNY',
        purchaseUnitPrice: safeDivide(product.suggestedPrice || 0, 1.13),
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
    dto.items = items.map((item, index) => ({
      ...item,
      ddpQuoteUnitUsd: parseManualQuoteUnit(manualQuoteUnitValues[index]),
    }));
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
        <div className="toolbar action-toolbar">
          <button type="button" onClick={downloadImportTemplate}>导入模板</button>
          <label className="file-action">
            导入
            <input type="file" accept=".xlsx,.xls" onChange={importQuotationDraft} />
          </label>
          <button type="button" onClick={exportQuotationDraft}>导出</button>
          <button type="button" onClick={exportFormalQuotationDraft}>导出报价单</button>
        </div>
      </header>
      <FeedbackDialog message={error} onClose={() => setError('')} />
      <form onSubmit={submit}>
        <div className="panel">
          <h2>报价参数</h2>
          <div className="form-grid compact">
            {Object.entries(defaultParams).filter(([key]) => key !== 'customerName').map(([key]) => (
              <label key={key}>
                <span>{paramLabel(key)}</span>
                {key === 'customerId' ? (
                  <select name={key} value={params.customerId} onChange={(event) => selectCustomer(event.target.value)}>
                    <option value="">请选择已建档客户</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </select>
                ) : (
                  <input
                    name={key}
                    type={['remark'].includes(key) ? 'text' : 'number'}
                    step={['remark'].includes(key) ? undefined : 'any'}
                    value={['remark'].includes(key) ? String(params[key as keyof typeof defaultParams] ?? '') : key === 'publicFeeTotal' ? money(effectiveParams.publicFeeTotal) : decimalInputValue(params[key as keyof typeof defaultParams])}
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
          <div className="section-heading">
            <h2>选品清单 ({items.length})</h2>
            <div className="quotation-bulk-tools">
              <select aria-label="批量运输方式" defaultValue="" onChange={(event) => {
                const value = event.target.value as CreateQuotationItemDto['transportType'] | '';
                if (!value) return;
                updateSelectedItems({ transportType: value });
                event.target.value = '';
              }} disabled={!selectedItemIndexes.length}>
                <option value="">批量运输方式</option>
                <option value="air">air</option>
                <option value="sea">sea</option>
                <option value="none">none</option>
              </select>
              <button type="button" disabled={!selectedItemIndexes.length} onClick={() => updateSelectedItems({ isCustomsClearance: true })}>批量清关</button>
              <button type="button" disabled={!selectedItemIndexes.length} onClick={() => updateSelectedItems({ isCustomsClearance: false })}>取消清关</button>
              <button type="button" disabled={!selectedItemIndexes.length} onClick={() => updateSelectedItems({ enableNom: true })}>批量NOM</button>
              <button type="button" disabled={!selectedItemIndexes.length} onClick={() => updateSelectedItems({ enableNom: false })}>取消NOM</button>
              <button type="button" onClick={() => setShowItemColumns(true)}>字段显示</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <colgroup>
                <col className="quotation-select-col" />
                {itemColumnOptions.filter((column) => visibleItemColumns.includes(column.key)).map((column) => (
                  <col key={column.key} className={`quotation-col-${column.key}`} />
                ))}
                <col className="quotation-actions-col" />
              </colgroup>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="全选选品"
                      checked={items.length > 0 && selectedItemIndexes.length === items.length}
                      onChange={(event) => setSelectedItemIndexes(event.target.checked ? items.map((_, index) => index) : [])}
                    />
                  </th>
                  {itemColumnOptions.filter((column) => visibleItemColumns.includes(column.key)).map((column) => (
                    <th key={column.key} className={['productCode', 'productName', 'brand'].includes(column.key) ? 'quotation-product-column' : undefined}>{column.label}</th>
                  ))}
                  <th className="actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const preview = previewItems[index];
                  return (
                  <tr key={index}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label="选择选品"
                        checked={selectedItemIndexes.includes(index)}
                        onChange={(event) => toggleSelectedItemIndex(index, event.target.checked)}
                      />
                    </td>
                    {itemColumnOptions.filter((column) => visibleItemColumns.includes(column.key)).map((column) => renderItemCell(item, index, preview, column.key))}
                    <td className="actions"><button type="button" onClick={() => removeItem(index)}>删除</button></td>
                  </tr>
                  );
                })}
                {!items.length && (
                  <tr>
                    <td colSpan={visibleItemColumns.length + 2} className="empty-cell">选品清单为空，请先添加产品</td>
                  </tr>
                )}
              </tbody>
              {Boolean(items.length) && (
                <tfoot>
                  <tr>
                    <td></td>
                    {itemColumnOptions.filter((column) => visibleItemColumns.includes(column.key)).map((column) => (
                      <td key={column.key} className={isSummableItemColumn(column.key) ? 'numeric-cell' : undefined}>
                        {itemColumnTotal(column.key, items, previewItems)}
                      </td>
                    ))}
                    <td className="actions">合计</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="quotation-summary">
            <div>
              <span>总数量</span>
              <strong>{integer(totals.totalQty)}</strong>
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
              <span>到仓总价（USD）</span>
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
      {showItemColumns && (
        <FieldVisibilityDialog
          fields={itemColumnOptions}
          visibleKeys={visibleItemColumns}
          onChange={setVisibleItemColumns}
          onClose={() => setShowItemColumns(false)}
        />
      )}
    </section>
  );

  function renderItemCell(item: CreateQuotationItemDto, index: number, preview: PreviewItem | undefined, key: string) {
    const numeric = (value: number | undefined) => <td className="numeric-cell" key={key}>{money(value)}</td>;
    if (key === 'productCode') {
      const currentProduct = products.find((product) => product.id === item.productId);
      const query = rowProductQueries[index] ?? (currentProduct?.productCode || item.productCode || '');
      const matches = rowProductMatches[index] ?? [];
      return (
        <td className="quotation-product-column" key={key}>
          <div className="row-product-search">
            <input
              value={query}
              onChange={(event) => updateRowProductQuery(index, event.target.value)}
              placeholder="输入产品编码搜索"
            />
            {Boolean(matches.length) && (
              <div className="row-product-results">
                {matches.map((product) => (
                  <button type="button" key={product.id} onClick={() => chooseRowProduct(index, product)}>
                    <span>{product.productCode}</span>
                    <strong>{product.name}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
        </td>
      );
    }
    if (key === 'productName') {
      const currentProduct = products.find((product) => product.id === item.productId);
      return <td className="quotation-product-column" key={key}>{currentProduct?.name || item.productName || ''}</td>;
    }
    if (key === 'brand') {
      const currentProduct = products.find((product) => product.id === item.productId);
      return <td className="quotation-product-column" key={key}>{currentProduct?.brand || '-'}</td>;
    }
    if (key === 'purchaseQty') return <td key={key}><input type="number" step="1" value={numberInputValue(item.purchaseQty)} onChange={(event) => updateItem(index, { purchaseQty: parseIntegerInput(event.target.value) } as Partial<CreateQuotationItemDto>)} /></td>;
    if (key === 'purchaseCurrency') {
      return (
        <td key={key}>
          <select value={item.purchaseCurrency || 'CNY'} onChange={(event) => updateItem(index, { purchaseCurrency: event.target.value as CreateQuotationItemDto['purchaseCurrency'] })}>
            <option value="CNY">CNY</option>
            <option value="USD">USD</option>
            <option value="MXN">MXN</option>
          </select>
        </td>
      );
    }
    if (key === 'purchaseUnitPrice') return <td key={key}><input type="number" step="any" value={decimalInputValue(item.purchaseUnitPrice)} onChange={(event) => updateItem(index, { purchaseUnitPrice: parseNumberInput(event.target.value) } as Partial<CreateQuotationItemDto>)} /></td>;
    if (key === 'purchaseTotalOriginal') return numeric(preview?.purchaseTotalOriginal);
    if (key === 'purchaseTotalUsd') return numeric(preview?.purchaseTotalUsd);
    if (key === 'transportType') {
      return (
        <td key={key}>
          <select value={item.transportType} onChange={(event) => updateItem(index, { transportType: event.target.value as CreateQuotationItemDto['transportType'] })}>
            <option value="air">air</option>
            <option value="sea">sea</option>
            <option value="none">none</option>
          </select>
        </td>
      );
    }
    if (key === 'isCustomsClearance') return <td key={key}><input type="checkbox" checked={item.isCustomsClearance} onChange={(event) => updateItem(index, { isCustomsClearance: event.target.checked })} /></td>;
    if (key === 'enableNom') return <td key={key}><input type="checkbox" checked={Boolean(item.enableNom)} onChange={(event) => updateItem(index, { enableNom: event.target.checked })} /></td>;
    if (key === 'firstMileFreightUsd') return numeric(preview?.firstMileFreightUsd);
    if (key === 'igiTaxRate') return <td className="numeric-cell" key={key}>{percent(preview?.igiTaxRate)}</td>;
    if (key === 'markupRate') return <td key={key}><input type="number" step="any" value={decimalInputValue(item.markupRate)} onChange={(event) => updateMarkupRate(index, parseNumberInput(event.target.value))} /></td>;
    if (key === 'historicalDdpQuoteUsd') {
      const product = products.find((candidate) => candidate.id === item.productId);
      const quote = findHistoricalDdpQuoteUsd(historyQuotations, params.customerName, product);
      return <td className="numeric-cell" key={key}>{quote == null ? '无历史报价' : money(quote)}</td>;
    }
    if (key === 'ddpQuoteUnitUsd') {
      return (
        <td key={key}>
          <input
            type="text"
            inputMode="decimal"
            value={manualQuoteUnitValues[index] ?? decimalInputValue(preview?.ddpQuoteUnitUsd)}
            onChange={(event) => updateDdpQuoteUnit(index, event.target.value, preview?.ddpUnitPriceUsd ?? 0)}
            onBlur={() => normalizeDdpQuoteUnit(index)}
          />
        </td>
      );
    }
    if (key === 'grossMarginRate') return <td className="numeric-cell" key={key}>{percent(preview?.grossMarginRate)}</td>;
    return numeric(preview?.[key as keyof PreviewItem] as number | undefined);
  }

  function updateItem(index: number, patch: Partial<CreateQuotationItemDto>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function updateSelectedItems(patch: Partial<CreateQuotationItemDto>) {
    const selected = new Set(selectedItemIndexes);
    setItems((current) => current.map((item, index) => selected.has(index) ? { ...item, ...patch } : item));
  }

  function toggleSelectedItemIndex(index: number, checked: boolean) {
    setSelectedItemIndexes((current) => {
      if (checked) return Array.from(new Set([...current, index])).sort((left, right) => left - right);
      return current.filter((itemIndex) => itemIndex !== index);
    });
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setSelectedItemIndexes((current) => current.flatMap((itemIndex) => {
      if (itemIndex === index) return [];
      return [itemIndex > index ? itemIndex - 1 : itemIndex];
    }));
    setManualQuoteUnitValues((current) => reindexDraftValuesAfterRemove(current, index));
    setRowProductQueries((current) => reindexDraftValuesAfterRemove(current, index));
    setRowProductMatches((current) => reindexDraftValuesAfterRemove(current, index));
  }

  function updateMarkupRate(index: number, markupRate: number | undefined) {
    setManualQuoteUnitValues((current) => omitDraftValue(current, index));
    updateItem(index, { markupRate } as Partial<CreateQuotationItemDto>);
  }

  function updateProduct(index: number, productId: string, selectedProduct?: Product) {
    const product = selectedProduct ?? products.find((candidate) => candidate.id === productId);
    updateItem(index, {
      productId,
      productCode: product?.productCode,
      productName: product?.name,
      purchaseCurrency: 'CNY',
      purchaseUnitPrice: safeDivide(product?.suggestedPrice ?? 0, 1.13),
      enableNom: product?.needNom ?? false,
    });
  }

  function updateRowProductQuery(index: number, query: string) {
    setRowProductQueries((current) => ({ ...current, [index]: query }));
  }

  function chooseRowProduct(index: number, product: Product) {
    setProducts((current) => mergeProducts(current, [product]));
    setRowProductQueries((current) => ({ ...current, [index]: productOptionLabel(product) }));
    setRowProductMatches((current) => omitDraftValue(current, index));
    updateProduct(index, product.id, product);
  }

  function updateDdpQuoteUnit(index: number, rawQuoteUnitUsd: string, warehouseUnitUsd: number) {
    if (!isDecimalDraft(rawQuoteUnitUsd)) return;
    setManualQuoteUnitValues((current) => ({ ...current, [index]: rawQuoteUnitUsd }));
    const quoteUnitUsd = rawQuoteUnitUsd === '' || rawQuoteUnitUsd === '.' ? undefined : Number(rawQuoteUnitUsd);
    if (quoteUnitUsd === undefined || Number.isNaN(quoteUnitUsd)) {
      updateItem(index, { markupRate: undefined });
      return;
    }
    const markupRate = warehouseUnitUsd > 0 ? (quoteUnitUsd / warehouseUnitUsd - 1) * 100 : 0;
    updateItem(index, { markupRate: Math.round(markupRate * 10_000) / 10_000 });
  }

  function normalizeDdpQuoteUnit(index: number) {
    setManualQuoteUnitValues((current) => {
      const value = current[index];
      const parsed = parseManualQuoteUnit(value);
      if (parsed === undefined) return current;
      return { ...current, [index]: money(parsed) };
    });
  }

  function updateParam(key: keyof typeof defaultParams, raw: string) {
    setParams((current) => ({
      ...current,
      [key]: ['customerName', 'remark'].includes(key) ? raw : parseNumberInput(raw),
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

  async function hydrateProductsForQuotationItems(quotationItems: QuotationDetail['items']) {
    setProducts((current) => mergeProducts(current, quotationItems.map(productFromQuotationItem)));
    const queries = Array.from(new Set(quotationItems.map((item) => item.productCode || item.productName).filter(Boolean)));
    if (!queries.length) return;
    const pages = await Promise.all(queries.map((query) =>
      apiGet<ProductPage>(`/products?keyword=${encodeURIComponent(query)}&page=1&pageSize=50`),
    ));
    const expectedIds = new Set(quotationItems.map((item) => item.productId));
    const expectedCodes = new Set(quotationItems.map((item) => item.productCode));
    const matchedProducts = pages.flatMap((page) =>
      page.items.filter((product) => expectedIds.has(product.id) || expectedCodes.has(product.productCode)),
    );
    if (matchedProducts.length) {
      setProducts((current) => mergeProducts(current, matchedProducts));
    }
  }

  function exportQuotationDraft() {
    const paramRows = Object.entries(effectiveParams).map(([key, value]) => ({
      参数名: paramLabel(key),
      值: value,
    }));
    const itemRows = items.map((item, index) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      const preview = previewItems[index] ?? emptyPreview();
      const historicalQuote = findHistoricalDdpQuoteUsd(historyQuotations, params.customerName, product);
      return {
        产品编码: product?.productCode || item.productCode || '',
        产品名称: product?.name || item.productName || '',
        品牌: product?.brand || '',
        数量: Math.trunc(Number(item.purchaseQty || 0)),
        币种: item.purchaseCurrency || 'CNY',
        不含税采购单价: item.purchaseUnitPrice,
        '不含税采购总价（原币种）': preview.purchaseTotalOriginal,
        '不含税采购总价（USD）': preview.purchaseTotalUsd,
        运输方式: item.transportType,
        清关: item.isCustomsClearance ? '是' : '否',
        NOM认证: item.enableNom ? '是' : '否',
        '头程运费（USD）': preview.firstMileFreightUsd,
        'CIF(USD)': preview.cifUsd,
        '关税税率(%)': preview.igiTaxRate,
        '关税金额(USD)': preview.tariffUsd,
        '资金成本(USD)': preview.capitalCostUsd,
        '清关手续费(USD)': preview.customsFeeUsd,
        'NOM认证费(USD)': preview.nomFeeUsd,
        '到仓总价（USD）': preview.ddpTotalUsd,
        '到仓单价(USD)': preview.ddpUnitPriceUsd,
        '加成比例(%)': item.markupRate ?? preview.markupRate,
        '历史DDP不含税报价（USD）': historicalQuote == null ? '无历史报价' : historicalQuote,
        'DDP不含税单价(USD)': parseManualQuoteUnit(manualQuoteUnitValues[index]) ?? preview.ddpQuoteUnitUsd,
        'DDP不含税总价(USD)': preview.revenueUsd,
        '利润(USD)': preview.operatingProfitUsd,
        毛利率: percent(preview.grossMarginRate),
      };
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(paramRows), '报价参数');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(itemRows), '选品清单');
    const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quotation-draft-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadImportTemplate() {
    const headers = ['产品编码', '产品名称', '数量', '币种', '不含税采购单价', '运输方式', '清关', 'NOM认证', 'DDP不含税单价（USD）'];
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers]);
    sheet['!cols'] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 10 },
      { wch: 10 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 12 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, '选品清单');
    const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveWorkbook(data, 'quotation-import-template.xlsx');
  }

  function exportFormalQuotationDraft() {
    const selectedCustomer = customers.find((customer) => customer.id === params.customerId);
    const lines = items.map((item, index) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      const preview = previewItems[index] ?? emptyPreview();
      const quantity = Number(item.purchaseQty || 0);
      const ddpTotalUsd = Number(preview.revenueUsd || 0);
      return {
        productName: product?.name || '',
        spec: product?.spec || '',
        brand: product?.brand || '',
        unit: product?.unit || '',
        quantity,
        ddpUnitPriceUsd: quantity ? ddpTotalUsd / quantity : 0,
        ddpTotalUsd,
        remark: '',
      };
    });
    const data = writeFormalQuotationWorkbook({
      quoteTarget: params.customerName || selectedCustomer?.name || '',
      contactName: selectedCustomer?.contactName || '',
      quoteDate: new Date().toLocaleDateString('zh-CN'),
      remark: params.remark || '',
      lines,
    }, 'array') as ArrayBuffer;
    saveWorkbook(data, `formal-quotation-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function importQuotationDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const paramSheet = workbook.Sheets['报价参数'];
      const itemSheet = workbook.Sheets['选品清单'] || workbook.Sheets[workbook.SheetNames[0]];
      if (paramSheet) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(paramSheet);
        setParams((current) => {
          const next = { ...current };
          for (const row of rows) {
            const key = String(row['参数'] ?? '');
            if (!(key in next) || key === 'publicFeeTotal') continue;
            const value = row['值'];
            next[key as keyof typeof defaultParams] = (['customerId', 'customerName', 'remark'].includes(key) ? String(value ?? '') : Number(value || 0)) as never;
          }
          return next;
        });
      }
      if (!itemSheet) {
        setError('导入总数 0 条，成功 0 条，失败 0 条。\n失败原因：未找到选品清单工作表。');
        return;
      }
      const rows = worksheetDataRows(itemSheet);
      const importedRows = await Promise.all(rows.map(async (row, index) => {
        const product = await productForImportRow(row);
        if (!product) return undefined;
        const purchaseCurrency = normalizePurchaseCurrency(valueFromRow(row, ['币种', '采购币种']), 'CNY');
        const legacyPurchasePriceCny = numberFromRow(row, ['采购单价', '采购单价CNY', '采购单价(CNY)'], product.suggestedPrice || 0);
        const purchaseUnitPrice = optionalNumberFromRow(row, ['不含税采购单价'])
          ?? optionalNumberFromRow(row, ['不含税采购单价CNY', '不含税采购单价(CNY)'])
          ?? safeDivide(legacyPurchasePriceCny, 1.13);
        const ddpQuoteUnitUsd = optionalNumberFromRow(row, ['DDP不含税单价（USD）', 'DDP不含税单价(USD)', 'DDP不含税单价USD']);
        return {
          item: {
            productId: product.id,
            productCode: product.productCode,
            productName: product.name,
            purchaseQty: Math.trunc(numberFromRow(row, ['数量'], 0)),
            purchaseCurrency,
            purchaseUnitPrice,
            transportType: normalizeTransportType(valueFromRow(row, ['运输方式'])),
            isCustomsClearance: normalizeBoolean(valueFromRow(row, ['清关', '是否清关']), true),
            enableNom: normalizeBoolean(valueFromRow(row, ['NOM认证']), product.needNom),
            ddpQuoteUnitUsd,
          },
          manualQuoteUnitValue: ddpQuoteUnitUsd === undefined ? undefined : String(ddpQuoteUnitUsd),
          index,
          product,
        };
      }));
      const imported = importedRows.filter(Boolean) as Array<{
        item: CreateQuotationItemDto;
        manualQuoteUnitValue?: string;
        index: number;
        product: Product;
      }>;
      const importedItems = imported.map((row) => row.item);
      const manualValues = Object.fromEntries(imported.flatMap((row, index) =>
        row.manualQuoteUnitValue === undefined ? [] : [[index, row.manualQuoteUnitValue]],
      ));
      if (imported.length) {
        setProducts((current) => mergeProducts(current, imported.map((row) => row.product)));
      }
      setItems(importedItems);
      setManualQuoteUnitValues(manualValues);
      setSelectedItemIndexes([]);
      const failed = rows.length - importedItems.length;
      setError(`导入总数 ${rows.length} 条，成功 ${importedItems.length} 条，失败 ${failed} 条。${failed ? '\n失败原因：部分产品未匹配到已建档产品，请检查产品编码或产品名称。' : ''}`);
    } catch (err) {
      setError(`导入失败：${err instanceof Error ? err.message : '文件解析失败'}\n导入总数 0 条，成功 0 条，失败 0 条。`);
    }
  }

  async function productForImportRow(row: Record<string, unknown>): Promise<Product | undefined> {
    const productId = String(valueFromRow(row, ['产品ID']) ?? '').trim();
    const productCode = String(valueFromRow(row, ['产品编码']) ?? '').trim();
    const productName = String(valueFromRow(row, ['产品名称']) ?? '').trim();
    const cached = products.find((candidate) =>
      (productId && candidate.id === productId)
      || (productCode && candidate.productCode === productCode)
      || (productName && candidate.name === productName)
    );
    if (cached) return cached;
    const query = productCode || productName;
    if (!query) return undefined;
    const page = await apiGet<ProductPage>(`/products?keyword=${encodeURIComponent(query)}&page=1&pageSize=50`);
    return page.items.find((candidate) =>
      (productCode && candidate.productCode === productCode)
      || (productName && candidate.name === productName)
    ) || page.items[0];
  }
}

function saveWorkbook(data: ArrayBuffer, filename: string) {
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeTransportType(value: unknown): CreateQuotationItemDto['transportType'] {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['air', '空运'].includes(normalized)) return 'air';
  if (['none', '无', '不运输'].includes(normalized)) return 'none';
  return 'sea';
}

function normalizePurchaseCurrency(value: unknown, fallback: CreateQuotationItemDto['purchaseCurrency'] = 'CNY'): CreateQuotationItemDto['purchaseCurrency'] {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized === 'CNY' || normalized === 'USD' || normalized === 'MXN' ? normalized : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', '是', 'yes', 'y'].includes(String(value).trim().toLowerCase());
}

function valueFromRow(row: Record<string, unknown>, headers: string[]) {
  const entries = Object.entries(row);
  for (const header of headers) {
    const direct = row[header];
    if (direct !== undefined) return direct;
    const normalizedHeader = normalizeHeader(header);
    const match = entries.find(([key]) => normalizeHeader(key) === normalizedHeader);
    if (match) return match[1];
  }
  return undefined;
}

function worksheetDataRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const headers = (rows[0] || []).map((value) => String(value ?? '').trim());
  return rows.slice(1).flatMap((cells) => {
    const hasContent = cells.some((value) => String(value ?? '').trim() !== '');
    if (!hasContent) return [];
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (header) row[header] = cells[index];
    });
    return [row];
  });
}

function numberFromRow(row: Record<string, unknown>, headers: string[], fallback = 0) {
  const value = valueFromRow(row, headers);
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function optionalNumberFromRow(row: Record<string, unknown>, headers: string[]) {
  const value = valueFromRow(row, headers);
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeHeader(value: string) {
  return value.replace(/[（）]/g, (match) => match === '（' ? '(' : ')').replace(/\s+/g, '').trim();
}

function mergeProducts(current: Product[], incoming: Product[]) {
  const merged = new Map(current.map((product) => [product.id, product]));
  for (const product of incoming) {
    merged.set(product.id, product);
  }
  return Array.from(merged.values());
}

function productFromQuotationItem(item: QuotationDetail['items'][number]): Product {
  return {
    id: item.productId,
    productCode: item.productCode,
    name: item.productName,
    brand: item.brand || '',
    unit: '',
    length: 0,
    width: 0,
    height: 0,
    grossWeight: 0,
    hsCodeMx: '',
    suggestedPrice: item.purchaseCurrency === 'CNY' ? item.purchaseUnitPrice : 0,
    isMagnetic: false,
    isElectric: false,
    needNom: item.enableNom,
    createdAt: '',
    updatedAt: '',
  };
}

function legacyPurchaseUnitPrice(item: QuotationDetail['items'][number]): number {
  const legacy = item as QuotationDetail['items'][number] & {
    purchasePriceCny?: number;
    purchasePriceExclTaxCny?: number;
    totalExclTaxCny?: number;
  };
  if (item.purchaseUnitPrice) return item.purchaseUnitPrice;
  if (legacy.purchasePriceExclTaxCny) return legacy.purchasePriceExclTaxCny;
  if (legacy.totalExclTaxCny) return safeDivide(Number(legacy.totalExclTaxCny), Number(item.purchaseQty || 0));
  if (legacy.purchasePriceCny) return safeDivide(Number(legacy.purchasePriceCny), 1.13);
  return 0;
}

function productOptionLabel(product: Product): string {
  return [product.productCode, product.name].filter(Boolean).join(' ');
}

interface PreviewItem {
  purchaseTotalOriginal: number;
  purchaseTotalUsd: number;
  firstMileFreightUsd: number;
  cifUsd: number;
  igiTaxRate: number;
  tariffUsd: number;
  capitalCostUsd: number;
  customsFeeUsd: number;
  nomFeeUsd: number;
  ddpTotalUsd: number;
  ddpUnitPriceUsd: number;
  ddpQuoteUnitUsd: number;
  manualQuoteUnitUsd?: number;
  revenueUsd: number;
  operatingProfitUsd: number;
  grossMarginRate: number;
  markupRate: number;
  purchaseQty: number;
}

function calculatePreview(
  params: typeof defaultParams,
  items: CreateQuotationItemDto[],
  products: Product[],
  tariffs: TariffRate[],
  manualQuoteUnitValues: Record<number, string> = {},
): PreviewItem[] {
  const initial = items.map((item, index) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) return emptyPreview();
    const tariff = tariffs.find((candidate) => candidate.hsCode === product.hsCodeMx);
    const purchaseQty = Number(item.purchaseQty || 0);
    const purchaseCurrency = item.purchaseCurrency || 'CNY';
    const purchaseUnitPrice = item.purchaseUnitPrice ?? item.purchasePriceExclTaxCny ?? safeDivide(Number(item.purchasePriceCny || 0), 1.13);
    const purchaseTotalOriginal = purchaseQty * Number(purchaseUnitPrice || 0);
    const purchaseTotalUsd = convertPurchaseTotalToUsd(purchaseTotalOriginal, purchaseCurrency, params);
    const length = Number(product.length || 0);
    const width = Number(product.width || 0);
    const height = Number(product.height || 0);
    const volumetricWeight = length * width * height / 6000;
    const chargeableWeight = Math.max(volumetricWeight, Number(product.grossWeight));
    const firstMileFreightCny = item.transportType === 'air'
      ? chargeableWeight * params.airFreightRate * purchaseQty
      : item.transportType === 'sea'
        ? length * width * height / 1000000 * params.seaFreightRate * purchaseQty
        : 0;
    const firstMileFreightUsd = safeDivide(firstMileFreightCny, params.exchangeRateUsd);
    const cifUsd = purchaseTotalUsd + firstMileFreightUsd;
    const igiTaxRate = item.isCustomsClearance ? Number(tariff?.taxRate ?? 0) : 0;
    const tariffUsd = cifUsd * igiTaxRate / 100;
    const capitalCostUsd = cifUsd * params.capitalCostRate / 100 * params.accountPeriod / 12;
    const customsFeeUsd = item.isCustomsClearance ? cifUsd * params.customsFeeRate / 100 : 0;
    const enableNom = Boolean(item.enableNom ?? product.needNom ?? tariff?.needNom);
    const nomFeeUsd = enableNom && item.isCustomsClearance ? params.nomFee : 0;
    const ddpTotalUsd = cifUsd + tariffUsd + capitalCostUsd + customsFeeUsd + nomFeeUsd;
    const ddpUnitPriceUsd = safeDivide(ddpTotalUsd, purchaseQty);
    const manualQuoteUnitUsd = parseManualQuoteUnit(manualQuoteUnitValues[index]);
    const markupRate = manualQuoteUnitUsd === undefined
      ? Number(item.markupRate ?? params.markupRate)
      : ddpUnitPriceUsd > 0
        ? (manualQuoteUnitUsd / ddpUnitPriceUsd - 1) * 100
        : 0;
    return {
      cifUsd,
      purchaseTotalOriginal,
      purchaseTotalUsd,
      firstMileFreightUsd,
      igiTaxRate,
      tariffUsd,
      capitalCostUsd,
      customsFeeUsd,
      nomFeeUsd,
      ddpTotalUsd,
      ddpUnitPriceUsd,
      ddpQuoteUnitUsd: manualQuoteUnitUsd ?? ddpUnitPriceUsd * (1 + markupRate / 100),
      manualQuoteUnitUsd,
      markupRate,
      purchaseQty,
    };
  });

  const totalCifUsd = initial.reduce((sum, item) => sum + item.cifUsd, 0);
  return initial.map((item) => {
    const allocation = totalCifUsd > 0 ? params.publicFeeTotal * item.cifUsd / totalCifUsd : 0;
    const ddpTotalUsd = item.ddpTotalUsd + allocation;
    const ddpUnitPriceUsd = safeDivide(ddpTotalUsd, item.purchaseQty);
    const ddpQuoteUnitUsd = item.manualQuoteUnitUsd ?? ddpUnitPriceUsd * (1 + item.markupRate / 100);
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

function itemColumnTotal(key: string, items: CreateQuotationItemDto[], previewItems: PreviewItem[]) {
  if (key === 'productCode') return '合计';
  if (key === 'purchaseQty') return integer(items.reduce((sum, item) => sum + Number(item.purchaseQty || 0), 0));
  if (key === 'purchaseUnitPrice') return money(items.reduce((sum, item) => sum + Number(item.purchaseUnitPrice || 0), 0));
  if (!isSummableItemColumn(key)) return '';
  return money(previewItems.reduce((sum, item) => sum + Number(item[key as keyof PreviewItem] || 0), 0));
}

function isSummableItemColumn(key: string) {
  return [
    'purchaseQty',
    'purchaseUnitPrice',
    'purchaseTotalOriginal',
    'purchaseTotalUsd',
    'firstMileFreightUsd',
    'cifUsd',
    'tariffUsd',
    'capitalCostUsd',
    'customsFeeUsd',
    'nomFeeUsd',
    'ddpTotalUsd',
    'ddpUnitPriceUsd',
    'ddpQuoteUnitUsd',
    'revenueUsd',
    'operatingProfitUsd',
  ].includes(key);
}

function emptyPreview(): PreviewItem {
  return {
    cifUsd: 0,
    purchaseTotalOriginal: 0,
    purchaseTotalUsd: 0,
    firstMileFreightUsd: 0,
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
    markupRate: 0,
    purchaseQty: 0,
  };
}

function safeDivide(value: number | undefined, divisor: number) {
  return divisor ? Number(value || 0) / divisor : 0;
}

function convertPurchaseTotalToUsd(value: number, currency: string, params: Pick<typeof defaultParams, 'exchangeRateUsd' | 'exchangeRateMxn'>) {
  if (currency === 'USD') return value;
  if (currency === 'MXN') return value * Number(params.exchangeRateMxn || 0);
  return safeDivide(value, params.exchangeRateUsd);
}

function roundPreview<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key,
    typeof value === 'number' ? Math.round(value * 10_000) / 10_000 : value,
  ])) as T;
}

function money(value = 0) {
  return Number(value || 0).toFixed(2);
}

function integer(value = 0) {
  return String(Math.trunc(Number(value || 0)));
}

function numberInputValue(value: unknown) {
  return value === undefined || value === null || Number.isNaN(value) ? '' : String(value);
}

function decimalInputValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  const parsed = Number(value);
  return Number.isNaN(parsed) ? '' : String(value);
}

function parseNumberInput(value: string) {
  return value === '' ? undefined : Number(value);
}

function parseIntegerInput(value: string) {
  return value === '' ? undefined : Math.trunc(Number(value));
}

function isDecimalDraft(value: string) {
  return /^\d*(?:\.\d*)?$/.test(value);
}

function parseManualQuoteUnit(value: string | undefined) {
  if (value === undefined || value === '' || value === '.') return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function omitDraftValue<T>(values: Record<number, T>, index: number) {
  const next = { ...values };
  delete next[index];
  return next;
}

function reindexDraftValuesAfterRemove<T>(values: Record<number, T>, removedIndex: number) {
  return Object.entries(values).reduce<Record<number, T>>((next, [rawIndex, value]) => {
    const index = Number(rawIndex);
    if (index < removedIndex) next[index] = value as T;
    if (index > removedIndex) next[index - 1] = value as T;
    return next;
  }, {});
}

function percent(value = 0) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function paramLabel(key: string) {
  const labels: Record<string, string> = {
    exchangeRateUsd: 'USD汇率',
    exchangeRateMxn: '比索兑美元汇率',
    capitalCostRate: '资金成本率(%)',
    accountPeriod: '账期(月)',
    badDebtRate: '坏账率(%)',
    customsFeeRate: '清关手续费率(%)',
    vatOverseas: '海外增值税率(%)',
    markupRate: '加价率(%)',
    seaFreightRate: '海运费（CNY/方）',
    airFreightRate: '空运费（CNY/kg）',
    nomFee: 'NOM费(USD)',
    customsMiscFee: '清关杂费',
    lastMileFee: '尾程费',
    storageOperationFee: '仓储操作费',
    implementationFee: '实施费',
    publicFeeTotal: '公共费用总计',
    customerId: '客户名称',
    customerName: '客户名称',
    remark: '项目名称',
  };
  return labels[key] ?? key;
}
