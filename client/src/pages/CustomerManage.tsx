import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { apiGet, apiWrite, download } from '../api.js';
import type { Customer, CustomerPage } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import LoadingTableRows from '../components/LoadingTableRows.js';

const pageSize = 20;

export default function CustomerManage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextPage = page, nextKeyword = keyword) {
    setLoading(true);
    try {
      const result = await apiGet<CustomerPage>(`/customers?keyword=${encodeURIComponent(nextKeyword)}&page=${nextPage}&pageSize=${pageSize}`);
      setCustomers(result.items);
      setTotal(result.total);
      setPage(result.page);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(1, ''); }, []);

  async function remove(customer: Customer) {
    if (!confirm(`确认删除客户“${customer.shortName || customer.name}”及其银行账户、联系人和附件吗？`)) return;
    try {
      await apiWrite(`/customers/${customer.id}`, 'DELETE');
      await load(customers.length === 1 && page > 1 ? page - 1 : page);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <section className="admin-page customer-list-page">
    <header className="page-header admin-title-bar">
      <div className="page-title"><h1>客户档案</h1><p>维护客户主体、银行账户、联系人与业务附件</p></div>
    </header>
    <div className="workspace-toolbar">
      <div className="search-group">
        <input className="search-input" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(1); }} placeholder="客户编码、名称、税号、国家或联系人" />
        <button className="primary-action search-action" type="button" onClick={() => void load(1)}><Search size={16} />搜索</button>
      </div>
      <div className="toolbar action-toolbar">
        <button className="primary-action" type="button" onClick={() => navigate('/customers/new')}><Plus size={16} />新增客户</button>
        <button type="button" onClick={() => download('/customers/export')}><Download size={16} />导出</button>
      </div>
    </div>
    <FeedbackDialog message={error} onClose={() => setError('')} />
    <div className="table-wrap"><table><thead><tr>
      <th>客户编码</th><th>客户简称</th><th>客户名称（中文）</th><th>客户名称（英文）</th><th>国家</th><th>税号</th><th>默认联系人</th><th>联系方式</th><th>联系邮箱</th><th className="actions">操作</th>
    </tr></thead><tbody>
      {loading && <LoadingTableRows columns={10} rows={8} />}
      {!loading && customers.map((customer) => <tr key={customer.id}>
        <td>{customer.customerCode || '-'}</td><td><strong>{customer.shortName || customer.name}</strong></td><td>{customer.nameCn || customer.name}</td><td>{customer.nameEn || '-'}</td><td>{customer.country || '-'}</td><td>{customer.taxNumber || '-'}</td><td>{customer.contactName || '-'}</td><td>{customer.contactPhone || '-'}</td><td>{customer.contactEmail || '-'}</td>
        <td className="actions"><button className="icon-button" type="button" title="查看客户档案" onClick={() => navigate(`/customers/${customer.id}`)}><Eye size={16} /></button><button className="icon-button danger" type="button" title="删除客户" onClick={() => void remove(customer)}><Trash2 size={16} /></button></td>
      </tr>)}
      {!loading && !customers.length && <tr><td colSpan={10} className="empty-cell">暂无客户档案</td></tr>}
    </tbody></table></div>
    <div className="pagination-bar"><span>共 {total} 条</span><div className="pagination-actions"><button type="button" disabled={page <= 1} onClick={() => void load(page - 1)}>上一页</button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => void load(page + 1)}>下一页</button></div></div>
  </section>;
}
