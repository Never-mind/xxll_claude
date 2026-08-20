import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiWrite, download } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import LinkedNumber from '../components/LinkedNumber.js';
import LoadingTableRows from '../components/LoadingTableRows.js';
import type { SettlementProject, SettlementProjectPage } from '../api.js';
import { formatMoney } from '../utils/display.js';

export default function SettlementProjectList() {
  const [rows, setRows] = useState<SettlementProject[]>([]);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function load(nextPage = page, nextPageSize = pageSize) {
    setLoading(true);
    try {
      const result = await apiGet<SettlementProjectPage>(`/settlement-projects?keyword=${encodeURIComponent(keyword)}&page=${nextPage}&pageSize=${nextPageSize}`);
      setRows(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [page, pageSize]);

  async function remove(id: string) {
    if (!confirm('\u786e\u8ba4\u5220\u9664\u8be5\u9879\u76ee\u7ed3\u7b97\uff1f\u5220\u9664\u540e\u5c06\u540c\u6b65\u5220\u9664\u8be5\u9879\u76ee\u7684\u91c7\u8d2d\u5546\u54c1\u3001\u5176\u4ed6\u6210\u672c\u8d39\u7528\u548c\u9500\u552e\u6536\u5165\u660e\u7ec6\u3002')) return;
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
          <h1>{'\u9879\u76ee\u7ed3\u7b97'}</h1>
          <p>{total} {'\u4e2a\u9879\u76ee'}</p>
        </div>
        <button type="button" onClick={() => download('/settlement-projects/export')}>{'\u5bfc\u51fa'}</button>
      </header>
      <div className="workspace-toolbar">
        <div className="search-group">
          <input className="search-input" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={'\u641c\u7d22\u9879\u76ee\u5355\u53f7/\u62a5\u4ef7\u5355\u53f7/\u5ba2\u6237'} />
          <button className="primary-action search-action" disabled={loading} onClick={() => {
            setPage(1);
            if (page === 1) load().catch((err) => setError(err.message));
          }}>{loading ? '\u52a0\u8f7d\u4e2d...' : '\u641c\u7d22'}</button>
        </div>
      </div>
      <FeedbackDialog message={error} onClose={() => setError('')} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{'\u9879\u76ee\u5355\u53f7'}</th>
              <th>{'\u62a5\u4ef7\u5355\u53f7'}</th>
              <th>{'\u5ba2\u6237'}</th>
              <th>承接单位</th>
              <th>{'\u9879\u76ee\u540d\u79f0'}</th>
              <th>{'\u62a5\u4ef7\u91c7\u8d2d\u6210\u672c(USD)'}</th>
              <th>{'\u5df2\u91c7\u8d2d\u6210\u672c(USD)'}</th>
              <th>{'\u62a5\u4ef7\u9500\u552e\u6536\u5165(USD)'}</th>
              <th>{'\u5df2\u9500\u552e\u6536\u5165(USD)'}</th>
              <th>{'\u9879\u76ee\u6bdb\u5229(USD)'}</th>
              <th>{'\u72b6\u6001'}</th>
              <th className="actions">{'\u64cd\u4f5c'}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingTableRows columns={12} rows={Math.min(pageSize, 8)} />}
            {!loading && rows.map((row) => (
              <tr key={row.id}>
                <td><LinkedNumber to={`/settlement-projects/${row.id}`}>{row.projectNo}</LinkedNumber></td>
                <td><LinkedNumber to={`/quotation/detail/${row.quotationId}`}>{row.quotationNo}</LinkedNumber></td>
                <td>{row.customerName || '-'}</td>
                <td>{row.contractingEntityName || '未设置'}</td>
                <td>{row.remark || '-'}</td>
                <td className="numeric-cell">{money(row.quotedPurchaseCostUsd)}</td>
                <td className="numeric-cell">{money(row.purchasedCostUsd)}</td>
                <td className="numeric-cell">{money(row.quotedSalesRevenueUsd)}</td>
                <td className="numeric-cell">{money(row.receivedRevenueUsd)}</td>
                <td className="numeric-cell">{money(row.grossProfitUsd)}</td>
                <td><span className={`badge ${row.status}`}>{row.status === 'completed' ? '\u5df2\u5b8c\u6210' : '\u8fdb\u884c\u4e2d'}</span></td>
                <td className="actions">
                  <Link to={`/settlement-projects/${row.id}`}>{'\u67e5\u770b'}</Link>
                  <button className="danger-action" type="button" onClick={() => remove(row.id)}>{'\u5220\u9664'}</button>
                </td>
              </tr>
            ))}
            {!loading && !rows.length && (
              <tr>
                <td colSpan={12} className="empty-cell">{'\u6682\u65e0\u9879\u76ee\u7ed3\u7b97\u6570\u636e\uff0c\u62a5\u4ef7\u5355\u786e\u8ba4\u540e\u4f1a\u81ea\u52a8\u751f\u6210\u3002'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination-bar">
        <span>{'\u7b2c'} {page} / {totalPages} {'\u9875'}</span>
        <button type="button" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{'\u4e0a\u4e00\u9875'}</button>
        <button type="button" disabled={loading || page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>{'\u4e0b\u4e00\u9875'}</button>
        <label>
          {'\u6bcf\u9875'}
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
  return formatMoney(value);
}
