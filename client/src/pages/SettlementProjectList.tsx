import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiWrite, download } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import type { SettlementProject, SettlementProjectPage } from '../api.js';

export default function SettlementProjectList() {
  const [rows, setRows] = useState<SettlementProject[]>([]);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function load(nextPage = page, nextPageSize = pageSize) {
    const result = await apiGet<SettlementProjectPage>(`/settlement-projects?keyword=${encodeURIComponent(keyword)}&page=${nextPage}&pageSize=${nextPageSize}`);
    setRows(result.items);
    setTotal(result.total);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [page, pageSize]);

  async function remove(id: string) {
    if (!confirm('确认删除该项目结算？删除后将同步删除该项目的采购商品、其他成本费用和销售收入明细。')) return;
    try {
      await apiWrite(`/settlement-projects/${id}`, 'DELETE');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>项目结算</h1>
          <p>{total} 个项目</p>
        </div>
        <button type="button" onClick={() => download('/settlement-projects/export')}>导出</button>
      </header>
      <div className="workspace-toolbar">
        <div className="search-group">
          <input className="search-input" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索报价单号/客户" />
          <button className="primary-action search-action" onClick={() => {
            setPage(1);
            if (page === 1) load().catch((err) => setError(err.message));
          }}>搜索</button>
        </div>
      </div>
      <FeedbackDialog message={error} onClose={() => setError('')} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>报价单号</th>
              <th>客户</th>
              <th>项目名称</th>
              <th>采购成本(USD)</th>
              <th>已采购成本(USD)</th>
              <th>销售收入(USD)</th>
              <th>已销售收入(USD)</th>
              <th>项目毛利(USD)</th>
              <th>状态</th>
              <th className="actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.quotationNo}</td>
                <td>{row.customerName || '-'}</td>
                <td>{row.remark || '-'}</td>
                <td className="numeric-cell">{money(row.quotedPurchaseCostUsd)}</td>
                <td className="numeric-cell">{money(row.purchasedCostUsd)}</td>
                <td className="numeric-cell">{money(row.quotedSalesRevenueUsd)}</td>
                <td className="numeric-cell">{money(row.receivedRevenueUsd)}</td>
                <td className="numeric-cell">{money(row.grossProfitUsd)}</td>
                <td><span className={`badge ${row.status}`}>{row.status === 'completed' ? '已完成' : '进行中'}</span></td>
                <td className="actions">
                  <Link to={`/settlement-projects/${row.id}`}>查看</Link>
                  <button className="danger-action" type="button" onClick={() => remove(row.id)}>删除</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={10} className="empty-cell">暂无项目结算数据，报价单确认后会自动生成</td>
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

function money(value = 0) {
  return Number(value || 0).toFixed(2);
}
