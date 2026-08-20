import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Plus, Search, Trash2 } from 'lucide-react';
import { apiGet, apiWrite } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import LoadingTableRows from '../components/LoadingTableRows.js';
import type { ContractingEntity, ContractingEntityPage } from '../api.js';

export default function ContractingEntityManage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ContractingEntity[]>([]);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function load(nextPage = page, nextKeyword = keyword) {
    setLoading(true);
    try {
      const query = new URLSearchParams({ keyword: nextKeyword, page: String(nextPage), pageSize: String(pageSize) });
      const result = await apiGet<ContractingEntityPage>(`/contracting-entities?${query}`);
      setRows(result.items);
      setTotal(result.total);
      setPage(result.page);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, pageSize]);

  async function remove(row: ContractingEntity) {
    if (!confirm(`确认删除承接单位“${row.shortName || row.entityName}”？已生成的报价和项目不会被删除。`)) return;
    try {
      await apiWrite(`/contracting-entities/${row.id}`, 'DELETE');
      await load(rows.length === 1 && page > 1 ? page - 1 : page);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return <section className="admin-page supplier-list-page">
    <header className="page-header supplier-page-heading">
      <div className="page-title"><h1>承接单位</h1><p>维护项目承接主体、收款账户、联系人与附件。</p></div>
      <div className="supplier-header-actions"><button className="primary-action" type="button" onClick={() => navigate('/contracting-entities/new')}><Plus size={16} />新增承接单位</button></div>
    </header>
    <div className="supplier-filter-bar"><div className="supplier-filter-grid">
      <input className="search-input" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(1); }} placeholder="编码、简称、全称、国家或联系人" />
      <button className="primary-action search-action" type="button" onClick={() => void load(1)}><Search size={16} />搜索</button>
    </div></div>
    <FeedbackDialog message={error} onClose={() => setError('')} />
    <div className="table-wrap"><table><thead><tr><th>单位编码</th><th>单位简称</th><th>单位全称（中文）</th><th>单位全称（英文）</th><th>国家/地区</th><th>默认联系人</th><th className="actions">操作</th></tr></thead><tbody>
      {loading && <LoadingTableRows columns={7} rows={8} />}
      {!loading && rows.map((row) => <tr key={row.id}>
        <td>{row.entityCode}</td><td><strong>{row.shortName || row.entityName}</strong></td><td>{row.nameCn || row.entityName}</td><td>{row.nameEn || '-'}</td><td>{row.country || '-'}</td><td>{row.contactName || '-'}</td>
        <td className="actions"><button className="icon-button" type="button" title="查看承接单位档案" onClick={() => navigate(`/contracting-entities/${row.id}`)}><Eye size={16} /></button><button className="icon-button danger" type="button" title="删除承接单位" onClick={() => void remove(row)}><Trash2 size={16} /></button></td>
      </tr>)}
      {!loading && !rows.length && <tr><td colSpan={7} className="empty-cell">暂无承接单位档案</td></tr>}
    </tbody></table></div>
    <div className="pagination-bar"><span>共 {total} 条</span><div className="pagination-actions"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页</button></div><label>每页 <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label></div>
  </section>;
}
