import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import type { FinanceInvoicePage, FinanceInvoiceRow, SettlementInvoiceType } from '../api.js';

export default function FinanceInvoicePage() {
  const [rows, setRows] = useState<FinanceInvoiceRow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const totals = useMemo(() => rows.reduce((current, row) => {
    if (row.type === 'income') current.income += Number(row.usdAmount || 0);
    if (row.type === 'cost') current.cost += Number(row.usdAmount || 0);
    current.net += Number(row.usdAmount || 0);
    return current;
  }, { income: 0, cost: 0, net: 0 }), [rows]);

  async function load(nextPage = page, nextPageSize = pageSize) {
    const result = await apiGet<FinanceInvoicePage>(
      `/finance/invoices?keyword=${encodeURIComponent(keyword)}&type=${encodeURIComponent(type)}&page=${nextPage}&pageSize=${nextPageSize}`,
    );
    setRows(result.items);
    setTotal(result.total);
    const nextTotalPages = Math.max(1, Math.ceil(result.total / nextPageSize));
    if (nextPage > nextTotalPages) setPage(nextTotalPages);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [page, pageSize, type]);

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>发票</h1>
          <p>{total} 条发票明细</p>
        </div>
      </header>
      <FeedbackDialog message={error} onClose={() => setError('')} />
      <div className="settlement-metrics">
        <Metric label="收入发票(USD)" value={totals.income} />
        <Metric label="成本发票(USD)" value={totals.cost} />
        <Metric label="发票净额(USD)" value={totals.net} />
      </div>
      <div className="workspace-toolbar">
        <div className="search-group">
          <input className="search-input" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索报价单号/客户/项目名称/发票号" />
          <button className="primary-action search-action" type="button" onClick={() => {
            setPage(1);
            if (page === 1) load(1).catch((err) => setError(err.message));
          }}>搜索</button>
        </div>
        <select value={type} onChange={(event) => {
          setType(event.target.value);
          setPage(1);
        }}>
          <option value="">全部类型</option>
          <option value="income">收入</option>
          <option value="cost">成本</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>报价单号</th>
              <th>客户</th>
              <th>项目名称</th>
              <th>项目状态</th>
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
              <th className="actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.quotationNo || '-'}</td>
                <td>{row.customerName || '-'}</td>
                <td>{row.projectName || '-'}</td>
                <td><span className={`badge ${row.projectStatus}`}>{row.projectStatus === 'completed' ? '已完成' : '进行中'}</span></td>
                <td>{invoiceTypeLabel(row.type)}</td>
                <td>{row.accountPeriod || '-'}</td>
                <td>{row.invoiceEntity || '-'}</td>
                <td>{formatDate(row.invoiceDate)}</td>
                <td>{row.invoiceNo || '-'}</td>
                <td className="numeric-cell">{money(row.invoiceTotal)}</td>
                <td className="numeric-cell">{money(row.invoiceTaxExcludedTotal)}</td>
                <td className="numeric-cell">{money(row.taxRate)}</td>
                <td className="numeric-cell">{money(row.invoiceTaxAmount)}</td>
                <td>{row.currency}</td>
                <td className="numeric-cell">{money(row.exchangeRate)}</td>
                <td className="numeric-cell">{money(row.usdAmount)}</td>
                <td className="actions">
                  <Link to={`/settlement-projects/${row.projectId}`}>查看项目</Link>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={17} className="empty-cell">暂无发票明细</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination-bar">
        <span>第 {page} / {totalPages} 页</span>
        <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>下一页</button>
        <label>
          每页
          <select value={pageSize} onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}>
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
    </section>
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

function invoiceTypeLabel(type: SettlementInvoiceType) {
  return type === 'income' ? '收入' : '成本';
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function money(value = 0) {
  return Number(value || 0).toFixed(2);
}
