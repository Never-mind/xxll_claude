import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiWrite, download } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import { calculateSettlementPurchaseAmounts } from './settlement-purchase-amount.js';
import type {
  CreateSettlementAttachmentDto,
  CreateSettlementExpenseDto,
  CreateSettlementInvoiceDto,
  CreateSettlementSaleDto,
  SettlementCurrency,
  SettlementInvoiceType,
  SettlementItem,
  SettlementOrderDto,
  SettlementProjectDetail,
  UpdateSettlementExpenseDto,
  UpdateSettlementInvoiceDto,
  UpdateSettlementItemDto,
  UpdateSettlementSaleDto,
} from '../api.js';

const currencies = ['CNY', 'USD', 'MXN'] as const;
const priceTypes = [
  ['tax_excluded', '不含税价'],
  ['tax_included', '含税价'],
] as const;
const expenseTypes = [
  ['first_mile_freight', '头程运费'],
  ['customs_fee', '清关费'],
  ['labor_fee', '人力费'],
  ['equipment_service_fee', '设备服务费'],
  ['other', '其他'],
] as const;
const tabs = [
  ['detail', '项目结算详情'],
  ['invoices', '发票管理'],
  ['attachments', '附件管理'],
] as const;

export default function SettlementProjectDetailPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>('detail');
  const [detail, setDetail] = useState<SettlementProjectDetail | null>(null);
  const [draftItems, setDraftItems] = useState<SettlementItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [purchasedDrafts, setPurchasedDrafts] = useState<Record<string, UpdateSettlementItemDto>>({});
  const [expenseDrafts, setExpenseDrafts] = useState<Record<string, UpdateSettlementExpenseDto>>({});
  const [saleDrafts, setSaleDrafts] = useState<Record<string, UpdateSettlementSaleDto>>({});
  const [invoiceDrafts, setInvoiceDrafts] = useState<Record<string, UpdateSettlementInvoiceDto>>({});
  const [editingPurchasedIds, setEditingPurchasedIds] = useState<string[]>([]);
  const [editingExpenseIds, setEditingExpenseIds] = useState<string[]>([]);
  const [editingSaleIds, setEditingSaleIds] = useState<string[]>([]);
  const [expenseDraft, setExpenseDraft] = useState<CreateSettlementExpenseDto>({
    type: 'first_mile_freight',
    description: '',
    amount: 0,
    currency: 'CNY',
    priceType: 'tax_included',
    taxRate: 0,
    invoiceNo: '',
  });
  const [saleDraft, setSaleDraft] = useState<CreateSettlementSaleDto>({
    description: '',
    amount: 0,
    currency: 'USD',
    priceType: 'tax_included',
    taxRate: 0,
    invoiceNo: '',
    receivedAt: new Date().toISOString().slice(0, 10),
  });
  const [invoiceDraft, setInvoiceDraft] = useState<CreateSettlementInvoiceDto>({
    type: 'cost',
    accountPeriod: '',
    invoiceEntity: '',
    invoiceDate: '',
    invoiceNo: '',
    invoiceTotal: 0,
    invoiceTaxExcludedTotal: 0,
    taxRate: 0,
    invoiceTaxAmount: 0,
    currency: 'CNY',
    exchangeRate: 1,
  });
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [error, setError] = useState('');

  async function load() {
    if (!id) return;
    const result = await apiGet<SettlementProjectDetail>(`/settlement-projects/${id}`);
    setDetail(result);
    setDraftItems(result.unpurchasedItems);
    setEditableDrafts(result);
    setSelectedIds([]);
    setShowExpenseForm(false);
    setShowSaleForm(false);
    setEditingPurchasedIds([]);
    setEditingExpenseIds([]);
    setEditingSaleIds([]);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  const selectedItems = useMemo(
    () => draftItems.filter((item) => selectedIds.includes(item.id)),
    [draftItems, selectedIds],
  );

  async function orderSelected() {
    if (!id || !selectedItems.length) return;
    const payload: SettlementOrderDto = {
      items: selectedItems.map((item) => ({
        itemId: item.id,
        purchaseQty: Math.trunc(Number(item.purchaseQty || 0)),
        purchaseUnitPrice: Number(item.purchaseUnitPrice || 0),
        currency: item.currency,
        priceType: item.priceType,
        taxRate: Number(item.taxRate || 0),
        invoiceNo: item.invoiceNo || '',
      })),
    };
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/order`, 'POST', payload);
    applyDetail(result);
    setSelectedIds([]);
  }

  async function addExpense() {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/expenses`, 'POST', expenseDraft);
    applyDetail(result);
    setShowExpenseForm(false);
    setExpenseDraft({ ...expenseDraft, description: '', amount: 0, invoiceNo: '' });
  }

  async function addSale() {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/sales`, 'POST', saleDraft);
    applyDetail(result);
    setShowSaleForm(false);
    setSaleDraft({ ...saleDraft, description: '', amount: 0, invoiceNo: '' });
  }

  async function addInvoice() {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/invoices`, 'POST', normalizeInvoiceDraft(invoiceDraft));
    applyDetail(result);
    setInvoiceDraft({
      ...invoiceDraft,
      accountPeriod: '',
      invoiceEntity: '',
      invoiceDate: '',
      invoiceNo: '',
      invoiceTotal: 0,
      invoiceTaxExcludedTotal: 0,
      taxRate: 0,
      invoiceTaxAmount: 0,
    });
  }

  async function uploadAttachment(event: ChangeEvent<HTMLInputElement>) {
    if (!id) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('description', attachmentDescription);
      const response = await fetch(`/api/settlement-projects/${id}/attachments`, {
        method: 'POST',
        body: form,
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json() as SettlementProjectDetail;
      applyDetail(result);
      setAttachmentDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '附件上传失败');
    }
  }

  async function completeProject() {
    if (!id) return;
    if (!confirm('确认完结该项目？完结后项目状态将显示为已完成。')) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/complete`, 'POST');
    applyDetail(result);
  }

  function applyDetail(result: SettlementProjectDetail) {
    setDetail(result);
    setDraftItems(result.unpurchasedItems);
    setEditableDrafts(result);
  }

  function setEditableDrafts(result: SettlementProjectDetail) {
    setPurchasedDrafts(Object.fromEntries(result.purchasedItems.map((item) => [item.id, settlementItemDraft(item)])));
    setExpenseDrafts(Object.fromEntries(result.expenses.map((expense) => [expense.id, settlementExpenseDraft(expense)])));
    setSaleDrafts(Object.fromEntries(result.sales.map((sale) => [sale.id, settlementSaleDraft(sale)])));
    setInvoiceDrafts(Object.fromEntries(result.invoices.map((invoice) => [invoice.id, settlementInvoiceDraft(invoice)])));
  }

  function toggleEditingPurchased(itemId: string, editing: boolean) {
    setEditingPurchasedIds((current) => editing ? Array.from(new Set([...current, itemId])) : current.filter((id) => id !== itemId));
  }

  function toggleEditingExpense(expenseId: string, editing: boolean) {
    setEditingExpenseIds((current) => editing ? Array.from(new Set([...current, expenseId])) : current.filter((id) => id !== expenseId));
  }

  function toggleEditingSale(saleId: string, editing: boolean) {
    setEditingSaleIds((current) => editing ? Array.from(new Set([...current, saleId])) : current.filter((id) => id !== saleId));
  }

  function updatePurchasedDraft(itemId: string, patch: Partial<UpdateSettlementItemDto>) {
    setPurchasedDrafts((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } }));
  }

  function updateExpenseDraft(expenseId: string, patch: Partial<UpdateSettlementExpenseDto>) {
    setExpenseDrafts((current) => ({ ...current, [expenseId]: { ...current[expenseId], ...patch } }));
  }

  function updateSaleDraft(saleId: string, patch: Partial<UpdateSettlementSaleDto>) {
    setSaleDrafts((current) => ({ ...current, [saleId]: { ...current[saleId], ...patch } }));
  }

  function updateInvoiceDraft(invoiceId: string, patch: Partial<UpdateSettlementInvoiceDto>) {
    setInvoiceDrafts((current) => ({ ...current, [invoiceId]: { ...current[invoiceId], ...patch } }));
  }

  async function savePurchasedItem(itemId: string) {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/items/${itemId}`, 'PUT', purchasedDrafts[itemId]);
    applyDetail(result);
    toggleEditingPurchased(itemId, false);
  }

  async function returnPurchasedItem(itemId: string) {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/items/${itemId}/order`, 'DELETE');
    applyDetail(result);
  }

  async function saveExpense(expenseId: string) {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/expenses/${expenseId}`, 'PUT', expenseDrafts[expenseId]);
    applyDetail(result);
    toggleEditingExpense(expenseId, false);
  }

  async function deleteExpense(expenseId: string) {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/expenses/${expenseId}`, 'DELETE');
    applyDetail(result);
  }

  async function saveSale(saleId: string) {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/sales/${saleId}`, 'PUT', saleDrafts[saleId]);
    applyDetail(result);
    toggleEditingSale(saleId, false);
  }

  async function deleteSale(saleId: string) {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/sales/${saleId}`, 'DELETE');
    applyDetail(result);
  }

  async function saveInvoice(invoiceId: string) {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/invoices/${invoiceId}`, 'PUT', normalizeInvoiceDraft(invoiceDrafts[invoiceId]));
    applyDetail(result);
  }

  async function deleteInvoice(invoiceId: string) {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/invoices/${invoiceId}`, 'DELETE');
    applyDetail(result);
  }

  function updateDraft(id: string, patch: Partial<SettlementItem>) {
    setDraftItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  if (!detail) {
    return (
      <section>
        <header className="page-header">
          <div>
            <h1>项目结算详情</h1>
            <p>加载中</p>
          </div>
        </header>
        <FeedbackDialog message={error} onClose={() => setError('')} />
      </section>
    );
  }

  const { project, purchasedItems } = detail;
  const unpurchasedTotals = settlementItemTotals(draftItems, project.exchangeRateUsd, project.exchangeRateMxn);
  const purchasedTotals = settlementItemTotals(purchasedItems, project.exchangeRateUsd, project.exchangeRateMxn);
  const expenseTotals = settlementEntryTotals(detail.expenses, project.exchangeRateUsd, project.exchangeRateMxn);
  const saleTotals = settlementEntryTotals(detail.sales, project.exchangeRateUsd, project.exchangeRateMxn);

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>项目结算</h1>
          <p>{project.quotationNo} / {project.customerName || '-'}</p>
        </div>
        <div className="toolbar">
          {project.status === 'completed' ? (
            <button className="primary-action" type="button" disabled>项目已完成</button>
          ) : (
            <button className="primary-action" type="button" onClick={completeProject}>项目完结</button>
          )}
          <button type="button" onClick={() => download(`/settlement-projects/${project.id}/export`)}>导出</button>
          <Link className="button-link" to="/settlement-projects">返回列表</Link>
        </div>
      </header>
      <FeedbackDialog message={error} onClose={() => setError('')} />
      <div className="detail-tabs">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {activeTab === 'detail' && (
        <>
          <div className="settlement-metrics">
            <Metric label="采购成本(USD)" value={project.quotedPurchaseCostUsd} />
            <Metric label="已采购成本(USD)" value={project.purchasedCostUsd} />
            <Metric label="销售收入(USD)" value={project.quotedSalesRevenueUsd} />
            <Metric label="已销售收入(USD)" value={project.receivedRevenueUsd} />
            <Metric label="项目毛利(USD)" value={project.grossProfitUsd} />
          </div>
          <div className="panel">
            <div className="section-heading">
              <h2>未采购商品</h2>
              <button className="primary-action" type="button" disabled={!selectedIds.length} onClick={orderSelected}>
                下单采购
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="全选"
                        checked={draftItems.length > 0 && selectedIds.length === draftItems.length}
                        onChange={(event) => setSelectedIds(event.target.checked ? draftItems.map((item) => item.id) : [])}
                      />
                    </th>
                    <th>产品编码</th>
                    <th>产品名称</th>
                    <th>品牌</th>
                    <th>报价数量</th>
                    <th>采购数量</th>
                    <th>采购单价</th>
                    <th>采购总价</th>
                    <th>币种</th>
                    <th>价格方式</th>
                    <th>税率(%)</th>
                    <th>不含税采购金额（USD）</th>
                    <th>含税采购金额（USD）</th>
                    <th>发票号</th>
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map((item) => {
                    const amounts = settlementPurchaseAmounts(item, project.exchangeRateUsd, project.exchangeRateMxn);
                    return (
                      <tr key={item.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label="选择"
                            checked={selectedIds.includes(item.id)}
                            onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((selectedId) => selectedId !== item.id))}
                          />
                        </td>
                        <td>{item.productCode}</td>
                        <td>{item.productName}</td>
                        <td>{item.brand || '-'}</td>
                        <td className="numeric-cell">{integer(item.plannedQty)}</td>
                        <td><input type="number" step="1" value={numberInputValue(item.purchaseQty)} onChange={(event) => updateDraft(item.id, { purchaseQty: parseIntegerInput(event.target.value) } as Partial<SettlementItem>)} /></td>
                        <td><input type="number" step="any" value={decimalInputValue(item.purchaseUnitPrice)} onChange={(event) => updateDraft(item.id, { purchaseUnitPrice: parseNumberInput(event.target.value) } as Partial<SettlementItem>)} /></td>
                        <td className="numeric-cell">{money(amounts.purchaseTotal)}</td>
                        <td>
                          <select value={item.currency} onChange={(event) => updateDraft(item.id, { currency: event.target.value as SettlementItem['currency'] })}>
                            {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={item.priceType} onChange={(event) => updateDraft(item.id, { priceType: event.target.value as SettlementItem['priceType'] })}>
                            {priceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </td>
                        <td><input type="number" step="any" value={decimalInputValue(item.taxRate)} onChange={(event) => updateDraft(item.id, { taxRate: parseNumberInput(event.target.value) } as Partial<SettlementItem>)} /></td>
                        <td className="numeric-cell">{money(amounts.taxExcludedUsd)}</td>
                        <td className="numeric-cell">{money(amounts.taxIncludedUsd)}</td>
                        <td><input value={item.invoiceNo || ''} onChange={(event) => updateDraft(item.id, { invoiceNo: event.target.value })} /></td>
                      </tr>
                    );
                  })}
                  {!draftItems.length && (
                    <tr>
                      <td colSpan={14} className="empty-cell">没有未采购商品</td>
                    </tr>
                  )}
                </tbody>
                {Boolean(draftItems.length) && (
                  <tfoot>
                    <tr>
                      <td>合计</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="numeric-cell">{integer(unpurchasedTotals.plannedQty)}</td>
                      <td className="numeric-cell">{integer(unpurchasedTotals.purchaseQty)}</td>
                      <td></td>
                      <td className="numeric-cell">{money(unpurchasedTotals.purchaseTotal)}</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="numeric-cell">{money(unpurchasedTotals.taxExcludedUsd)}</td>
                      <td className="numeric-cell">{money(unpurchasedTotals.taxIncludedUsd)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          <div className="panel">
            <h2>已采购商品</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>产品编码</th>
                    <th>产品名称</th>
                    <th>品牌</th>
                    <th>报价数量</th>
                    <th>采购数量</th>
                    <th>采购单价</th>
                    <th>采购总价</th>
                    <th>币种</th>
                    <th>价格方式</th>
                    <th>税率(%)</th>
                    <th>不含税采购金额（USD）</th>
                    <th>含税采购金额（USD）</th>
                    <th>发票号</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasedItems.map((item) => {
                    const draft = purchasedDrafts[item.id] || settlementItemDraft(item);
                    const isEditing = editingPurchasedIds.includes(item.id);
                    const previewItem = { ...item, ...draft };
                    const amounts = settlementPurchaseAmounts(previewItem, project.exchangeRateUsd, project.exchangeRateMxn);
                    return (
                      <tr key={item.id}>
                        <td>{item.productCode}</td>
                        <td>{item.productName}</td>
                        <td>{item.brand || '-'}</td>
                        <td className="numeric-cell">{integer(item.plannedQty)}</td>
                        <td>{isEditing ? <input type="number" step="1" value={numberInputValue(draft.purchaseQty)} onChange={(event) => updatePurchasedDraft(item.id, { purchaseQty: parseIntegerInput(event.target.value) as number })} /> : integer(item.purchaseQty)}</td>
                        <td>{isEditing ? <input type="number" step="any" value={decimalInputValue(draft.purchaseUnitPrice)} onChange={(event) => updatePurchasedDraft(item.id, { purchaseUnitPrice: parseNumberInput(event.target.value) as number })} /> : money(item.purchaseUnitPrice)}</td>
                        <td className="numeric-cell">{money(amounts.purchaseTotal)}</td>
                        <td>
                          {isEditing ? <select value={draft.currency} onChange={(event) => updatePurchasedDraft(item.id, { currency: event.target.value as SettlementCurrency })}>
                            {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                          </select> : item.currency}
                        </td>
                        <td>
                          {isEditing ? <select value={draft.priceType} onChange={(event) => updatePurchasedDraft(item.id, { priceType: event.target.value as UpdateSettlementItemDto['priceType'] })}>
                            {priceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select> : priceTypeLabel(item.priceType)}
                        </td>
                        <td>{isEditing ? <input type="number" step="any" value={decimalInputValue(draft.taxRate)} onChange={(event) => updatePurchasedDraft(item.id, { taxRate: parseNumberInput(event.target.value) as number })} /> : money(item.taxRate)}</td>
                        <td className="numeric-cell">{money(amounts.taxExcludedUsd)}</td>
                        <td className="numeric-cell">{money(amounts.taxIncludedUsd)}</td>
                        <td>{isEditing ? <input value={draft.invoiceNo || ''} onChange={(event) => updatePurchasedDraft(item.id, { invoiceNo: event.target.value })} /> : item.invoiceNo || '-'}</td>
                        <td className="row-actions">
                          {isEditing ? (
                            <button type="button" onClick={() => savePurchasedItem(item.id)}>保存</button>
                          ) : (
                            <button type="button" onClick={() => toggleEditingPurchased(item.id, true)}>修改</button>
                          )}
                          <button type="button" onClick={() => returnPurchasedItem(item.id)}>删除</button>
                        </td>
                      </tr>
                    );
                  })}
                  {!purchasedItems.length && (
                    <tr>
                      <td colSpan={14} className="empty-cell">暂无已采购商品</td>
                    </tr>
                  )}
                </tbody>
                {Boolean(purchasedItems.length) && (
                  <tfoot>
                    <tr>
                      <td>合计</td>
                      <td></td>
                      <td></td>
                      <td className="numeric-cell">{integer(purchasedTotals.plannedQty)}</td>
                      <td className="numeric-cell">{integer(purchasedTotals.purchaseQty)}</td>
                      <td></td>
                      <td className="numeric-cell">{money(purchasedTotals.purchaseTotal)}</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="numeric-cell">{money(purchasedTotals.taxExcludedUsd)}</td>
                      <td className="numeric-cell">{money(purchasedTotals.taxIncludedUsd)}</td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="section-heading sub-section">
              <h2>其他成本费用</h2>
              <button type="button" onClick={() => setShowExpenseForm((value) => !value)}>添加费用</button>
            </div>
            {showExpenseForm && (
              <div className="inline-form-grid">
                <label>
                  <span>费用类型</span>
                  <select value={expenseDraft.type} onChange={(event) => setExpenseDraft((current) => ({ ...current, type: event.target.value as CreateSettlementExpenseDto['type'] }))}>
                    {expenseTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span>说明</span>
                  <input value={expenseDraft.description || ''} onChange={(event) => setExpenseDraft((current) => ({ ...current, description: event.target.value }))} />
                </label>
                <label>
                  <span>金额</span>
                  <input type="number" step="any" value={decimalInputValue(expenseDraft.amount)} onChange={(event) => setExpenseDraft((current) => ({ ...current, amount: parseNumberInput(event.target.value) as number }))} />
                </label>
                <label>
                  <span>币种</span>
                  <select value={expenseDraft.currency} onChange={(event) => setExpenseDraft((current) => ({ ...current, currency: event.target.value as CreateSettlementExpenseDto['currency'] }))}>
                    {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </label>
                <label>
                  <span>价格方式</span>
                  <select value={expenseDraft.priceType} onChange={(event) => setExpenseDraft((current) => ({ ...current, priceType: event.target.value as CreateSettlementExpenseDto['priceType'] }))}>
                    {priceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span>税率(%)</span>
                  <input type="number" step="any" value={decimalInputValue(expenseDraft.taxRate)} onChange={(event) => setExpenseDraft((current) => ({ ...current, taxRate: parseNumberInput(event.target.value) as number }))} />
                </label>
                <label>
                  <span>发票号</span>
                  <input value={expenseDraft.invoiceNo || ''} onChange={(event) => setExpenseDraft((current) => ({ ...current, invoiceNo: event.target.value }))} />
                </label>
                <button className="primary-action" type="button" onClick={addExpense}>保存费用</button>
              </div>
            )}
            <div className="table-wrap embedded settlement-subtable">
              <table>
                <thead>
                  <tr>
                    <th>费用类型</th>
                    <th>说明</th>
                    <th>金额</th>
                    <th>币种</th>
                    <th>价格方式</th>
                    <th>税率(%)</th>
                    <th>不含税成本（USD）</th>
                    <th>含税成本（USD）</th>
                    <th>发票号</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.expenses.map((expense) => {
                    const draft = expenseDrafts[expense.id] || settlementExpenseDraft(expense);
                    const isEditing = editingExpenseIds.includes(expense.id);
                    const amounts = settlementAmountBreakdown(draft, project.exchangeRateUsd, project.exchangeRateMxn);
                    return (
                      <tr key={expense.id}>
                        <td>
                          {isEditing ? <select value={draft.type} onChange={(event) => updateExpenseDraft(expense.id, { type: event.target.value as UpdateSettlementExpenseDto['type'] })}>
                            {expenseTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select> : expenseLabel(expense.type)}
                        </td>
                        <td>{isEditing ? <input value={draft.description || ''} onChange={(event) => updateExpenseDraft(expense.id, { description: event.target.value })} /> : expense.description || '-'}</td>
                        <td>{isEditing ? <input type="number" step="any" value={decimalInputValue(draft.amount)} onChange={(event) => updateExpenseDraft(expense.id, { amount: parseNumberInput(event.target.value) as number })} /> : money(expense.amount)}</td>
                        <td>
                          {isEditing ? <select value={draft.currency} onChange={(event) => updateExpenseDraft(expense.id, { currency: event.target.value as SettlementCurrency })}>
                            {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                          </select> : expense.currency}
                        </td>
                        <td>
                          {isEditing ? <select value={draft.priceType} onChange={(event) => updateExpenseDraft(expense.id, { priceType: event.target.value as UpdateSettlementExpenseDto['priceType'] })}>
                            {priceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select> : priceTypeLabel(expense.priceType)}
                        </td>
                        <td>{isEditing ? <input type="number" step="any" value={decimalInputValue(draft.taxRate)} onChange={(event) => updateExpenseDraft(expense.id, { taxRate: parseNumberInput(event.target.value) as number })} /> : money(expense.taxRate)}</td>
                        <td className="numeric-cell">{money(amounts.taxExcludedUsd)}</td>
                        <td className="numeric-cell">{money(amounts.taxIncludedUsd)}</td>
                        <td>{isEditing ? <input value={draft.invoiceNo || ''} onChange={(event) => updateExpenseDraft(expense.id, { invoiceNo: event.target.value })} /> : expense.invoiceNo || '-'}</td>
                        <td className="row-actions">
                          {isEditing ? (
                            <button type="button" onClick={() => saveExpense(expense.id)}>保存</button>
                          ) : (
                            <button type="button" onClick={() => toggleEditingExpense(expense.id, true)}>修改</button>
                          )}
                          <button type="button" onClick={() => deleteExpense(expense.id)}>删除</button>
                        </td>
                      </tr>
                    );
                  })}
                  {!detail.expenses.length && (
                    <tr>
                      <td colSpan={10} className="empty-cell">暂无其他成本费用</td>
                    </tr>
                  )}
                </tbody>
                {Boolean(detail.expenses.length) && (
                  <tfoot>
                    <tr>
                      <td>合计</td>
                      <td></td>
                      <td className="numeric-cell">{money(expenseTotals.amount)}</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="numeric-cell">{money(expenseTotals.taxExcludedUsd)}</td>
                      <td className="numeric-cell">{money(expenseTotals.taxIncludedUsd)}</td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="section-heading sub-section">
              <h2>销售收入明细</h2>
              <button type="button" onClick={() => setShowSaleForm((value) => !value)}>新增</button>
            </div>
            {showSaleForm && (
              <div className="inline-form-grid">
                <label>
                  <span>收入说明</span>
                  <input value={saleDraft.description || ''} onChange={(event) => setSaleDraft((current) => ({ ...current, description: event.target.value }))} />
                </label>
                <label>
                  <span>收入金额</span>
                  <input type="number" step="any" value={decimalInputValue(saleDraft.amount)} onChange={(event) => setSaleDraft((current) => ({ ...current, amount: parseNumberInput(event.target.value) as number }))} />
                </label>
                <label>
                  <span>币种</span>
                  <select value={saleDraft.currency} onChange={(event) => setSaleDraft((current) => ({ ...current, currency: event.target.value as CreateSettlementSaleDto['currency'] }))}>
                    {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </label>
                <label>
                  <span>价格方式</span>
                  <select value={saleDraft.priceType} onChange={(event) => setSaleDraft((current) => ({ ...current, priceType: event.target.value as CreateSettlementSaleDto['priceType'] }))}>
                    {priceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span>税率(%)</span>
                  <input type="number" step="any" value={decimalInputValue(saleDraft.taxRate)} onChange={(event) => setSaleDraft((current) => ({ ...current, taxRate: parseNumberInput(event.target.value) as number }))} />
                </label>
                <label>
                  <span>收款日期</span>
                  <input type="date" value={saleDraft.receivedAt?.slice(0, 10) || ''} onChange={(event) => setSaleDraft((current) => ({ ...current, receivedAt: event.target.value }))} />
                </label>
                <label>
                  <span>发票号</span>
                  <input value={saleDraft.invoiceNo || ''} onChange={(event) => setSaleDraft((current) => ({ ...current, invoiceNo: event.target.value }))} />
                </label>
                <button className="primary-action" type="button" onClick={addSale}>保存收入</button>
              </div>
            )}
            <div className="table-wrap embedded settlement-subtable">
              <table>
                <thead>
                  <tr>
                    <th>收入说明</th>
                    <th>金额</th>
                    <th>币种</th>
                    <th>价格方式</th>
                    <th>税率(%)</th>
                    <th>不含税销售收入（USD）</th>
                    <th>含税销售收入（USD）</th>
                    <th>发票号</th>
                    <th>收款日期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.sales.map((sale) => {
                    const draft = saleDrafts[sale.id] || settlementSaleDraft(sale);
                    const isEditing = editingSaleIds.includes(sale.id);
                    const amounts = settlementAmountBreakdown(draft, project.exchangeRateUsd, project.exchangeRateMxn);
                    return (
                      <tr key={sale.id}>
                        <td>{isEditing ? <input value={draft.description || ''} onChange={(event) => updateSaleDraft(sale.id, { description: event.target.value })} /> : sale.description || '-'}</td>
                        <td>{isEditing ? <input type="number" step="any" value={decimalInputValue(draft.amount)} onChange={(event) => updateSaleDraft(sale.id, { amount: parseNumberInput(event.target.value) as number })} /> : money(sale.amount)}</td>
                        <td>
                          {isEditing ? <select value={draft.currency} onChange={(event) => updateSaleDraft(sale.id, { currency: event.target.value as SettlementCurrency })}>
                            {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                          </select> : sale.currency}
                        </td>
                        <td>
                          {isEditing ? <select value={draft.priceType} onChange={(event) => updateSaleDraft(sale.id, { priceType: event.target.value as UpdateSettlementSaleDto['priceType'] })}>
                            {priceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select> : priceTypeLabel(sale.priceType)}
                        </td>
                        <td>{isEditing ? <input type="number" step="any" value={decimalInputValue(draft.taxRate)} onChange={(event) => updateSaleDraft(sale.id, { taxRate: parseNumberInput(event.target.value) as number })} /> : money(sale.taxRate)}</td>
                        <td className="numeric-cell">{money(amounts.taxExcludedUsd)}</td>
                        <td className="numeric-cell">{money(amounts.taxIncludedUsd)}</td>
                        <td>{isEditing ? <input value={draft.invoiceNo || ''} onChange={(event) => updateSaleDraft(sale.id, { invoiceNo: event.target.value })} /> : sale.invoiceNo || '-'}</td>
                        <td>{isEditing ? <input type="date" value={draft.receivedAt?.slice(0, 10) || ''} onChange={(event) => updateSaleDraft(sale.id, { receivedAt: event.target.value })} /> : new Date(sale.receivedAt).toLocaleDateString()}</td>
                        <td className="row-actions">
                          {isEditing ? (
                            <button type="button" onClick={() => saveSale(sale.id)}>保存</button>
                          ) : (
                            <button type="button" onClick={() => toggleEditingSale(sale.id, true)}>修改</button>
                          )}
                          <button type="button" onClick={() => deleteSale(sale.id)}>删除</button>
                        </td>
                      </tr>
                    );
                  })}
                  {!detail.sales.length && (
                    <tr>
                      <td colSpan={10} className="empty-cell">暂无销售收入明细</td>
                    </tr>
                  )}
                </tbody>
                {Boolean(detail.sales.length) && (
                  <tfoot>
                    <tr>
                      <td>合计</td>
                      <td className="numeric-cell">{money(saleTotals.amount)}</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="numeric-cell">{money(saleTotals.taxExcludedUsd)}</td>
                      <td className="numeric-cell">{money(saleTotals.taxIncludedUsd)}</td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
      {activeTab === 'invoices' && (
        <InvoiceManagement
          detail={detail}
          draft={invoiceDraft}
          drafts={invoiceDrafts}
          onDraftChange={setInvoiceDraft}
          onRowDraftChange={updateInvoiceDraft}
          onSave={addInvoice}
          onRowSave={saveInvoice}
          onRowDelete={deleteInvoice}
        />
      )}
      {activeTab === 'attachments' && (
        <AttachmentManagement
          detail={detail}
          description={attachmentDescription}
          onDescriptionChange={setAttachmentDescription}
          onUpload={uploadAttachment}
        />
      )}
    </section>
  );
}

function InvoiceManagement({
  detail,
  draft,
  drafts,
  onDraftChange,
  onRowDraftChange,
  onSave,
  onRowSave,
  onRowDelete,
}: {
  detail: SettlementProjectDetail;
  draft: CreateSettlementInvoiceDto;
  drafts: Record<string, UpdateSettlementInvoiceDto>;
  onDraftChange: (draft: CreateSettlementInvoiceDto) => void;
  onRowDraftChange: (invoiceId: string, patch: Partial<UpdateSettlementInvoiceDto>) => void;
  onSave: () => void;
  onRowSave: (invoiceId: string) => void;
  onRowDelete: (invoiceId: string) => void;
}) {
  const calculated = calculateInvoiceAmounts(draft);
  return (
    <div className="panel">
      <div className="section-heading">
        <h2>发票管理</h2>
        <button className="primary-action" type="button" onClick={onSave}>保存发票</button>
      </div>
      <div className="inline-form-grid">
        <label>
          <span>类型</span>
          <select value={draft.type} onChange={(event) => onDraftChange({ ...draft, type: event.target.value as SettlementInvoiceType })}>
            <option value="income">收入</option>
            <option value="cost">成本</option>
          </select>
        </label>
        <label>
          <span>账期</span>
          <input value={draft.accountPeriod || ''} onChange={(event) => onDraftChange({ ...draft, accountPeriod: event.target.value })} />
        </label>
        <label>
          <span>发票主体</span>
          <input value={draft.invoiceEntity || ''} onChange={(event) => onDraftChange({ ...draft, invoiceEntity: event.target.value })} />
        </label>
        <label>
          <span>发票日期</span>
          <input type="date" value={draft.invoiceDate || ''} onChange={(event) => onDraftChange({ ...draft, invoiceDate: event.target.value })} />
        </label>
        <label>
          <span>发票号</span>
          <input value={draft.invoiceNo || ''} onChange={(event) => onDraftChange({ ...draft, invoiceNo: event.target.value })} />
        </label>
        <label>
          <span>发票总额</span>
          <input type="number" step="any" value={numberInputValue(draft.invoiceTotal)} onChange={(event) => onDraftChange({ ...draft, invoiceTotal: parseNumberInput(event.target.value) as number })} />
        </label>
        <label>
          <span>发票不含税总额</span>
          <input value={money(calculated.invoiceTaxExcludedTotal)} readOnly />
        </label>
        <label>
          <span>税率(%)</span>
          <input type="number" step="any" value={numberInputValue(draft.taxRate)} onChange={(event) => onDraftChange({ ...draft, taxRate: parseNumberInput(event.target.value) as number })} />
        </label>
        <label>
          <span>发票税金</span>
          <input value={money(calculated.invoiceTaxAmount)} readOnly />
        </label>
        <label>
          <span>发票币种</span>
          <select value={draft.currency} onChange={(event) => onDraftChange({ ...draft, currency: event.target.value as SettlementCurrency })}>
            {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </label>
        <label>
          <span>发票汇率</span>
          <input type="number" step="any" value={numberInputValue(draft.exchangeRate)} onChange={(event) => onDraftChange({ ...draft, exchangeRate: parseNumberInput(event.target.value) as number })} />
        </label>
        <label>
          <span>美金金额</span>
          <input value={money(calculated.usdAmount)} readOnly />
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>类型</th>
              <th>账期</th>
              <th>发票主体</th>
              <th>发票日期</th>
              <th>发票号</th>
              <th>发票总额</th>
              <th>发票不含税总额</th>
              <th>税率(%)</th>
              <th>发票税金</th>
              <th>发票币种</th>
              <th>发票汇率</th>
              <th>美金金额</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {detail.invoices.map((invoice) => {
              const rowDraft = drafts[invoice.id] || settlementInvoiceDraft(invoice);
              const rowCalculated = calculateInvoiceAmounts(rowDraft);
              return (
                <tr key={invoice.id}>
                  <td>
                    <select value={rowDraft.type} onChange={(event) => onRowDraftChange(invoice.id, { type: event.target.value as SettlementInvoiceType })}>
                      <option value="income">收入</option>
                      <option value="cost">成本</option>
                    </select>
                  </td>
                  <td><input value={rowDraft.accountPeriod || ''} onChange={(event) => onRowDraftChange(invoice.id, { accountPeriod: event.target.value })} /></td>
                  <td><input value={rowDraft.invoiceEntity || ''} onChange={(event) => onRowDraftChange(invoice.id, { invoiceEntity: event.target.value })} /></td>
                  <td><input type="date" value={rowDraft.invoiceDate || ''} onChange={(event) => onRowDraftChange(invoice.id, { invoiceDate: event.target.value })} /></td>
                  <td><input value={rowDraft.invoiceNo || ''} onChange={(event) => onRowDraftChange(invoice.id, { invoiceNo: event.target.value })} /></td>
                  <td><input type="number" step="any" value={numberInputValue(rowDraft.invoiceTotal)} onChange={(event) => onRowDraftChange(invoice.id, { invoiceTotal: parseNumberInput(event.target.value) as number })} /></td>
                  <td className="numeric-cell">{money(rowCalculated.invoiceTaxExcludedTotal)}</td>
                  <td><input type="number" step="any" value={numberInputValue(rowDraft.taxRate)} onChange={(event) => onRowDraftChange(invoice.id, { taxRate: parseNumberInput(event.target.value) as number })} /></td>
                  <td className="numeric-cell">{money(rowCalculated.invoiceTaxAmount)}</td>
                  <td>
                    <select value={rowDraft.currency} onChange={(event) => onRowDraftChange(invoice.id, { currency: event.target.value as SettlementCurrency })}>
                      {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                    </select>
                  </td>
                  <td><input type="number" step="any" value={numberInputValue(rowDraft.exchangeRate)} onChange={(event) => onRowDraftChange(invoice.id, { exchangeRate: parseNumberInput(event.target.value) as number })} /></td>
                  <td className="numeric-cell">{money(rowCalculated.usdAmount)}</td>
                  <td className="row-actions">
                    <button type="button" onClick={() => onRowSave(invoice.id)}>保存</button>
                    <button type="button" onClick={() => onRowDelete(invoice.id)}>删除</button>
                  </td>
                </tr>
              );
            })}
            {!detail.invoices.length && (
              <tr>
                <td colSpan={13} className="empty-cell">暂无发票信息</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttachmentManagement({
  detail,
  description,
  onDescriptionChange,
  onUpload,
}: {
  detail: SettlementProjectDetail;
  description: string;
  onDescriptionChange: (value: string) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="panel">
      <div className="section-heading">
        <h2>附件管理</h2>
        <label className="file-action">
          上传附件
          <input type="file" onChange={onUpload} />
        </label>
      </div>
      <div className="inline-form-grid">
        <label>
          <span>附件说明</span>
          <input value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>文件名</th>
              <th>类型</th>
              <th>大小</th>
              <th>说明</th>
              <th>上传时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {detail.attachments.map((attachment) => (
              <tr key={attachment.id}>
                <td>{attachment.fileName}</td>
                <td>{attachment.fileType || '-'}</td>
                <td className="numeric-cell">{formatFileSize(attachment.fileSize)}</td>
                <td>{attachment.description || '-'}</td>
                <td>{new Date(attachment.uploadedAt).toLocaleString()}</td>
                <td><a href={attachment.dataUrl} download={attachment.fileName}>下载</a></td>
              </tr>
            ))}
            {!detail.attachments.length && (
              <tr>
                <td colSpan={6} className="empty-cell">暂无附件</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}

function settlementPurchaseAmounts(item: SettlementItem, exchangeRateUsd: number, exchangeRateMxn: number) {
  return calculateSettlementPurchaseAmounts({
    purchaseQty: item.purchaseQty,
    purchaseUnitPrice: item.purchaseUnitPrice,
    currency: item.currency,
    priceType: item.priceType,
    taxRate: item.taxRate,
    exchangeRateUsd,
    exchangeRateMxn,
  });
}

function settlementAmountBreakdown(
  item: { amount: number; currency: SettlementItem['currency']; priceType: SettlementItem['priceType']; taxRate: number },
  exchangeRateUsd: number,
  exchangeRateMxn: number,
) {
  return calculateSettlementPurchaseAmounts({
    purchaseQty: 1,
    purchaseUnitPrice: item.amount,
    currency: item.currency,
    priceType: item.priceType,
    taxRate: item.taxRate,
    exchangeRateUsd,
    exchangeRateMxn,
  });
}

function settlementItemTotals(items: SettlementItem[], exchangeRateUsd: number, exchangeRateMxn: number) {
  return items.reduce((totals, item) => {
    const amounts = settlementPurchaseAmounts(item, exchangeRateUsd, exchangeRateMxn);
    totals.plannedQty += Number(item.plannedQty || 0);
    totals.purchaseQty += Number(item.purchaseQty || 0);
    totals.purchaseTotal += amounts.purchaseTotal;
    totals.taxExcludedUsd += amounts.taxExcludedUsd;
    totals.taxIncludedUsd += amounts.taxIncludedUsd;
    return totals;
  }, {
    plannedQty: 0,
    purchaseQty: 0,
    purchaseTotal: 0,
    taxExcludedUsd: 0,
    taxIncludedUsd: 0,
  });
}

function settlementEntryTotals(
  items: Array<{ amount: number; currency: SettlementItem['currency']; priceType: SettlementItem['priceType']; taxRate: number }>,
  exchangeRateUsd: number,
  exchangeRateMxn: number,
) {
  return items.reduce((totals, item) => {
    const amounts = settlementAmountBreakdown(item, exchangeRateUsd, exchangeRateMxn);
    totals.amount += Number(item.amount || 0);
    totals.taxExcludedUsd += amounts.taxExcludedUsd;
    totals.taxIncludedUsd += amounts.taxIncludedUsd;
    return totals;
  }, {
    amount: 0,
    taxExcludedUsd: 0,
    taxIncludedUsd: 0,
  });
}

function settlementItemDraft(item: SettlementItem): UpdateSettlementItemDto {
  return {
    purchaseQty: item.purchaseQty,
    purchaseUnitPrice: item.purchaseUnitPrice,
    currency: item.currency,
    priceType: item.priceType,
    taxRate: item.taxRate,
    invoiceNo: item.invoiceNo || '',
  };
}

function settlementExpenseDraft(expense: {
  type: UpdateSettlementExpenseDto['type'];
  description?: string;
  amount: number;
  currency: SettlementCurrency;
  priceType: UpdateSettlementExpenseDto['priceType'];
  taxRate: number;
  invoiceNo?: string;
}): UpdateSettlementExpenseDto {
  return {
    type: expense.type,
    description: expense.description || '',
    amount: expense.amount,
    currency: expense.currency,
    priceType: expense.priceType,
    taxRate: expense.taxRate,
    invoiceNo: expense.invoiceNo || '',
  };
}

function settlementSaleDraft(sale: {
  description?: string;
  amount: number;
  currency: SettlementCurrency;
  priceType: UpdateSettlementSaleDto['priceType'];
  taxRate: number;
  invoiceNo?: string;
  receivedAt?: string;
}): UpdateSettlementSaleDto {
  return {
    description: sale.description || '',
    amount: sale.amount,
    currency: sale.currency,
    priceType: sale.priceType,
    taxRate: sale.taxRate,
    invoiceNo: sale.invoiceNo || '',
    receivedAt: sale.receivedAt?.slice(0, 10) || '',
  };
}

function settlementInvoiceDraft(invoice: {
  type: SettlementInvoiceType;
  accountPeriod?: string;
  invoiceEntity?: string;
  invoiceDate?: string;
  invoiceNo?: string;
  invoiceTotal: number;
  invoiceTaxExcludedTotal: number;
  taxRate: number;
  invoiceTaxAmount: number;
  currency: SettlementCurrency;
  exchangeRate: number;
}): UpdateSettlementInvoiceDto {
  return {
    type: invoice.type,
    accountPeriod: invoice.accountPeriod || '',
    invoiceEntity: invoice.invoiceEntity || '',
    invoiceDate: invoice.invoiceDate || '',
    invoiceNo: invoice.invoiceNo || '',
    invoiceTotal: invoice.invoiceTotal,
    invoiceTaxExcludedTotal: invoice.invoiceTaxExcludedTotal,
    taxRate: invoice.taxRate,
    invoiceTaxAmount: invoice.invoiceTaxAmount,
    currency: invoice.currency,
    exchangeRate: invoice.exchangeRate,
  };
}

function calculateInvoiceAmounts(draft: CreateSettlementInvoiceDto) {
  const invoiceTotal = Number(draft.invoiceTotal || 0);
  const taxRate = Number(draft.taxRate || 0);
  const exchangeRate = Number(draft.exchangeRate || 0);
  const invoiceTaxExcludedTotal = taxRate === -100 ? 0 : invoiceTotal / (1 + taxRate / 100);
  const invoiceTaxAmount = invoiceTaxExcludedTotal * (taxRate / 100);
  const unsignedUsdAmount = exchangeRate ? invoiceTaxExcludedTotal / exchangeRate : 0;
  return {
    invoiceTaxExcludedTotal,
    invoiceTaxAmount,
    usdAmount: draft.type === 'cost' ? -Math.abs(unsignedUsdAmount) : Math.abs(unsignedUsdAmount),
  };
}

function normalizeInvoiceDraft(draft: CreateSettlementInvoiceDto): CreateSettlementInvoiceDto {
  const calculated = calculateInvoiceAmounts(draft);
  return {
    ...draft,
    invoiceTotal: Number(draft.invoiceTotal || 0),
    taxRate: Number(draft.taxRate || 0),
    exchangeRate: Number(draft.exchangeRate || 0),
    invoiceTaxExcludedTotal: calculated.invoiceTaxExcludedTotal,
    invoiceTaxAmount: calculated.invoiceTaxAmount,
  };
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function formatFileSize(value = 0) {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${money(size / 1024 / 1024)} MB`;
  if (size >= 1024) return `${money(size / 1024)} KB`;
  return `${integer(size)} B`;
}

function priceTypeLabel(value: string) {
  return value === 'tax_excluded' ? '不含税价' : '含税价';
}

function expenseLabel(type: string) {
  const match = expenseTypes.find(([value]) => value === type);
  return match?.[1] || type;
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
