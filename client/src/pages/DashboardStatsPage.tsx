import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api.js';
import type { Quotation, QuotationPage } from '../api.js';

interface TrendDay {
  label: string;
  count: number;
  amount: number;
}

export default function DashboardStatsPage() {
  const [rows, setRows] = useState<Quotation[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<QuotationPage>('/quotations?page=1&pageSize=50&status=completed')
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
          <Link className="button-link primary" to="/quotation/list">报价列表</Link>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      <div className="stat-grid">
        <StatCard label="已完成报价单" value={stats.completedCount.toString()} meta={`本周 ${stats.thisWeekCount} 单`} accent="blue" />
        <StatCard label="完成金额" value={money(stats.totalRevenue)} meta={`均单 ${money(stats.averageOrder)}`} accent="green" />
        <StatCard label="总利润" value={money(stats.totalProfit)} meta={`毛利率 ${stats.marginRate.toFixed(2)}%`} accent="violet" />
        <StatCard label="效率变化" value={`${stats.weeklyChange >= 0 ? '+' : ''}${stats.weeklyChange.toFixed(1)}%`} meta="本周 vs 上周金额" accent="amber" />
      </div>

      <div className="dashboard-grid">
        <div className="panel dashboard-card trend-card">
          <div className="section-title">
            <div>
              <h2>完成金额趋势</h2>
              <p>按报价完成时间聚合，便于快速判断近期业务节奏。</p>
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
            <EfficiencyRow label="本周完成金额" value={money(stats.thisWeekAmount)} helper={`${stats.thisWeekCount} 单`} />
            <EfficiencyRow label="上周完成金额" value={money(stats.lastWeekAmount)} helper={`${stats.lastWeekCount} 单`} />
            <EfficiencyRow label="最高金额客户" value={stats.topCustomer || '-'} helper={money(stats.topCustomerAmount)} />
            <EfficiencyRow label="利润贡献" value={money(stats.totalProfit)} helper={`${stats.marginRate.toFixed(2)}% 毛利率`} />
          </div>
        </div>
      </div>

      <div className="panel dashboard-card">
        <div className="section-title">
          <div>
            <h2>已完成报价清单</h2>
            <p>按最新完成记录展示，用于快速进入详情和导出。</p>
          </div>
        </div>
        <div className="table-wrap embedded">
          <table>
            <thead>
              <tr>
                <th>报价单号</th>
                <th>客户</th>
                <th>完成时间</th>
                <th>DDP(USD)</th>
                <th>收入(USD)</th>
                <th>利润(USD)</th>
                <th>毛利率</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row) => (
                <tr key={row.id}>
                  <td>{row.quotationNo}</td>
                  <td>{row.customerName || '-'}</td>
                  <td>{new Date(row.updatedAt || row.createdAt).toLocaleDateString()}</td>
                  <td>{number(row.totalDdpUsd)}</td>
                  <td>{number(row.totalRevenueUsd)}</td>
                  <td>{number(row.totalProfitUsd)}</td>
                  <td>{number(row.grossMarginRate)}%</td>
                  <td><Link to={`/quotation/detail/${row.id}`}>查看</Link></td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="empty-cell">暂无已完成报价单</td>
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

function buildStats(rows: Quotation[]) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const thisWeekStart = now - 7 * dayMs;
  const lastWeekStart = now - 14 * dayMs;
  const totalRevenue = sum(rows, 'totalRevenueUsd');
  const totalProfit = sum(rows, 'totalProfitUsd');
  const customerTotals = new Map<string, number>();

  for (const row of rows) {
    const key = row.customerName || '未知客户';
    customerTotals.set(key, (customerTotals.get(key) || 0) + Number(row.totalRevenueUsd || 0));
  }

  const [topCustomer = '', topCustomerAmount = 0] = [...customerTotals.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  const thisWeek = rows.filter((row) => timeOf(row) >= thisWeekStart);
  const lastWeek = rows.filter((row) => timeOf(row) >= lastWeekStart && timeOf(row) < thisWeekStart);
  const thisWeekAmount = sum(thisWeek, 'totalRevenueUsd');
  const lastWeekAmount = sum(lastWeek, 'totalRevenueUsd');
  const weeklyChange = lastWeekAmount > 0 ? (thisWeekAmount - lastWeekAmount) / lastWeekAmount * 100 : thisWeekAmount > 0 ? 100 : 0;

  return {
    completedCount: rows.length,
    totalRevenue,
    totalProfit,
    averageOrder: rows.length ? totalRevenue / rows.length : 0,
    marginRate: totalRevenue > 0 ? totalProfit / totalRevenue * 100 : 0,
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

function buildTrend(rows: Quotation[]): TrendDay[] {
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
      amount: sum(dayRows, 'totalRevenueUsd'),
    };
  });
}

function timeOf(row: Quotation) {
  return new Date(row.updatedAt || row.createdAt).getTime();
}

function sum(rows: Quotation[], key: keyof Pick<Quotation, 'totalRevenueUsd' | 'totalProfitUsd'>) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function money(value: number) {
  return `$${number(value)}`;
}

function number(value: number) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
