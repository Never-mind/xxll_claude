import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import type { SettlementProject, SettlementProjectPage } from '../api.js';

interface TrendDay {
  label: string;
  count: number;
  amount: number;
}

export default function DashboardStatsPage() {
  const [rows, setRows] = useState<SettlementProject[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<SettlementProjectPage>('/settlement-projects?page=1&pageSize=50')
      .then((result) => setRows(result.items))
      .catch((err) => setError(err.message));
  }, []);

  const stats = useMemo(() => buildStats(rows), [rows]);
  const maxTrendAmount = Math.max(1, ...stats.trend.map((day) => day.amount));

  return (
    <section className="dashboard-page">
      <header className="page-header dashboard-header">
        <div className="toolbar dashboard-toolbar">
          <select aria-label="统计周期" defaultValue="30">
            <option value="7">近 7 天</option>
            <option value="30">近 30 天</option>
            <option value="90">近 90 天</option>
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
        <div className="panel dashboard-card trend-card">
          <div className="section-title">
            <div>
              <h2>项目收入趋势</h2>
              <p>按项目更新时间聚合已销售收入，快速判断近期项目回款节奏。</p>
            </div>
            <span className="badge completed">completed</span>
          </div>
          <div className="trend-bars">
            {stats.trend.map((day) => (
              <div className="trend-column" key={day.label}>
                <div className="trend-track">
                  <div className="trend-fill" style={{ height: `${Math.max(8, day.amount / maxTrendAmount * 100)}%` }} />
                </div>
                <strong>{day.count}</strong>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
        </div>

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
            <p>按最新项目结算记录展示，用于快速进入项目成本收入明细。</p>
          </div>
        </div>
        <div className="table-wrap embedded">
          <table>
            <thead>
              <tr>
                <th>项目报价单号</th>
                <th>客户</th>
                <th>更新时间</th>
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
                  <td>{new Date(row.updatedAt || row.createdAt).toLocaleDateString()}</td>
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

function StatCard({ label, value, meta, accent }: { label: string; value: string; meta: string; accent: string }) {
  return (
    <div className={`stat-card ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
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

function buildStats(rows: SettlementProject[]) {
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
    trend: buildTrend(rows),
  };
}

function buildTrend(rows: SettlementProject[]): TrendDay[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const start = today.getTime() - (6 - index) * dayMs;
    const end = start + dayMs;
    const dayRows = rows.filter((row) => {
      const time = timeOf(row);
      return time >= start && time < end;
    });
    return {
      label: new Date(start).toLocaleDateString('zh-CN', { weekday: 'short' }),
      count: dayRows.length,
      amount: sum(dayRows, 'receivedRevenueUsd'),
    };
  });
}

function timeOf(row: SettlementProject) {
  return new Date(row.updatedAt || row.createdAt).getTime();
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
