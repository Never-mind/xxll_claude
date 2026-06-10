import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiWrite, download } from '../api.js';
import type { Quotation, QuotationPage } from '../api.js';

const tabs = [
  ['all', '全部'],
  ['draft', '草稿'],
  ['completed', '已完成'],
];

export default function QuotationList() {
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState<Quotation[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function load(nextPage = page, nextPageSize = pageSize) {
    const result = await apiGet<QuotationPage>(`/quotations?page=${nextPage}&pageSize=${nextPageSize}&status=${status}`);
    setRows(result.items);
    setTotal(result.total);
    setSelectedIds([]);
    const nextTotalPages = Math.max(1, Math.ceil(result.total / nextPageSize));
    if (nextPage > nextTotalPages) setPage(nextTotalPages);
  }

  useEffect(() => {
    load();
  }, [status, page, pageSize]);

  async function removeSelected() {
    if (!selectedIds.length) return;
    if (!confirm(`确认删除选中的 ${selectedIds.length} 张报价单？`)) return;
    for (const id of selectedIds) {
      await apiWrite(`/quotations/${id}`, 'DELETE');
    }
    await load();
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>报价列表</h1>
          <p>{total} 张报价单</p>
        </div>
        <div className="segmented">
          {tabs.map(([value, label]) => (
            <button key={value} className={status === value ? 'active' : ''} onClick={() => {
              setStatus(value);
              setPage(1);
            }}>
              {label}
            </button>
          ))}
          <button className="danger-action" disabled={!selectedIds.length} onClick={removeSelected}>删除</button>
          <button onClick={() => download(`/quotations/export?status=${status}`)}>导出</button>
        </div>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="全选"
                  checked={rows.length > 0 && selectedIds.length === rows.length}
                  onChange={(event) => setSelectedIds(event.target.checked ? rows.map((row) => row.id) : [])}
                />
              </th>
              <th>报价单号</th>
              <th>客户</th>
              <th>项目名称</th>
              <th>状态</th>
              <th>CIF(USD)</th>
              <th>到仓总价（USD）</th>
              <th>收入(USD)</th>
              <th>利润(USD)</th>
              <th>毛利率</th>
              <th>创建时间</th>
              <th className="actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label="选择"
                    checked={selectedIds.includes(row.id)}
                    onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
                  />
                </td>
                <td>{row.quotationNo}</td>
                <td>{row.customerName || '-'}</td>
                <td>{row.remark || '-'}</td>
                <td><span className={`badge ${row.status}`}>{row.status}</span></td>
                <td>{money(row.totalCifUsd)}</td>
                <td>{money(row.totalDdpUsd)}</td>
                <td>{money(row.totalRevenueUsd)}</td>
                <td>{money(row.totalProfitUsd)}</td>
                <td>{row.grossMarginRate.toFixed(2)}%</td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td className="actions">
                  <Link to={`/quotation/detail/${row.id}`}>查看</Link>
                  {row.status === 'draft' && <Link to={`/quotation/generate/${row.id}`}>修改</Link>}
                  <button onClick={() => download(`/quotations/${row.id}/export`)}>导出</button>
                  <button onClick={() => download(`/quotations/${row.id}/export-formal`)}>导出报价单</button>
                </td>
              </tr>
            ))}
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

function money(value: number) {
  return Number(value || 0).toFixed(2);
}
