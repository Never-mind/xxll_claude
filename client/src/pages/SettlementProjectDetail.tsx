import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet, apiWrite, download } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import DetailBackButton from '../components/DetailBackButton.js';
import LinkedNumber from '../components/LinkedNumber.js';
import { calculateSettlementPurchaseAmounts, summarizeSettlementOrderItems } from './settlement-purchase-amount.js';
import { formatMoney } from '../utils/display.js';
import type {
  CreateSettlementExpenseDto,
  CreateSettlementInvoiceDto,
  CreateSettlementSaleDto,
  SettlementCurrency,
  SettlementInvoiceType,
  SettlementItem,
  SettlementOrderDto,
  SettlementProjectDetail,
  SettlementProjectDetailPage,
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

type AttachmentUploadProgress = {
  fileName: string;
  fileType: string;
  fileSize: number;
  description: string;
  percent: number;
  status: 'uploading' | 'done';
};

type DetailPageSection = 'unpurchased' | 'purchased' | 'expenses' | 'sales' | 'invoices' | 'attachments';

export default function SettlementProjectDetailPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>('detail');
  const [detail, setDetail] = useState<SettlementProjectDetailPage | null>(null);
  const [detailPages, setDetailPages] = useState({
    unpurchased: 1,
    purchased: 1,
    expenses: 1,
    sales: 1,
    invoices: 1,
    attachments: 1,
  });
  const detailPageSize = 10;
  const [draftItems, setDraftItems] = useState<SettlementItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showOrderConfirm, setShowOrderConfirm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [purchasedDrafts, setPurchasedDrafts] = useState<Record<string, UpdateSettlementItemDto>>({});
  const [expenseDrafts, setExpenseDrafts] = useState<Record<string, UpdateSettlementExpenseDto>>({});
  const [saleDrafts, setSaleDrafts] = useState<Record<string, UpdateSettlementSaleDto>>({});
  const [invoiceDrafts, setInvoiceDrafts] = useState<Record<string, UpdateSettlementInvoiceDto>>({});
  const [editingPurchasedIds, setEditingPurchasedIds] = useState<string[]>([]);
  const [editingExpenseIds, setEditingExpenseIds] = useState<string[]>([]);
  const [editingSaleIds, setEditingSaleIds] = useState<string[]>([]);
  const [editingInvoiceIds, setEditingInvoiceIds] = useState<string[]>([]);
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
    accountingDate: '',
    companyEntity: '',
    invoiceEntity: '',
    invoiceDate: '',
    invoiceNo: '',
    invoiceTotal: 0,
    invoiceTaxExcludedTotal: 0,
    taxRate: 0,
    invoiceTaxAmount: 0,
    currency: 'CNY',
    exchangeRate: 1,
    isPaid: false,
  });
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [error, setError] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState<AttachmentUploadProgress | null>(null);

  async function load(nextPages = detailPages) {
    if (!id) return;
    const params = new URLSearchParams({
      itemsPage: '1',
      unpurchasedPage: String(nextPages.unpurchased),
      purchasedPage: String(nextPages.purchased),
      expensesPage: String(nextPages.expenses),
      salesPage: String(nextPages.sales),
      invoicesPage: String(nextPages.invoices),
      attachmentsPage: String(nextPages.attachments),
      pageSize: String(detailPageSize),
    });
    const result = await apiGet<SettlementProjectDetailPage>(`/settlement-projects/${id}?${params}`);
    setDetail(result);
    setDetailPages({
      unpurchased: result.unpurchasedItems.page,
      purchased: result.purchasedItems.page,
      expenses: result.expenses.page,
      sales: result.sales.page,
      invoices: result.invoices.page,
      attachments: result.attachments.page,
    });
    setDraftItems(result.unpurchasedItems.items);
    setEditableDrafts(result);
    setSelectedIds([]);
    setShowOrderConfirm(false);
    setShowExpenseForm(false);
    setShowSaleForm(false);
    setEditingPurchasedIds([]);
    setEditingExpenseIds([]);
    setEditingSaleIds([]);
    setEditingInvoiceIds([]);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  const selectedItems = useMemo(
    () => draftItems.filter((item) => selectedIds.includes(item.id)),
    [draftItems, selectedIds],
  );
  const selectedOrderSummary = useMemo(
    () => detail ? summarizeSettlementOrderItems(selectedItems, detail.project.exchangeRateUsd, detail.project.exchangeRateMxn) : emptyOrderSummary(),
    [detail, selectedItems],
  );

  async function orderSelected() {
    if (!id || !selectedItems.length) return;
    setOrdering(true);
    setError('');
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
    try {
      const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/order`, 'POST', payload);
      applyDetail(result);
      setSelectedIds([]);
      setShowOrderConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '下单采购失败');
    } finally {
      setOrdering(false);
    }
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
      accountingDate: '',
      companyEntity: '',
      invoiceEntity: '',
      invoiceDate: '',
      invoiceNo: '',
      invoiceTotal: 0,
      invoiceTaxExcludedTotal: 0,
      taxRate: 0,
      invoiceTaxAmount: 0,
      isPaid: false,
    });
  }

  async function uploadAttachment(event: ChangeEvent<HTMLInputElement>) {
    if (!id) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('附件大小不能超过 10MB');
      return;
    }
    setUploadingAttachment(true);
    setAttachmentUploadProgress({
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      description: attachmentDescription,
      percent: 0,
      status: 'uploading',
    });
    setError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const [, base64 = ''] = dataUrl.split(',');
      setAttachmentUploadProgress((current) => current ? { ...current, percent: 5 } : current);
      const created = await apiWrite<{ attachment: { id: string } }>(`/settlement-projects/${id}/attachments`, 'POST', {
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        description: attachmentDescription,
      });
      const chunks = chunkString(base64, 256 * 1024);
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        await apiWrite(`/settlement-projects/${id}/attachments/${created.attachment.id}/chunk`, 'PUT', { chunk });
        const percent = chunks.length ? Math.round(((index + 1) / chunks.length) * 90) + 5 : 95;
        setAttachmentUploadProgress((current) => current ? { ...current, percent: Math.min(percent, 95) } : current);
      }
      await load();
      setAttachmentUploadProgress((current) => current ? { ...current, percent: 100, status: 'done' } : current);
      setAttachmentDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '附件上传失败');
    } finally {
      setUploadingAttachment(false);
      window.setTimeout(() => setAttachmentUploadProgress(null), 3000);
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/attachments/${attachmentId}`, 'DELETE');
    applyDetail(result);
  }

  async function completeProject() {
    if (!id) return;
    if (!confirm('确认完结该项目？完结后项目状态将显示为已完成。')) return;
    const result = await apiWrite<SettlementProjectDetail>(`/settlement-projects/${id}/complete`, 'POST');
    applyDetail(result);
  }

  function applyDetail(_result: SettlementProjectDetail) {
    void load();
  }

  function setEditableDrafts(result: SettlementProjectDetailPage) {
    setPurchasedDrafts(Object.fromEntries(result.purchasedItems.items.map((item) => [item.id, settlementItemDraft(item)])));
    setExpenseDrafts(Object.fromEntries(result.expenses.items.map((expense) => [expense.id, settlementExpenseDraft(expense)])));
    setSaleDrafts(Object.fromEntries(result.sales.items.map((sale) => [sale.id, settlementSaleDraft(sale)])));
    setInvoiceDrafts(Object.fromEntries(result.invoices.items.map((invoice) => [invoice.id, settlementInvoiceDraft(invoice)])));
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

  function toggleEditingInvoice(invoiceId: string, editing: boolean) {
    setEditingInvoiceIds((current) => editing ? Array.from(new Set([...current, invoiceId])) : current.filter((id) => id !== invoiceId));
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
    toggleEditingInvoice(invoiceId, false);
  }

  async function toggleInvoicePaid(invoiceId: string, isPaid: boolean) {
    if (!id) return;
    const result = await apiWrite<SettlementProjectDetail>(
      `/settlement-projects/${id}/invoices/${invoiceId}`,
      'PUT',
      normalizeInvoiceDraft({ ...invoiceDrafts[invoiceId], isPaid }),
    );
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

  function changeDetailPage(section: DetailPageSection, nextPage: number) {
    const nextPages = { ...detailPages, [section]: Math.max(1, nextPage) };
    setDetailPages(nextPages);
    void load(nextPages).catch((err) => setError(err instanceof Error ? err.message : '加载分页数据失败'));
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

  const { project } = detail;
  const purchasedItems = detail.purchasedItems.items;
  const expenses = detail.expenses.items;
  const sales = detail.sales.items;
  const invoices = detail.invoices.items;
  const attachments = detail.attachments.items;
  const unpurchasedTotals = settlementItemTotals(draftItems, project.exchangeRateUsd, project.exchangeRateMxn);
  const purchasedTotals = settlementItemTotals(purchasedItems, project.exchangeRateUsd, project.exchangeRateMxn);
  const expenseTotals = settlementEntryTotals(expenses, project.exchangeRateUsd, project.exchangeRateMxn);
  const saleTotals = settlementEntryTotals(sales, project.exchangeRateUsd, project.exchangeRateMxn);

  return (
    <section>
      <header className="page-header">
        <div className="detail-heading-group">
          <DetailBackButton to="/settlement-projects" label="返回项目结算列表" />
          <div>
          <h1>项目结算</h1>
            <p><strong className="project-number">{project.projectNo}</strong>{' / '}<LinkedNumber to={`/quotation/detail/${project.quotationId}`}>{project.quotationNo}</LinkedNumber>{' / '}{project.customerName || '-'} / 承接单位：{project.contractingEntityName || '未设置'}</p>
          </div>
        </div>
        <div className="toolbar">
          {project.status === 'completed' ? (
            <button className="primary-action" type="button" disabled>项目已完成</button>
          ) : (
            <button className="primary-action" type="button" onClick={completeProject}>项目完结</button>
          )}
          <button type="button" onClick={() => download(`/settlement-projects/${project.id}/export`)}>导出</button>
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
              <button className="primary-action" type="button" disabled={!selectedIds.length || ordering} onClick={() => setShowOrderConfirm(true)}>
                {ordering ? '下单中...' : '下单采购'}
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        className="selection-checkbox"
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
                      <tr key={item.id} className={`selection-row ${selectedIds.includes(item.id) ? 'is-selected' : ''}`}>
                        <td>
                          <input
                            type="checkbox"
                            className="selection-checkbox"
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
            <DetailPagination page={detail.unpurchasedItems.page} total={detail.unpurchasedItems.total} onChange={(page) => changeDetailPage('unpurchased', page)} />
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
            <DetailPagination page={detail.purchasedItems.page} total={detail.purchasedItems.total} onChange={(page) => changeDetailPage('purchased', page)} />
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
                  {expenses.map((expense) => {
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
                  {!expenses.length && (
                    <tr>
                      <td colSpan={10} className="empty-cell">暂无其他成本费用</td>
                    </tr>
                  )}
                </tbody>
                {Boolean(expenses.length) && (
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
            <DetailPagination page={detail.expenses.page} total={detail.expenses.total} onChange={(page) => changeDetailPage('expenses', page)} />
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
                  {sales.map((sale) => {
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
                  {!sales.length && (
                    <tr>
                      <td colSpan={10} className="empty-cell">暂无销售收入明细</td>
                    </tr>
                  )}
                </tbody>
                {Boolean(sales.length) && (
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
            <DetailPagination page={detail.sales.page} total={detail.sales.total} onChange={(page) => changeDetailPage('sales', page)} />
          </div>
        </>
      )}
      {activeTab === 'invoices' && (
        <InvoiceManagement
          detail={detail}
          draft={invoiceDraft}
          drafts={invoiceDrafts}
          editingIds={editingInvoiceIds}
          onDraftChange={setInvoiceDraft}
          onRowDraftChange={updateInvoiceDraft}
          onSave={addInvoice}
          onRowEdit={(invoiceId) => toggleEditingInvoice(invoiceId, true)}
          onRowSave={saveInvoice}
          onPaidToggle={toggleInvoicePaid}
           onRowDelete={deleteInvoice}
          page={detail.invoices.page}
          total={detail.invoices.total}
          onPageChange={(page) => changeDetailPage('invoices', page)}
         />
      )}
      {activeTab === 'attachments' && (
        <AttachmentManagement
          detail={detail}
          description={attachmentDescription}
          progress={attachmentUploadProgress}
          uploading={uploadingAttachment}
          onDescriptionChange={setAttachmentDescription}
          onUpload={uploadAttachment}
           onDelete={deleteAttachment}
          page={detail.attachments.page}
          total={detail.attachments.total}
          onPageChange={(page) => changeDetailPage('attachments', page)}
         />
      )}
      {activeTab === 'detail' && selectedItems.length ? (
        <OrderFloatingSummary
          ordering={ordering}
          summary={selectedOrderSummary}
          onClear={() => setSelectedIds([])}
          onConfirm={() => setShowOrderConfirm(true)}
        />
      ) : null}
      {showOrderConfirm ? (
        <OrderConfirmDialog
          items={selectedItems}
          ordering={ordering}
          summary={selectedOrderSummary}
          exchangeRateUsd={project.exchangeRateUsd}
          exchangeRateMxn={project.exchangeRateMxn}
          onCancel={() => setShowOrderConfirm(false)}
          onConfirm={orderSelected}
        />
      ) : null}
    </section>
  );
}

function InvoiceManagement({
  detail,
  draft,
  drafts,
  editingIds,
  onDraftChange,
  onRowDraftChange,
  onSave,
  onRowEdit,
  onRowSave,
  onPaidToggle,
  onRowDelete,
  page,
  total,
  onPageChange,
}: {
  detail: SettlementProjectDetailPage;
  draft: CreateSettlementInvoiceDto;
  drafts: Record<string, UpdateSettlementInvoiceDto>;
  editingIds: string[];
  onDraftChange: (draft: CreateSettlementInvoiceDto) => void;
  onRowDraftChange: (invoiceId: string, patch: Partial<UpdateSettlementInvoiceDto>) => void;
  onSave: () => void;
  onRowEdit: (invoiceId: string) => void;
  onRowSave: (invoiceId: string) => void;
  onPaidToggle: (invoiceId: string, isPaid: boolean) => void;
  onRowDelete: (invoiceId: string) => void;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const calculated = calculateInvoiceAmounts(draft);
  const invoices = detail.invoices.items;
  return (
    <div className="panel">
      <div className="section-heading">
        <h2>发票管理</h2>
        <button className="primary-action" type="button" onClick={onSave}>新增发票</button>
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
          <input type="date" value={draft.accountPeriod || ''} onChange={(event) => onDraftChange({ ...draft, accountPeriod: event.target.value })} />
        </label>
        <label>
          <span>财务记账日期</span>
          <input type="date" value={draft.accountingDate || ''} onChange={(event) => onDraftChange({ ...draft, accountingDate: event.target.value })} />
        </label>
        <label>
          <span>公司主体</span>
          <input value={draft.companyEntity || ''} onChange={(event) => onDraftChange({ ...draft, companyEntity: event.target.value })} />
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
        <label>
          <span>是否支付</span>
          <PaidSwitch checked={Boolean(draft.isPaid)} onChange={(checked) => onDraftChange({ ...draft, isPaid: checked })} />
        </label>
      </div>
      <div className="table-wrap invoice-table-wrap">
        <table>
          <thead>
            <tr>
              <th className="invoice-type-col">类型</th>
              <th>账期</th>
              <th>财务记账日期</th>
              <th>公司主体</th>
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
              <th className="invoice-paid-col">是否支付</th>
              <th className="invoice-actions-col">操作</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const isEditing = editingIds.includes(invoice.id);
              const rowDraft = drafts[invoice.id] || settlementInvoiceDraft(invoice);
              const rowCalculated = calculateInvoiceAmounts(rowDraft);
              return (
                <tr key={invoice.id}>
                  <td className="invoice-type-col">{isEditing ? (
                    <select value={rowDraft.type} onChange={(event) => onRowDraftChange(invoice.id, { type: event.target.value as SettlementInvoiceType })}>
                      <option value="income">收入</option>
                      <option value="cost">成本</option>
                    </select>
                  ) : invoiceTypeLabel(invoice.type)}</td>
                  <td>{isEditing ? <input type="date" value={rowDraft.accountPeriod || ''} onChange={(event) => onRowDraftChange(invoice.id, { accountPeriod: event.target.value })} /> : invoice.accountPeriod || '-'}</td>
                  <td>{isEditing ? <input type="date" value={rowDraft.accountingDate || ''} onChange={(event) => onRowDraftChange(invoice.id, { accountingDate: event.target.value })} /> : invoice.accountingDate || '-'}</td>
                  <td>{isEditing ? <input value={rowDraft.companyEntity || ''} onChange={(event) => onRowDraftChange(invoice.id, { companyEntity: event.target.value })} /> : invoice.companyEntity || '-'}</td>
                  <td>{isEditing ? <input value={rowDraft.invoiceEntity || ''} onChange={(event) => onRowDraftChange(invoice.id, { invoiceEntity: event.target.value })} /> : invoice.invoiceEntity || '-'}</td>
                  <td>{isEditing ? <input type="date" value={rowDraft.invoiceDate || ''} onChange={(event) => onRowDraftChange(invoice.id, { invoiceDate: event.target.value })} /> : invoice.invoiceDate || '-'}</td>
                  <td>{isEditing ? <input value={rowDraft.invoiceNo || ''} onChange={(event) => onRowDraftChange(invoice.id, { invoiceNo: event.target.value })} /> : invoice.invoiceNo || '-'}</td>
                  <td>{isEditing ? <input type="number" step="any" value={numberInputValue(rowDraft.invoiceTotal)} onChange={(event) => onRowDraftChange(invoice.id, { invoiceTotal: parseNumberInput(event.target.value) as number })} /> : money(invoice.invoiceTotal)}</td>
                  <td className="numeric-cell">{money(isEditing ? rowCalculated.invoiceTaxExcludedTotal : invoice.invoiceTaxExcludedTotal)}</td>
                  <td>{isEditing ? <input type="number" step="any" value={numberInputValue(rowDraft.taxRate)} onChange={(event) => onRowDraftChange(invoice.id, { taxRate: parseNumberInput(event.target.value) as number })} /> : money(invoice.taxRate)}</td>
                  <td className="numeric-cell">{money(isEditing ? rowCalculated.invoiceTaxAmount : invoice.invoiceTaxAmount)}</td>
                  <td>{isEditing ? (
                    <select value={rowDraft.currency} onChange={(event) => onRowDraftChange(invoice.id, { currency: event.target.value as SettlementCurrency })}>
                      {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                    </select>
                  ) : invoice.currency}</td>
                  <td>{isEditing ? <input type="number" step="any" value={numberInputValue(rowDraft.exchangeRate)} onChange={(event) => onRowDraftChange(invoice.id, { exchangeRate: parseNumberInput(event.target.value) as number })} /> : money(invoice.exchangeRate)}</td>
                  <td className="numeric-cell">{money(isEditing ? rowCalculated.usdAmount : invoice.usdAmount)}</td>
                  <td className="invoice-paid-col">
                    <PaidSwitch
                      checked={Boolean(isEditing ? rowDraft.isPaid : invoice.isPaid)}
                      onChange={(checked) => {
                        onRowDraftChange(invoice.id, { isPaid: checked });
                        if (!isEditing) onPaidToggle(invoice.id, checked);
                      }}
                    />
                  </td>
                  <td className="row-actions invoice-actions-col">
                    {isEditing ? (
                      <button type="button" onClick={() => onRowSave(invoice.id)}>保存</button>
                    ) : (
                      <button type="button" onClick={() => onRowEdit(invoice.id)}>修改</button>
                    )}
                    <button type="button" onClick={() => onRowDelete(invoice.id)}>删除</button>
                  </td>
                </tr>
              );
            })}
            {!invoices.length && (
              <tr>
                <td colSpan={15} className="empty-cell">暂无发票明细</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type OrderSummary = ReturnType<typeof summarizeSettlementOrderItems>;

function OrderFloatingSummary({
  ordering,
  summary,
  onClear,
  onConfirm,
}: {
  ordering: boolean;
  summary: OrderSummary;
  onClear: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="order-floating-summary" role="status">
      <div className="order-floating-metrics">
        <span>{`\u5df2\u9009 ${summary.itemCount} \u9879`}</span>
        <strong>{`\u603b\u6570\u91cf ${integer(summary.purchaseQty)}`}</strong>
        <span>{formatCurrencyTotals(summary.totalsByCurrency)}</span>
        <span>{`\u4e0d\u542b\u7a0e USD ${money(summary.taxExcludedUsd)}`}</span>
      </div>
      <div className="order-floating-actions">
        <button type="button" onClick={onClear}>{"\u6e05\u7a7a\u9009\u62e9"}</button>
        <button className="primary-action" type="button" disabled={ordering} onClick={onConfirm}>
          {ordering ? "\u4e0b\u5355\u4e2d..." : "\u786e\u8ba4\u4e0b\u5355"}
        </button>
      </div>
      <DetailPagination page={page} total={total} onChange={onPageChange} />
    </div>
  );
}

function OrderConfirmDialog({
  items,
  ordering,
  summary,
  exchangeRateUsd,
  exchangeRateMxn,
  onCancel,
  onConfirm,
}: {
  items: SettlementItem[];
  ordering: boolean;
  summary: OrderSummary;
  exchangeRateUsd: number;
  exchangeRateMxn: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal order-confirm-modal">
        <div className="modal-header">
          <h2>{"\u786e\u8ba4\u4e0b\u5355\u91c7\u8d2d"}</h2>
          <button className="modal-close" type="button" onClick={onCancel} aria-label={"\u5173\u95ed"}>x</button>
        </div>
        <div className="order-confirm-summary">
          <div><span>{"\u5df2\u9009\u4ea7\u54c1"}</span><strong>{summary.itemCount}</strong></div>
          <div><span>{"\u91c7\u8d2d\u603b\u6570\u91cf"}</span><strong>{integer(summary.purchaseQty)}</strong></div>
          <div><span>{"\u91c7\u8d2d\u603b\u91d1\u989d"}</span><strong>{formatCurrencyTotals(summary.totalsByCurrency)}</strong></div>
          <div><span>{"\u4e0d\u542b\u7a0e USD"}</span><strong>{money(summary.taxExcludedUsd)}</strong></div>
          <div><span>{"\u542b\u7a0e USD"}</span><strong>{money(summary.taxIncludedUsd)}</strong></div>
        </div>
        <div className="table-wrap order-confirm-table">
          <table>
            <thead>
              <tr>
                <th>{"\u4ea7\u54c1\u7f16\u7801"}</th>
                <th>{"\u4ea7\u54c1\u540d\u79f0"}</th>
                <th>{"\u91c7\u8d2d\u6570\u91cf"}</th>
                <th>{"\u91c7\u8d2d\u5355\u4ef7"}</th>
                <th>{"\u91c7\u8d2d\u603b\u4ef7"}</th>
                <th>{"\u5e01\u79cd"}</th>
                <th>{"\u4e0d\u542b\u7a0eUSD"}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const amounts = settlementPurchaseAmounts(item, exchangeRateUsd, exchangeRateMxn);
                return (
                  <tr key={item.id}>
                    <td>{item.productCode}</td>
                    <td>{item.productName}</td>
                    <td className="numeric-cell">{integer(item.purchaseQty)}</td>
                    <td className="numeric-cell">{money(item.purchaseUnitPrice)}</td>
                    <td className="numeric-cell">{money(amounts.purchaseTotal)}</td>
                    <td>{item.currency}</td>
                    <td className="numeric-cell">{money(amounts.taxExcludedUsd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>{"\u53d6\u6d88"}</button>
          <button className="primary-action" type="button" disabled={ordering || !items.length} onClick={onConfirm}>
            {ordering ? "\u4e0b\u5355\u4e2d..." : "\u786e\u8ba4\u4e0b\u5355"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaidSwitch({ checked, disabled = false, onChange }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      aria-checked={checked}
      className={`paid-switch ${checked ? 'is-on' : ''}`}
      disabled={disabled}
      role="switch"
      type="button"
      onClick={() => onChange(!checked)}
    >
      <span className="paid-switch-knob" />
      <span className="paid-switch-label">{checked ? '已支付' : '未支付'}</span>
    </button>
  );
}

function AttachmentManagement({
  detail,
  description,
  progress,
  uploading,
  onDescriptionChange,
  onUpload,
  onDelete,
  page,
  total,
  onPageChange,
}: {
  detail: SettlementProjectDetailPage;
  description: string;
  progress: AttachmentUploadProgress | null;
  uploading: boolean;
  onDescriptionChange: (value: string) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onDelete: (attachmentId: string) => void;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const attachments = detail.attachments.items;
  return (
    <div className="panel">
      <div className="section-heading">
        <h2>附件管理</h2>
        <label className={`file-action${uploading ? ' disabled' : ''}`}>
          上传附件
          <input type="file" disabled={uploading} onChange={onUpload} />
        </label>
      </div>
      <div className="inline-form-grid">
        <label>
          <span>附件说明</span>
          <input value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
        </label>
      </div>
      {progress && (
        <div className="attachment-upload-progress">
          <div className="attachment-upload-progress__meta">
            <strong>{progress.fileName}</strong>
            <span>{progress.percent}%</span>
          </div>
          <div className="attachment-upload-progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
            <span style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>文件名</th>
              <th>类型</th>
              <th>大小</th>
              <th>说明</th>
              <th>上传时间</th>
              <th className="attachment-actions-col">操作</th>
            </tr>
          </thead>
          <tbody>
            {progress && (
              <tr className={`attachment-upload-row ${progress.status === 'done' ? 'is-done' : ''}`}>
                <td>{progress.fileName}</td>
                <td>{progress.fileType || '-'}</td>
                <td className="numeric-cell">{formatFileSize(progress.fileSize)}</td>
                <td>{progress.description || '-'}</td>
                <td>
                  <div className="attachment-upload-row__status">
                    <span>{progress.status === 'done' ? '上传完成，正在刷新' : '上传中'}</span>
                    <span>{progress.percent}%</span>
                  </div>
                </td>
                <td className="attachment-actions-col">
                  <div className="attachment-upload-row__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
                    <span style={{ width: `${progress.percent}%` }} />
                  </div>
                </td>
              </tr>
            )}
            {attachments.map((attachment) => (
              <tr key={attachment.id}>
                <td>{attachment.fileName}</td>
                <td>{attachment.fileType || '-'}</td>
                <td className="numeric-cell">{formatFileSize(attachment.fileSize)}</td>
                <td>{attachment.description || '-'}</td>
                <td>{new Date(attachment.uploadedAt).toLocaleString()}</td>
                <td className="row-actions attachment-actions-col">
                  <a href={attachment.dataUrl} download={attachment.fileName}>下载</a>
                  <button className="danger-action" type="button" onClick={() => onDelete(attachment.id)}>删除</button>
                </td>
              </tr>
            ))}
            {!attachments.length && !progress && (
              <tr>
                <td colSpan={6} className="empty-cell">暂无附件</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <DetailPagination page={page} total={total} onChange={onPageChange} />
    </div>
  );
}

function DetailPagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / 10));
  return (
    <div className="pagination-bar detail-pagination">
      <span>共 {total} 条</span>
      <div className="pagination-actions">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>上一页</button>
        <span>第 {page} / {totalPages} 页</span>
        <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>下一页</button>
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
  accountingDate?: string;
  companyEntity?: string;
  invoiceEntity?: string;
  invoiceDate?: string;
  invoiceNo?: string;
  invoiceTotal: number;
  invoiceTaxExcludedTotal: number;
  taxRate: number;
  invoiceTaxAmount: number;
  currency: SettlementCurrency;
  exchangeRate: number;
  isPaid?: boolean;
}): UpdateSettlementInvoiceDto {
  return {
    type: invoice.type,
    accountPeriod: invoice.accountPeriod || '',
    accountingDate: invoice.accountingDate || '',
    companyEntity: invoice.companyEntity || '',
    invoiceEntity: invoice.invoiceEntity || '',
    invoiceDate: invoice.invoiceDate || '',
    invoiceNo: invoice.invoiceNo || '',
    invoiceTotal: invoice.invoiceTotal,
    invoiceTaxExcludedTotal: invoice.invoiceTaxExcludedTotal,
    taxRate: invoice.taxRate,
    invoiceTaxAmount: invoice.invoiceTaxAmount,
    currency: invoice.currency,
    exchangeRate: invoice.exchangeRate,
    isPaid: Boolean(invoice.isPaid),
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

function emptyOrderSummary(): OrderSummary {
  return {
    itemCount: 0,
    purchaseQty: 0,
    totalsByCurrency: { CNY: 0, USD: 0, MXN: 0 },
    taxExcludedUsd: 0,
    taxIncludedUsd: 0,
  };
}

function formatCurrencyTotals(totals: Record<SettlementCurrency, number>) {
  return currencies
    .filter((currency) => Number(totals[currency] || 0) !== 0)
    .map((currency) => `${currency} ${money(totals[currency])}`)
    .join(' / ') || '0.00';
}

function formatFileSize(value = 0) {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${money(size / 1024 / 1024)} MB`;
  if (size >= 1024) return `${money(size / 1024)} KB`;
  return `${integer(size)} B`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('附件读取失败'));
    reader.readAsDataURL(file);
  });
}

function chunkString(value: string, size: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks;
}

function priceTypeLabel(value: string) {
  return value === 'tax_excluded' ? '不含税价' : '含税价';
}

function expenseLabel(type: string) {
  const match = expenseTypes.find(([value]) => value === type);
  return match?.[1] || type;
}

function invoiceTypeLabel(type: SettlementInvoiceType) {
  return type === 'income' ? '收入' : '成本';
}

function money(value = 0) {
  return formatMoney(value);
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
