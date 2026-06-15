import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiWrite, download } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import FieldVisibilityDialog from '../components/FieldVisibilityDialog.js';
import type { QuotationDetail } from '../api.js';

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
  const [detail, setDetail] = useState<QuotationDetail | null>(null);
  const [visibleItemColumns, setVisibleItemColumns] = useState<string[]>(() => itemColumns.map(([key]) => key));
  const [showItemColumns, setShowItemColumns] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (id) loadDetail().catch((error) => setMessage(error.message));
  }, [id]);

  async function loadDetail() {
    if (!id) return;
    setDetail(await apiGet<QuotationDetail>(`/quotations/${id}`));
  }

  async function confirmQuotation() {
    if (!id) return;
    if (!window.confirm('确认将该报价单状态改为已完成吗？')) return;
    try {
      setDetail(await apiWrite<QuotationDetail>(`/quotations/${id}/confirm`, 'POST'));
      setMessage('报价单已确认');
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  if (!detail) return <div className="panel">加载中...</div>;
  const { quotation, items } = detail;
  const totalQty = items.reduce((sum, item) => sum + Number(item.purchaseQty || 0), 0);
  const visibleColumns = itemColumns.filter(([key]) => visibleItemColumns.includes(key));

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>{quotation.quotationNo}</h1>
          <p>{quotation.customerName || '未填写客户'} · {quotation.status}</p>
        </div>
        <div className="toolbar">
          {quotation.status === 'draft' && <button type="button" onClick={confirmQuotation}>确认报价单</button>}
          <Link className="button-link primary" to={`/quotation/generate/${quotation.id}`}>修改报价</Link>
          <button onClick={() => download(`/quotations/${quotation.id}/export`)}>导出</button>
          <button onClick={() => download(`/quotations/${quotation.id}/export-formal`)}>导出报价单</button>
        </div>
      </header>
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
        <div className="detail-grid">
          {paramFields.map(([key, label]) => (
            <div className="detail-item" key={key}>
              <span>{label}</span>
              <strong>{format(quotation[key as keyof typeof quotation])}</strong>
            </div>
          ))}
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
      <strong>{integerValue ? integer(value) : Number(value || 0).toFixed(2)}{suffix}</strong>
    </div>
  );
}

function format(value: unknown) {
  return typeof value === 'number' ? value.toFixed(2) : String(value ?? '');
}

function formatItemValue(item: QuotationDetail['items'][number], key: string) {
  if (key === 'purchaseQty') return integer(item.purchaseQty);
  if (key === 'ddpQuoteUnitUsd') return format(safeDivide(item.revenueUsd, item.purchaseQty));
  if (key === 'historicalDdpQuoteUsd') return item.historicalDdpQuoteUsd == null ? '无历史报价' : format(item.historicalDdpQuoteUsd);
  if (key === 'isCustomsClearance' || key === 'enableNom') return item[key] ? '是' : '否';
  if (key === 'igiTaxRate' || key === 'markupRate' || key === 'grossMarginRate') return `${format(item[key as keyof typeof item])}%`;
  return format(item[key as keyof typeof item]);
}

function itemColumnTotal(key: string, items: QuotationDetail['items']) {
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
