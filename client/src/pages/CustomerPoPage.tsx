import { ChangeEvent, Fragment, FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { apiGet, apiWrite } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import DetailBackButton from '../components/DetailBackButton.js';
import LinkedNumber from '../components/LinkedNumber.js';
import type {
  CreateCustomerPoDto,
  Customer,
  CustomerPage,
  CustomerPo,
  CustomerPoDetail,
  CustomerPoPage,
  Product,
  ProductPage,
} from '../api.js';
import type { CreateCustomerPoItemDto, PurchaseCurrency } from '../../../shared/api.interface.js';

type CustomerPoFormItem = Omit<CreateCustomerPoItemDto, 'quantity' | 'targetUnitPrice'> & {
  quantity: string;
  targetUnitPrice: string;
};

const emptyItem = (): CustomerPoFormItem => ({
  customerSku: '',
  customerProductName: '',
  customerSpec: '',
  customerBrand: '',
  unit: 'pcs',
  quantity: '1',
  targetUnitPrice: '',
  currency: 'USD',
  imageUrl: '',
  remark: '',
  matchedProductId: '',
  matchedProductCode: '',
  matchedProductName: '',
  matchStatus: 'unmatched',
  sourceType: 'temporary',
});

const statusLabels: Record<string, string> = {
  draft: '\u8349\u7a3f',
  matched: '\u5df2\u5339\u914d',
  quoted: '\u5df2\u751f\u6210\u62a5\u4ef7',
  cancelled: '\u5df2\u4f5c\u5e9f',
};

export default function CustomerPoPage() {
  const navigate = useNavigate();
  const { id: routePoId } = useParams();
  const [pos, setPos] = useState<CustomerPo[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<CreateCustomerPoDto>(() => defaultForm());
  const [items, setItems] = useState<CustomerPoFormItem[]>([emptyItem()]);
  const [productQueries, setProductQueries] = useState<Record<number, string>>({});
  const [productMatches, setProductMatches] = useState<Record<number, Product[]>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    apiGet<CustomerPage>('/customers?page=1&pageSize=50').then((result) => setCustomers(result.items)).catch((err) => setError(err.message));
    apiGet<ProductPage>('/products?page=1&pageSize=50').then((result) => setProducts(result.items)).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!routePoId) return;
    if (routePoId === 'new') {
      setSelectedPoId('');
      setForm(defaultForm());
      setItems([emptyItem()]);
      setProductQueries({});
      setProductMatches({});
      return;
    }
    openPo(routePoId).catch((err) => setError(err.message));
  }, [routePoId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadList().catch((err) => setError(err.message));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [keyword, status, page]);

  useEffect(() => {
    const entries = Object.entries(productQueries)
      .map(([index, query]) => ({ index: Number(index), query: query.trim() }))
      .filter(({ query }) => query);
    if (!entries.length) {
      setProductMatches({});
      return;
    }
    const timer = window.setTimeout(() => {
      Promise.all(entries.map(({ query }) => apiGet<ProductPage>(`/products?keyword=${encodeURIComponent(query)}&page=1&pageSize=8`)))
        .then((pages) => {
          const next: Record<number, Product[]> = {};
          const nextProducts: Product[] = [];
          pages.forEach((page, pageIndex) => {
            next[entries[pageIndex].index] = page.items;
            nextProducts.push(...page.items);
          });
          setProductMatches(next);
          setProducts((current) => mergeProducts(current, nextProducts));
        })
        .catch((err) => setError(err.message));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [productQueries]);

  const selectedPo = useMemo(() => pos.find((po) => po.id === selectedPoId), [pos, selectedPoId]);
  const unmatchedCount = useMemo(() => items.filter((item) => !item.matchedProductId).length, [items]);
  const isDetailMode = Boolean(routePoId);

  async function loadList(nextPage = page) {
    const params = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
    if (keyword.trim()) params.set('keyword', keyword.trim());
    if (status !== 'all') params.set('status', status);
    const result = await apiGet<CustomerPoPage>(`/customer-pos?${params}`);
    setPos(result.items);
    setTotal(result.total);
    setPage(result.page);
  }

  async function openPo(id: string) {
    const detail = await apiGet<CustomerPoDetail>(`/customer-pos/${id}`);
    setSelectedPoId(id);
    setForm({
      poNo: detail.po.poNo,
      customerId: detail.po.customerId,
      customerName: detail.po.customerName,
      poDate: dateInputValue(detail.po.poDate),
      deliveryDate: dateInputValue(detail.po.deliveryDate || ''),
      currency: detail.po.currency,
      status: detail.po.status,
      remark: detail.po.remark || '',
      createdBy: detail.po.createdBy || '',
      items: [],
    });
    const nextItems = detail.items.map((item) => ({
      id: item.id,
      lineNo: item.lineNo,
      customerSku: item.customerSku || '',
      customerProductName: item.customerProductName,
      customerSpec: item.customerSpec || '',
      customerBrand: item.customerBrand || '',
      unit: item.unit || 'pcs',
      quantity: item.quantity === undefined || item.quantity === null ? '' : String(Number(item.quantity || 0)),
      targetUnitPrice: item.targetUnitPrice ? String(Number(item.targetUnitPrice || 0)) : '',
      currency: item.currency,
      imageUrl: item.imageUrl || '',
      remark: item.remark || '',
      matchedProductId: item.matchedProductId || '',
      matchedProductCode: item.matchedProductCode || '',
      matchedProductName: item.matchedProductName || '',
      matchStatus: item.matchStatus,
      matchMethod: item.matchMethod || '',
      sourceType: item.sourceType,
    }));
    setItems(nextItems);
    setProductQueries(Object.fromEntries(nextItems.map((item, index) => [
      index,
      [item.matchedProductCode, item.matchedProductName].filter(Boolean).join(' '),
    ])));
    setProductMatches({});
  }

  function newPo() {
    setSelectedPoId('');
    setForm(defaultForm());
    setItems([emptyItem()]);
    setProductQueries({});
    setProductMatches({});
    navigate('/customer-pos/new');
  }

  async function removePo(id: string) {
    if (!window.confirm('\u786e\u8ba4\u5220\u9664\u8be5\u5ba2\u6237 PO \u5417\uff1f\u5220\u9664\u540e\u5c06\u540c\u6b65\u5220\u9664 PO \u660e\u7ec6\u3002')) return;
    setLoading(true);
    setError('');
    try {
      await apiWrite<void>(`/customer-pos/${id}`, 'DELETE');
      if (selectedPoId === id) {
        setSelectedPoId('');
        setForm(defaultForm());
        setItems([emptyItem()]);
        setProductQueries({});
        setProductMatches({});
      }
      await loadList();
      setMessage('\u5ba2\u6237 PO \u5df2\u5220\u9664');
      if (routePoId === id) navigate('/customer-pos');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const selectedCustomer = customers.find((customer) => customer.id === form.customerId);
      const payload: CreateCustomerPoDto = {
        ...form,
        customerName: selectedCustomer?.name || form.customerName || '',
        items: items.map((item, index) => normalizeItemForSubmit(item, index, productQueries)),
      };
      const detail = await apiWrite<CustomerPoDetail>(selectedPoId ? `/customer-pos/${selectedPoId}` : '/customer-pos', selectedPoId ? 'PUT' : 'POST', payload);
      setSelectedPoId(detail.po.id);
      await loadList();
      await openPo(detail.po.id);
      if (!routePoId) navigate(`/customer-pos/${detail.po.id}`);
      setMessage('\u5ba2\u6237 PO \u5df2\u4fdd\u5b58');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function generateQuotation() {
    if (!selectedPoId) return;
    if (unmatchedCount) {
      const rows = items
        .map((item, index) => item.matchedProductId ? '' : ('\u7b2c ' + (index + 1) + ' \u884c ' + (item.customerProductName || '')).trim())
        .filter(Boolean)
        .join('\u3001');
      setError('\u8fd8\u6709 ' + unmatchedCount + ' \u6761\u660e\u7ec6\u672a\u5339\u914d\u7cfb\u7edf\u4ea7\u54c1\uff0c\u4e0d\u80fd\u751f\u6210\u62a5\u4ef7\u5355\uff1a' + rows);
      return;
    }
    setLoading(true);
    try {
      const result = await apiWrite<{ quotation: { id: string; quotationNo: string } }>(`/customer-pos/${selectedPoId}/generate-quotation`, 'POST');
      await loadList();
      setMessage('\u5df2\u751f\u6210\u62a5\u4ef7\u5355 ' + result.quotation.quotationNo);
      navigate(`/quotation/generate/${result.quotation.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function importPoItems(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }) : [];
      const imported = rows.map(poItemFromExcelRow).filter((item) => item.customerProductName.trim());
      if (!imported.length) {
        setError('\u5bfc\u5165\u6587\u4ef6\u4e2d\u6ca1\u6709\u53ef\u7528\u7684 PO \u660e\u7ec6');
        return;
      }
      setItems(imported);
      setProductQueries({});
      setProductMatches({});
      setMessage('\u5df2\u5bfc\u5165 ' + imported.length + ' \u6761 PO \u660e\u7ec6');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function updateItem(index: number, patch: Partial<CustomerPoFormItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function matchProduct(index: number, product: Product) {
    updateItem(index, {
      customerProductName: items[index].customerProductName || product.name,
      customerBrand: items[index].customerBrand || product.brand || '',
      unit: items[index].unit || product.unit || 'pcs',
      matchedProductId: product.id,
      matchedProductCode: product.productCode,
      matchedProductName: product.name,
      matchStatus: 'matched',
      matchMethod: 'manual',
      sourceType: 'system',
    });
    setProductQueries((current) => ({ ...current, [index]: `${product.productCode} ${product.name}` }));
    setProductMatches((current) => ({ ...current, [index]: [] }));
  }

  function changeProductQuery(index: number, value: string) {
    setProductQueries((current) => ({ ...current, [index]: value }));
    if (value.trim()) return;
    clearProductMatch(index);
  }

  function clearProductMatch(index: number) {
    setProductQueries((current) => ({ ...current, [index]: '' }));
    updateItem(index, {
      matchedProductId: '',
      matchedProductCode: '',
      matchedProductName: '',
      matchStatus: 'unmatched',
      matchMethod: '',
      sourceType: 'temporary',
    });
    setProductMatches((current) => ({ ...current, [index]: [] }));
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setProductQueries((current) => reindexRowState(current, index));
    setProductMatches((current) => reindexRowState(current, index));
  }

  function updateNumericItem(index: number, key: 'quantity' | 'targetUnitPrice', value: string) {
    updateItem(index, { [key]: normalizeNumericInput(value) } as Partial<CustomerPoFormItem>);
  }

  return (
    <section>
      <header className="page-header">
        <div className={isDetailMode ? 'detail-heading-group' : ''}>
          {isDetailMode && <DetailBackButton to="/customer-pos" label="返回客户 PO 列表" />}
          <div>
          <h1>{'\u5ba2\u6237 PO'}</h1>
          <p>{isDetailMode ? '\u7ef4\u62a4\u5ba2\u6237 PO \u57fa\u672c\u4fe1\u606f\u548c\u660e\u7ec6\uff0c\u5b8c\u6210\u4ea7\u54c1\u5339\u914d\u540e\u53ef\u751f\u6210\u62a5\u4ef7\u5355\u3002' : '\u67e5\u770b\u5ba2\u6237 PO \u5217\u8868\uff0c\u8ddf\u8e2a\u6570\u91cf\u3001\u91d1\u989d\u548c\u5173\u8054\u62a5\u4ef7\u5355\u3002'}</p>
          </div>
        </div>
        <div className="toolbar action-toolbar">
          <button type="button" onClick={newPo}>{'\u65b0\u589e PO'}</button>
          {isDetailMode && (
            <>
              <button type="button" onClick={downloadPoTemplate}>{'\u4e0b\u8f7d\u5bfc\u5165\u6a21\u677f'}</button>
              <label className="file-action">
                {'\u5bfc\u5165 PO'}
                <input type="file" accept=".xlsx,.xls" onChange={importPoItems} />
              </label>
              <button type="button" disabled={!selectedPoId || loading} onClick={generateQuotation}>{'\u751f\u6210\u62a5\u4ef7\u5355'}</button>
            </>
          )}
        </div>
      </header>

      <div className="toolbar">
        <input placeholder={"\u641c\u7d22 PO \u7f16\u53f7\u3001\u5ba2\u6237\u3001\u5907\u6ce8\u3001\u62a5\u4ef7\u5355"} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">{"\u5168\u90e8\u72b6\u6001"}</option>
          <option value="draft">{"\u8349\u7a3f"}</option>
          <option value="matched">{"\u5df2\u5339\u914d"}</option>
          <option value="quoted">{"\u5df2\u751f\u6210\u62a5\u4ef7"}</option>
          <option value="cancelled">{"\u5df2\u4f5c\u5e9f"}</option>
        </select>
      </div>

      {!isDetailMode && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PO编号</th>
                <th>客户</th>
                <th>状态</th>
                <th>PO日期</th>
                <th>交期</th>
                <th>备注</th>
                <th>数量</th>
                <th>合计金额</th>
                <th>关联报价单</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => (
                <tr key={po.id} className={po.id === selectedPoId ? 'is-selected' : ''}>
                  <td><LinkedNumber to={`/customer-pos/${po.id}`}>{po.poNo}</LinkedNumber></td>
                  <td>{po.customerName}</td>
                  <td><span className={`badge ${po.status === 'quoted' ? 'success' : ''}`}>{statusLabels[po.status] || po.status}</span></td>
                  <td>{dateInputValue(po.poDate)}</td>
                  <td>{dateInputValue(po.deliveryDate || '') || '-'}</td>
                  <td>{po.remark || '-'}</td>
                  <td className="numeric-cell">{integer(po.totalQuantity || 0)}</td>
                  <td className="numeric-cell">{number(po.totalAmount || 0)}</td>
                  <td>
                    {po.quotationNo && po.quotationId
                      ? <LinkedNumber to={`/quotation/detail/${po.quotationId}`}>{po.quotationNo}</LinkedNumber>
                      : '-'}
                  </td>
                  <td>
                    <button type="button" onClick={() => navigate('/customer-pos/' + po.id)}>{'\u67e5\u770b'}</button>
                    <button type="button" onClick={() => removePo(po.id)} disabled={loading}>{'\u5220\u9664'}</button>
                  </td>
                </tr>
              ))}
              {!pos.length && (
                <tr>
                  <td colSpan={10} className="empty-cell">闂傚倸鍊风粈渚€骞栭鈶芥稑螖閸涱厾锛欓梺鑽ゅ枑鐎氬牆鈽夐姀鐘栄囨煕閵夘垳鍒板ù婊呭亾椤ㄣ儵鎮欓懠顑胯檸闂佽娴氭禍顏堝蓟?PO</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
       )}

      {!isDetailMode && (
        <div className="pagination-bar">
          <span>共 {total} 条</span>
          <div className="pagination-actions">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button>
            <span>第 {page} / {totalPages} 页</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>下一页</button>
          </div>
        </div>
      )}

      {isDetailMode && (
        <form className="panel po-editor" onSubmit={submit}>
          <div className="form-grid">
            <label>
              {"PO\u7f16\u53f7"}
              <input value={form.poNo} onChange={(event) => setForm({ ...form, poNo: event.target.value })} placeholder={"\u7559\u7a7a\u81ea\u52a8\u751f\u6210"} />
            </label>
            <label>
              {"\u5ba2\u6237"}
              <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} required>
                <option value="">{"\u8bf7\u9009\u62e9\u5ba2\u6237"}</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.shortName || customer.name}</option>)}
              </select>
            </label>
            <label>
              {"PO\u65e5\u671f"}
              <input type="date" value={form.poDate} onChange={(event) => setForm({ ...form, poDate: event.target.value })} required />
            </label>
            <label>
              {"\u4ea4\u671f"}
              <input type="date" value={form.deliveryDate || ''} onChange={(event) => setForm({ ...form, deliveryDate: event.target.value })} />
            </label>
            <label>
              {"\u5e01\u79cd"}
              <select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as PurchaseCurrency })}>
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
                <option value="MXN">MXN</option>
              </select>
            </label>
            <label>
              {"\u5907\u6ce8"}
              <input value={form.remark || ''} onChange={(event) => setForm({ ...form, remark: event.target.value })} />
            </label>
          </div>

          <div className="section-heading">
            <h2>{"PO \u660e\u7ec6"}</h2>
            <span>{items.length} {"\u6761\u660e\u7ec6"} / {unmatchedCount} {"\u6761\u672a\u5339\u914d"}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{"\u5e8f\u53f7"}</th>
                  <th>{"\u5ba2\u6237SKU"}</th>
                  <th>{"\u5ba2\u6237\u4ea7\u54c1\u540d"}</th>
                  <th>{"\u89c4\u683c / \u54c1\u724c"}</th>
                  <th>{"\u6570\u91cf"}</th>
                  <th>{"\u76ee\u6807\u4ef7"}</th>
                  <th>{"\u5339\u914d\u7cfb\u7edf\u4ea7\u54c1"}</th>
                  <th>{"\u64cd\u4f5c"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <Fragment key={index}>
                    <tr>
                      <td>{index + 1}</td>
                      <td><input value={item.customerSku || ''} onChange={(event) => updateItem(index, { customerSku: event.target.value })} /></td>
                      <td><input required value={item.customerProductName} onChange={(event) => updateItem(index, { customerProductName: event.target.value })} /></td>
                      <td>
                        <input placeholder={"\u89c4\u683c"} value={item.customerSpec || ''} onChange={(event) => updateItem(index, { customerSpec: event.target.value })} />
                        <input placeholder={"\u54c1\u724c"} value={item.customerBrand || ''} onChange={(event) => updateItem(index, { customerBrand: event.target.value })} />
                      </td>
                      <td><input inputMode="decimal" value={item.quantity} onChange={(event) => updateNumericItem(index, 'quantity', event.target.value)} /></td>
                      <td><input inputMode="decimal" value={item.targetUnitPrice} onChange={(event) => updateNumericItem(index, 'targetUnitPrice', event.target.value)} /></td>
                      <td>
                        <div className="match-cell">
                          <input
                            placeholder={"\u641c\u7d22\u7cfb\u7edf\u4ea7\u54c1\u8fdb\u884c\u5339\u914d"}
                            value={productQueries[index] ?? [item.matchedProductCode, item.matchedProductName].filter(Boolean).join(' ')}
                            onChange={(event) => changeProductQuery(index, event.target.value)}
                          />
                          <span className={`badge ${item.matchedProductId ? 'success' : 'muted'}`}>
                            {item.matchedProductId ? `${item.matchedProductCode} ${item.matchedProductName}` : "\u672a\u5339\u914d"}
                          </span>
                          {item.matchedProductId ? (
                            <button type="button" onClick={() => clearProductMatch(index)}>{"\u53d6\u6d88\u5339\u914d"}</button>
                          ) : null}
                        </div>
                      </td>
                      <td><button type="button" onClick={() => removeItem(index)}>{"\u5220\u9664"}</button></td>
                    </tr>
                    {productMatches[index]?.length ? (
                      <tr className="po-match-panel-row">
                        <td colSpan={8}>
                          <div className="po-match-panel">
                            {productMatches[index].map((product) => (
                              <button type="button" className="po-match-option" key={product.id} onClick={() => matchProduct(index, product)}>
                                <span className="po-match-option-main">
                                  <span className="po-match-option-title">{product.productCode} - {product.name}</span>
                                  <span className="po-match-option-meta">
                                    {[product.spec, product.brand, product.unit].filter(Boolean).join(' / ') || "\u6682\u65e0\u89c4\u683c"}
                                  </span>
                                </span>
                                <span className="po-match-option-action">{"\u9009\u62e9"}</span>
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="toolbar action-toolbar">
            <button type="button" onClick={() => setItems((current) => [...current, emptyItem()])}>{"\u65b0\u589e\u660e\u7ec6"}</button>
            <button type="submit" disabled={loading}>{loading ? "\u4fdd\u5b58\u4e2d..." : "\u4fdd\u5b58 PO"}</button>
          </div>
          {selectedPo?.quotationNo && selectedPo.quotationId && (
            <p className="form-hint">{"\u5df2\u5173\u8054\u62a5\u4ef7\u5355\uff1a"}<LinkedNumber to={`/quotation/detail/${selectedPo.quotationId}`}>{selectedPo.quotationNo}</LinkedNumber></p>
          )}
        </form>
      )}

      <FeedbackDialog message={error} onClose={() => setError('')} />
      <FeedbackDialog message={message} onClose={() => setMessage('')} />
    </section>
  );
}

function downloadPoTemplate() {
  const rows = [{
    ['\u5ba2\u6237SKU']: 'CUS-SKU-001',
    ['\u5ba2\u6237\u4ea7\u54c1\u540d']: '\u5ba2\u6237\u4ea7\u54c1\u793a\u4f8b',
    ['\u89c4\u683c']: '80L',
    ['\u54c1\u724c']: '\u54c1\u724c',
    ['\u5355\u4f4d']: 'pcs',
    ['\u6570\u91cf']: 1,
    ['\u76ee\u6807\u4ef7']: 100,
    ['\u5e01\u79cd']: 'USD',
    ['\u5907\u6ce8']: '',
  }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '\u5ba2\u6237PO\u660e\u7ec6');
  XLSX.writeFile(workbook, 'customer-po-template.xlsx');
}

function defaultForm(): CreateCustomerPoDto {
  return {
    poNo: '',
    customerId: '',
    customerName: '',
    poDate: new Date().toISOString().slice(0, 10),
    deliveryDate: '',
    currency: 'USD',
    status: 'draft',
    remark: '',
    createdBy: '',
    items: [],
  };
}

function poItemFromExcelRow(row: Record<string, unknown>): CustomerPoFormItem {
  return {
    ...emptyItem(),
    customerSku: textCell(row, ['\u5ba2\u6237SKU', '\u5ba2\u6237sku', 'SKU', 'sku', 'Customer SKU']),
    customerProductName: textCell(row, ['\u5ba2\u6237\u4ea7\u54c1\u540d', '\u4ea7\u54c1\u540d\u79f0', '\u5ba2\u6237\u4ea7\u54c1\u540d\u79f0', 'Product Name', 'productName']),
    customerSpec: textCell(row, ['\u89c4\u683c', 'Spec', 'spec']),
    customerBrand: textCell(row, ['\u54c1\u724c', 'Brand', 'brand']),
    unit: textCell(row, ['\u5355\u4f4d', 'Unit', 'unit']) || 'pcs',
    quantity: normalizeNumericInput(textCell(row, ['\u6570\u91cf', 'Qty', 'qty', 'quantity'])),
    targetUnitPrice: normalizeNumericInput(textCell(row, ['\u76ee\u6807\u4ef7', '\u76ee\u6807\u5355\u4ef7', 'Target Price', 'targetUnitPrice'])),
    currency: normalizeCurrency(textCell(row, ['\u5e01\u79cd', 'Currency', 'currency'])),
    remark: textCell(row, ['\u5907\u6ce8', 'Remark', 'remark']),
  };
}

function textCell(row: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function normalizeCurrency(value: string): PurchaseCurrency {
  const normalized = value.toUpperCase();
  return normalized === 'CNY' || normalized === 'MXN' ? normalized : 'USD';
}

function mergeProducts(current: Product[], next: Product[]) {
  const map = new Map(current.map((product) => [product.id, product]));
  next.forEach((product) => map.set(product.id, product));
  return Array.from(map.values());
}

function dateInputValue(value: string) {
  return value ? value.slice(0, 10) : '';
}

function number(value: number) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function integer(value: number) {
  return Math.trunc(Number(value || 0)).toLocaleString('en-US');
}

function reindexRowState<T>(state: Record<number, T>, removedIndex: number): Record<number, T> {
  const next: Record<number, T> = {};
  for (const [key, value] of Object.entries(state)) {
    const index = Number(key);
    if (index < removedIndex) next[index] = value;
    if (index > removedIndex) next[index - 1] = value;
  }
  return next;
}

function normalizeItemForSubmit(
  item: CustomerPoFormItem,
  index: number,
  productQueries: Record<number, string>,
): CreateCustomerPoItemDto {
  const base = {
    ...item,
    lineNo: index + 1,
    quantity: Number(item.quantity || 0),
    targetUnitPrice: Number(item.targetUnitPrice || 0),
  };
  const query = productQueries[index];
  if (query !== undefined && !query.trim()) {
    return {
      ...base,
      matchedProductId: '',
      matchedProductCode: '',
      matchedProductName: '',
      matchStatus: 'unmatched',
      matchMethod: '',
      sourceType: 'temporary',
    };
  }
  return base;
}

function normalizeNumericInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  const [integerPart, ...decimalParts] = cleaned.split('.');
  const integer = integerPart.replace(/^0+(?=\d)/, '') || (cleaned.startsWith('.') ? '0' : '');
  const decimal = decimalParts.join('');
  return cleaned.includes('.') ? `${integer || '0'}.${decimal}` : integer;
}
