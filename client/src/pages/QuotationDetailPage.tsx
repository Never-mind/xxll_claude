import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiWrite, download } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import DetailBackButton from '../components/DetailBackButton.js';
import FieldVisibilityDialog from '../components/FieldVisibilityDialog.js';
import LinkedNumber from '../components/LinkedNumber.js';
import { formatMoney } from '../utils/display.js';
import type { QuotationDetailPage } from '../api.js';

const itemColumns = [
  ['productCode', '产品编码'],
  ['productName', '产品名称'],
  ['purchaseQty', '数量'],
  ['purchaseCurrency', '币种'],
  ['purchaseUnitPrice', '不含税采购单价'],
  ['purchaseTotalOriginal', '不含税采购总价（原币种）'],
  ['purchaseTotalUsd', '不含税采购总价（USD）'],
  ['transportType', '运输方式'],
  ['isCustomsClearance', '清关'],
  ['enableNom', 'NOM认证'],
  ['firstMileFreightUsd', '头程运费（USD）'],
  ['cifUsd', 'CIF(USD)'],
  ['igiTaxRate', '关税税率(%)'],
  ['tariffUsd', '关税金额(USD)'],
  ['capitalCostUsd', '资金成本(USD)'],
  ['customsFeeUsd', '清关手续费(USD)'],
  ['nomFeeUsd', 'NOM认证费(USD)'],
  ['ddpTotalUsd', '到仓总价（USD）'],
  ['ddpUnitPriceUsd', '到仓单价(USD)'],
  ['markupRate', '加成比例(%)'],
  ['historicalDdpQuoteUsd', '历史DDP不含税报价（USD）'],
  ['ddpQuoteUnitUsd', 'DDP不含税单价(USD)'],
  ['revenueUsd', 'DDP不含税总价(USD)'],
  ['operatingProfitUsd', '利润(USD)'],
  ['grossMarginRate', '毛利率'],
];

const paramFields = [
  ['exchangeRateUsd', 'USD汇率'],
  ['exchangeRateMxn', '比索兑美元汇率'],
  ['capitalCostRate', '资金成本率(%)'],
  ['accountPeriod', '账期(月)'],
  ['badDebtRate', '坏账率(%)'],
  ['customsFeeRate', '清关手续费率(%)'],
  ['vatOverseas', '海外增值税率(%)'],
  ['markupRate', '加价率(%)'],
  ['seaFreightRate', '海运费（CNY/方）'],
  ['airFreightRate', '空运费（CNY/kg）'],
  ['nomFee', 'NOM费(USD)'],
  ['customsMiscFee', '清关杂费'],
  ['lastMileFee', '尾程费'],
  ['storageOperationFee', '仓储操作费'],
  ['implementationFee', '实施费'],
  ['publicFeeTotal', '公共费用总计'],
  ['customerName', '客户名称'],
  ['remark', '项目名称'],
];

export default function QuotationDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<QuotationDetailPage | null>(null);
  const [itemPage, setItemPage] = useState(1);
  const [visibleItemColumns, setVisibleItemColumns] = useState<string[]>(() => itemColumns.map(([key]) => key));
  const [showItemColumns, setShowItemColumns] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmedNotice, setConfirmedNotice] = useState(false);

  useEffect(() => {
    if (id) loadDetail(1).catch((error) => setMessage(error.message));
  }, [id]);

  const itemPageSize = 10;
  const itemTotalPages = Math.max(1, Math.ceil((detail?.items.total || 0) / itemPageSize));

  async function loadDetail(nextPage = itemPage) {
    if (!id) return;
    setLoading(true);
    setMessage('');
    try {
      const result = await apiGet<QuotationDetailPage>(`/quotations/${id}?page=${nextPage}&pageSize=${itemPageSize}`);
      setDetail(result);
      setItemPage(result.items.page);
    } catch (error) {
      setDetail(null);
      setMessage((error as Error).message || '报价详情加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function confirmQuotation() {
    if (!id) return;
    if (!window.confirm('确认将该报价单状态改为已完成吗？')) return;
    setConfirming(true);
    setConfirmedNotice(false);
    try {
      await apiWrite(`/quotations/${id}/confirm`, 'POST');
      await loadDetail(itemPage);
      setConfirmedNotice(true);
      setMessage('报价单已确认');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <div className="panel">加载中...</div>;
  if (!detail) {
    return (
      <section>
        <header className="page-header">
          <div className="detail-heading-group">
            <DetailBackButton to="/quotation/list" label="返回报价列表" />
            <div>
            <h1>报价详情</h1>
            <p>无法加载当前报价单数据</p>
            </div>
          </div>
        </header>
        <div className="alert">
          {message || '报价详情加载失败，请确认报价单是否存在，或检查后端 API 是否正常。'}
        </div>
      </section>
    );
  }
  const { quotation } = detail;
  const items = detail.items.items;
  const totalQty = items.reduce((sum, item) => sum + Number(item.purchaseQty || 0), 0);
  const visibleColumns = itemColumns.filter(([key]) => visibleItemColumns.includes(key));

  return (
    <section>
      <header className="page-header">
        <div className="detail-heading-group">
          <DetailBackButton to="/quotation/list" label="返回报价列表" />
          <div>
          <h1>{quotation.quotationNo}</h1>
          <p>{quotation.customerName || '未填写客户'} / 承接单位：{quotation.contractingEntityName || '未设置'} / {quotation.status}</p>
          </div>
        </div>
        <div className="toolbar">
          {quotation.status === 'draft' && <button type="button" disabled={confirming} onClick={confirmQuotation}>{confirming ? '确认中...' : '确认报价单'}</button>}
          <Link className="button-link primary" to={`/quotation/generate/${quotation.id}`}>修改报价</Link>
          <button onClick={() => download(`/quotations/${quotation.id}/export`)}>导出</button>
          <button onClick={() => download(`/quotations/${quotation.id}/export-formal`)}>导出报价单</button>
        </div>
      </header>
      {confirmedNotice && <div className="alert success-alert">报价单已确认</div>}
      <FeedbackDialog message={message} onClose={() => setMessage('')} />
      <div className="metrics">
        <Metric label="总数量" value={totalQty} integerValue />
        <Metric label="公共费用合计(USD)" value={quotation.publicFeeTotal} />
        <Metric label="CIF合计(USD)" value={quotation.totalCifUsd} />
        <Metric label="到仓总价（USD）" value={quotation.totalDdpUsd} />
        <Metric label="收入合计(USD)" value={quotation.totalRevenueUsd} />
        <Metric label="利润合计(USD)" value={quotation.totalProfitUsd} />
        <Metric label="综合毛利率" value={quotation.grossMarginRate} suffix="%" />
      </div>
      <div className="panel">
        <h2>报价参数</h2>
        {quotation.sourcePoNo && quotation.sourcePoId && (
          <p className="form-hint">来源客户PO：<LinkedNumber to={`/customer-pos/${quotation.sourcePoId}`}>{quotation.sourcePoNo}</LinkedNumber></p>
        )}
        <div className="detail-grid">
          {paramFields.map(([key, label]) => (
            <div className="detail-item" key={key}>
              <span>{label}</span>
              <strong>{format(quotation[key as keyof typeof quotation])}</strong>
            </div>
          ))}
          <div className="detail-item"><span>承接单位</span><strong>{quotation.contractingEntityName || '未设置'}</strong></div>
        </div>
      </div>
      <div className="panel">
        <div className="section-heading">
          <h2>报价明细</h2>
          <button type="button" onClick={() => setShowItemColumns(true)}>字段显示</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{visibleColumns.map(([, label]) => <th key={label}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  {visibleColumns.map(([key]) => <td key={key}>{formatItemValue(item, key)}</td>)}
                </tr>
              ))}
            </tbody>
            {Boolean(items.length) && (
              <tfoot>
                <tr>
                  {visibleColumns.map(([key]) => (
                    <td key={key} className={isSummableItemColumn(key) ? 'numeric-cell' : undefined}>
                      {itemColumnTotal(key, items)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="pagination-bar"><span>共 {detail.items.total} 条明细</span><div className="pagination-actions"><button type="button" disabled={itemPage <= 1} onClick={() => void loadDetail(itemPage - 1)}>上一页</button><span>第 {itemPage} / {itemTotalPages} 页</span><button type="button" disabled={itemPage >= itemTotalPages} onClick={() => void loadDetail(itemPage + 1)}>下一页</button></div></div>
      </div>
      {showItemColumns && (
        <FieldVisibilityDialog
          fields={itemColumns.map(([key, label]) => ({ key, label }))}
          visibleKeys={visibleItemColumns}
          onChange={setVisibleItemColumns}
          onClose={() => setShowItemColumns(false)}
        />
      )}
    </section>
  );
}

function Metric({ label, value, suffix = '', integerValue = false }: { label: string; value: number; suffix?: string; integerValue?: boolean }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{integerValue ? integer(value) : formatMoney(value)}{suffix}</strong>
    </div>
  );
}

function format(value: unknown) {
  return typeof value === 'number' ? formatMoney(value) : String(value ?? '');
}

function formatItemValue(item: QuotationDetailPage['items']['items'][number], key: string) {
  if (key === 'purchaseQty') return integer(item.purchaseQty);
  if (key === 'ddpQuoteUnitUsd') return format(safeDivide(item.revenueUsd, item.purchaseQty));
  if (key === 'historicalDdpQuoteUsd') return item.historicalDdpQuoteUsd == null ? '无历史报价' : format(item.historicalDdpQuoteUsd);
  if (key === 'isCustomsClearance' || key === 'enableNom') return item[key] ? '是' : '否';
  if (key === 'igiTaxRate' || key === 'markupRate' || key === 'grossMarginRate') return `${format(item[key as keyof typeof item])}%`;
  return format(item[key as keyof typeof item]);
}

function itemColumnTotal(key: string, items: QuotationDetailPage['items']['items']) {
  if (key === 'productCode') return '合计';
  if (key === 'purchaseQty') return integer(items.reduce((sum, item) => sum + Number(item.purchaseQty || 0), 0));
  if (!isSummableItemColumn(key)) return '';
  return format(items.reduce((sum, item) => sum + Number(item[key as keyof typeof item] || 0), 0));
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
    'publicFeeAllocationUsd',
    'ddpTotalUsd',
    'ddpUnitPriceUsd',
    'ddpQuoteUnitUsd',
    'revenueUsd',
    'operatingProfitUsd',
  ].includes(key);
}

function integer(value: unknown) {
  return String(Math.trunc(Number(value || 0)));
}

function safeDivide(value: number, divisor: number) {
  return divisor ? value / divisor : 0;
}
