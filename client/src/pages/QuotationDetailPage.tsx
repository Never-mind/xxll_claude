import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet, download } from '../api.js';
import type { QuotationDetail } from '../api.js';

const itemColumns = [
  ['productCode', '产品编码'],
  ['productName', '产品名称'],
  ['purchaseQty', '数量'],
  ['purchasePriceCny', '采购单价'],
  ['totalTaxIncludedCny', '含税总价'],
  ['totalExclTaxCny', '不含税总价'],
  ['transportType', '运输'],
  ['cifUsd', 'CIF(USD)'],
  ['igiTaxRate', 'IGI(%)'],
  ['tariffUsd', '关税'],
  ['publicFeeAllocationUsd', '公共费用'],
  ['ddpTotalUsd', 'DDP总价'],
  ['ddpUnitPriceUsd', 'DDP单价'],
  ['revenueUsd', '收入'],
  ['operatingProfitUsd', '利润'],
  ['grossMarginRate', '毛利率'],
];

export default function QuotationDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<QuotationDetail | null>(null);

  useEffect(() => {
    if (id) apiGet<QuotationDetail>(`/quotations/${id}`).then(setDetail);
  }, [id]);

  if (!detail) return <div className="panel">加载中...</div>;
  const { quotation, items } = detail;

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>{quotation.quotationNo}</h1>
          <p>{quotation.customerName || '未填写客户'} · {quotation.status}</p>
        </div>
        <button onClick={() => download(`/quotations/${quotation.id}/export`)}>导出报价单</button>
      </header>
      <div className="metrics">
        <Metric label="总CIF" value={quotation.totalCifUsd} />
        <Metric label="总DDP" value={quotation.totalDdpUsd} />
        <Metric label="总收入" value={quotation.totalRevenueUsd} />
        <Metric label="总利润" value={quotation.totalProfitUsd} />
        <Metric label="毛利率" value={quotation.grossMarginRate} suffix="%" />
      </div>
      <div className="panel">
        <h2>报价明细</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{itemColumns.map(([, label]) => <th key={label}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  {itemColumns.map(([key]) => <td key={key}>{format(item[key as keyof typeof item])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{Number(value || 0).toFixed(2)}{suffix}</strong>
    </div>
  );
}

function format(value: unknown) {
  return typeof value === 'number' ? value.toFixed(2) : String(value ?? '');
}
