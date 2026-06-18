import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import type { SettlementExpense, SettlementItem, SettlementProject, SettlementProjectDetail, SettlementProjectPage, SettlementSale } from '../api.js';

interface TrendDay {
  label: string;
  income: number;
  cost: number;
}

export default function DashboardStatsPage() {
  const [rows, setRows] = useState<SettlementProject[]>([]);
  const [details, setDetails] = useState<SettlementProjectDetail[]>([]);
  const [periodDays, setPeriodDays] = useState(30);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<SettlementProjectPage>('/settlement-projects?page=1&pageSize=50')
      .then(async (result) => {
        setRows(result.items);
        setDetails(await loadSettlementDetails(result.items));
      })
      .catch((err) => setError(err.message));
  }, []);

  const stats = useMemo(() => buildStats(rows, details, periodDays), [rows, details, periodDays]);

  return (
    <section className="dashboard-page">
      <header className="page-header dashboard-header">
        <div className="toolbar dashboard-toolbar">
          <select aria-label="period" value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))}>
            <option value="7">{'\u8fd1 7 \u5929'}</option>
            <option value="30">{'\u8fd1 30 \u5929'}</option>
            <option value="90">{'\u8fd1 90 \u5929'}</option>
          </select>
          <Link className="button-link primary" to="/settlement-projects">项目结算</Link>
        </div>
      </header>

      <FeedbackDialog message={error} onClose={() => setError('')} />

      <div className="stat-grid">
        <StatCard label="项目数量" value={stats.projectCount.toString()} meta={`本周 ${stats.thisWeekCount} 个`} accent="blue" />
        <StatCard label="已采购成本" value={money(stats.purchasedCost)} meta={`报价成本 ${money(stats.quotedPurchaseCost)}`} accent="green" />
        <StatCard label="已销售收入" value={money(stats.receivedRevenue)} meta={`报价收入 ${money(stats.quotedSalesRevenue)}`} accent="violet" />
        <StatCard label="项目毛利" value={money(stats.grossProfit)} meta={`实际毛利率 ${stats.marginRate.toFixed(2)}%`} accent="amber" />
      </div>

      <div className="dashboard-grid">
        <TrendCard trend={stats.trend} periodDays={periodDays} />

        <div className="panel dashboard-card efficiency-card">
          <div className="section-title">
            <div>
              <h2>数据效率</h2>
              <p>把需要优先关注的经营指标压缩在一个面板内。</p>
            </div>
          </div>
          <div className="efficiency-list">
            <EfficiencyRow label="本周已销售收入" value={money(stats.thisWeekAmount)} helper={`${stats.thisWeekCount} 个项目`} />
            <EfficiencyRow label="上周已销售收入" value={money(stats.lastWeekAmount)} helper={`${stats.lastWeekCount} 个项目`} />
            <EfficiencyRow label="最高金额客户" value={stats.topCustomer || '-'} helper={money(stats.topCustomerAmount)} />
            <EfficiencyRow label="项目毛利贡献" value={money(stats.grossProfit)} helper={`${stats.marginRate.toFixed(2)}% 实际毛利率`} />
          </div>
        </div>
      </div>

      <div className="panel dashboard-card">
        <div className="section-title">
          <div>
            <h2>项目结算清单</h2>
            <p>按项目创建时间展示，用于快速进入项目成本收入明细。</p>
          </div>
        </div>
        <div className="table-wrap embedded">
          <table>
            <thead>
              <tr>
                <th>项目报价单号</th>
                <th>客户</th>
                <th>创建时间</th>
                <th>采购成本(USD)</th>
                <th>已采购成本(USD)</th>
                <th>销售收入(USD)</th>
                <th>已销售收入(USD)</th>
                <th>项目毛利(USD)</th>
                <th className="actions">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row) => (
                <tr key={row.id}>
                  <td>{row.quotationNo}</td>
                  <td>{row.customerName || '-'}</td>
                  <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td>{number(row.quotedPurchaseCostUsd)}</td>
                  <td>{number(row.purchasedCostUsd)}</td>
                  <td>{number(row.quotedSalesRevenueUsd)}</td>
                  <td>{number(row.receivedRevenueUsd)}</td>
                  <td>{number(row.grossProfitUsd)}</td>
                  <td className="actions"><Link to={`/settlement-projects/${row.id}`}>查看</Link></td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={9} className="empty-cell">暂无项目结算数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

async function loadSettlementDetails(projects: SettlementProject[]): Promise<SettlementProjectDetail[]> {
  const details: SettlementProjectDetail[] = [];
  const batchSize = 2;
  for (let index = 0; index < projects.length; index += batchSize) {
    const batch = projects.slice(index, index + batchSize);
    details.push(...await Promise.all(batch.map((row) => apiGet<SettlementProjectDetail>(`/settlement-projects/${row.id}`))));
  }
  return details;
}

function StatCard({ label, value, meta, accent }: { label: string; value: string; meta: string; accent: string }) {
  return (
    <div className={`stat-card ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </div>
  );
}

function TrendCard({ trend, periodDays }: { trend: TrendDay[]; periodDays: number }) {
  const maxAmount = Math.max(1, ...trend.flatMap((day) => [day.income, day.cost]));
  const incomePoints = trendLinePoints(trend.map((day) => day.income), maxAmount);
  const costPoints = trendLinePoints(trend.map((day) => day.cost), maxAmount);
  const xLabels = trend.filter((_, index) => shouldShowTrendLabel(index, trend.length));
  const totalIncome = trend.reduce((total, day) => total + day.income, 0);
  const totalCost = trend.reduce((total, day) => total + day.cost, 0);

  return (
    <div className="panel dashboard-card trend-card">
      <div className="section-title">
        <div>
          <h2>{'\u9879\u76ee\u6536\u652f\u8d8b\u52bf'}</h2>
          <p>{'\u6309\u9879\u76ee\u5185\u6210\u672c\u3001\u6536\u5165\u660e\u7ec6\u7684\u5b9e\u9645\u65f6\u95f4\u7edf\u8ba1\uff0c\u5f53\u524d\u663e\u793a\u8fd1'} {periodDays} {'\u5929\u3002'}</p>
        </div>
        <span className="badge completed">{periodDays} days</span>
      </div>
      <div className="trend-legend">
        <span><i className="trend-dot income" />{'\u6536\u5165'} {money(totalIncome)}</span>
        <span><i className="trend-dot cost" />{'\u6210\u672c'} {money(totalCost)}</span>
      </div>
      <div className="trend-line-chart" role="img" aria-label="income and cost trend chart">
        <svg viewBox="0 0 720 240" preserveAspectRatio="none">
          <line className="trend-grid-line" x1="36" y1="30" x2="704" y2="30" />
          <line className="trend-grid-line" x1="36" y1="105" x2="704" y2="105" />
          <line className="trend-grid-line" x1="36" y1="180" x2="704" y2="180" />
          <polyline className="trend-line income" points={incomePoints} />
          <polyline className="trend-line cost" points={costPoints} />
          {trend.map((day, index) => (
            <g key={`${day.label}-${index}`}>
              <circle className="trend-hit-area" cx={trendX(index, trend.length)} cy={trendY(day.income, maxAmount)} r="10">
                <title>{`${day.label} 收入 ${money(day.income)}`}</title>
              </circle>
              <circle className="trend-hit-area" cx={trendX(index, trend.length)} cy={trendY(day.cost, maxAmount)} r="10">
                <title>{`${day.label} 成本 ${money(day.cost)}`}</title>
              </circle>
              <circle className="trend-point income" cx={trendX(index, trend.length)} cy={trendY(day.income, maxAmount)} r="3.5">
                <title>{`${day.label} 收入 ${money(day.income)}`}</title>
              </circle>
              <circle className="trend-point cost" cx={trendX(index, trend.length)} cy={trendY(day.cost, maxAmount)} r="3.5">
                <title>{`${day.label} 成本 ${money(day.cost)}`}</title>
              </circle>
            </g>
          ))}
        </svg>
        <div className="trend-axis-labels">
          {xLabels.map((day) => <span key={day.label}>{day.label}</span>)}
        </div>
      </div>
    </div>
  );
}

function EfficiencyRow({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="efficiency-row">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

function buildStats(rows: SettlementProject[], details: SettlementProjectDetail[], periodDays: number) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const thisWeekStart = now - 7 * dayMs;
  const lastWeekStart = now - 14 * dayMs;
  const quotedPurchaseCost = sum(rows, 'quotedPurchaseCostUsd');
  const purchasedCost = sum(rows, 'purchasedCostUsd');
  const quotedSalesRevenue = sum(rows, 'quotedSalesRevenueUsd');
  const receivedRevenue = sum(rows, 'receivedRevenueUsd');
  const grossProfit = sum(rows, 'grossProfitUsd');
  const customerTotals = new Map<string, number>();

  for (const row of rows) {
    const key = row.customerName || '未知客户';
    customerTotals.set(key, (customerTotals.get(key) || 0) + Number(row.receivedRevenueUsd || 0));
  }

  const [topCustomer = '', topCustomerAmount = 0] = [...customerTotals.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  const thisWeek = rows.filter((row) => timeOf(row) >= thisWeekStart);
  const lastWeek = rows.filter((row) => timeOf(row) >= lastWeekStart && timeOf(row) < thisWeekStart);
  const thisWeekAmount = sum(thisWeek, 'receivedRevenueUsd');
  const lastWeekAmount = sum(lastWeek, 'receivedRevenueUsd');
  const weeklyChange = lastWeekAmount > 0 ? (thisWeekAmount - lastWeekAmount) / lastWeekAmount * 100 : thisWeekAmount > 0 ? 100 : 0;

  return {
    projectCount: rows.length,
    quotedPurchaseCost,
    purchasedCost,
    quotedSalesRevenue,
    receivedRevenue,
    grossProfit,
    marginRate: receivedRevenue > 0 ? grossProfit / receivedRevenue * 100 : 0,
    thisWeekCount: thisWeek.length,
    thisWeekAmount,
    lastWeekCount: lastWeek.length,
    lastWeekAmount,
    weeklyChange,
    topCustomer,
    topCustomerAmount,
    trend: buildTrend(details, periodDays),
  };
}

function buildTrend(details: SettlementProjectDetail[], periodDays: number): TrendDay[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entries = settlementTrendEntries(details);
  return Array.from({ length: periodDays }, (_, index) => {
    const start = today.getTime() - (periodDays - 1 - index) * dayMs;
    const end = start + dayMs;
    const dayEntries = entries.filter((entry) => entry.time >= start && entry.time < end);
    return {
      label: trendLabel(new Date(start), periodDays),
      income: sumTrend(dayEntries, 'income'),
      cost: sumTrend(dayEntries, 'cost'),
    };
  });
}

function settlementTrendEntries(details: SettlementProjectDetail[]) {
  return details.flatMap((detail) => [
    ...detail.purchasedItems.map((item) => costEntry(item)),
    ...detail.expenses.map((expense) => expenseEntry(expense)),
    ...detail.sales.map((sale) => incomeEntry(sale)),
  ]).filter((entry) => Number.isFinite(entry.time) && entry.amount > 0);
}

function costEntry(item: SettlementItem) {
  return { type: 'cost' as const, time: dateTime(item.orderedAt || item.updatedAt || item.createdAt), amount: Number(item.purchasedCostUsd || 0) };
}

function expenseEntry(expense: SettlementExpense) {
  return { type: 'cost' as const, time: dateTime(expense.createdAt), amount: Number(expense.costUsd || 0) };
}

function incomeEntry(sale: SettlementSale) {
  return { type: 'income' as const, time: dateTime(sale.receivedAt || sale.createdAt), amount: Number(sale.receivedRevenueUsd || 0) };
}

function sumTrend(entries: Array<{ type: 'income' | 'cost'; amount: number }>, type: 'income' | 'cost') {
  return entries.reduce((total, entry) => total + (entry.type === type ? entry.amount : 0), 0);
}

function dateTime(value: string | undefined) {
  return value ? new Date(value).getTime() : Number.NaN;
}

function trendLinePoints(values: number[], maxValue: number) {
  return values.map((value, index) => `${trendX(index, values.length)},${trendY(value, maxValue)}`).join(' ');
}

function trendX(index: number, length: number) {
  if (length <= 1) return 36;
  return 36 + index * (668 / (length - 1));
}

function trendY(value: number, maxValue: number) {
  return 180 - (Number(value || 0) / maxValue) * 150;
}

function shouldShowTrendLabel(index: number, length: number) {
  if (length <= 10) return true;
  const interval = length <= 30 ? 5 : 15;
  return index === 0 || index === length - 1 || index % interval === 0;
}

function trendLabel(date: Date, periodDays: number) {
  if (periodDays <= 7) return date.toLocaleDateString('zh-CN', { weekday: 'short' });
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function timeOf(row: SettlementProject) {
  return new Date(row.createdAt).getTime();
}

function sum(rows: SettlementProject[], key: keyof Pick<SettlementProject, 'quotedPurchaseCostUsd' | 'purchasedCostUsd' | 'quotedSalesRevenueUsd' | 'receivedRevenueUsd' | 'grossProfitUsd'>) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function money(value: number) {
  return `$${number(value)}`;
}

function number(value: number) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
