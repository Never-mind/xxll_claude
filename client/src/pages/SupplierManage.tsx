import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, Plus, Search, Trash2, Upload } from 'lucide-react';
import { apiGet, apiWrite, download, upload } from '../api.js';
import type { Supplier, SupplierPage } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import LoadingTableRows from '../components/LoadingTableRows.js';

const pageSize = 20;

const statusLabels: Record<Supplier['cooperationStatus'], string> = {
  normal: '正常合作',
  suspended: '暂停合作',
  terminated: '终止合作',
  not_cooperated: '未合作过',
};

const typeLabels: Record<Supplier['supplierType'], string> = {
  manufacturer: '原厂',
  agent: '代理商',
  integrator: '集成商',
  third_party: '第三方',
};

export default function SupplierManage() {
  const navigate = useNavigate();
  const uploadInput = useRef<HTMLInputElement>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [supplierType, setSupplierType] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  async function load(nextPage = page, nextKeyword = keyword, nextStatus = status, nextSupplierType = supplierType) {
    setLoading(true);
    try {
      const result = await apiGet<SupplierPage>(`/suppliers?keyword=${encodeURIComponent(nextKeyword)}&status=${encodeURIComponent(nextStatus)}&type=${encodeURIComponent(nextSupplierType)}&page=${nextPage}&pageSize=${pageSize}`);
      setSuppliers(result.items);
      setTotal(result.total);
      setPage(result.page);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(1, '', '', ''); }, []);

  async function remove(supplier: Supplier) {
    if (!confirm(`确认删除供应商“${supplier.nameCn}”及其银行账户、联系人和附件吗？`)) return;
    try {
      await apiWrite(`/suppliers/${supplier.id}`, 'DELETE');
      await load(suppliers.length === 1 && page > 1 ? page - 1 : page);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function importSuppliers(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const result = await upload('/suppliers/import', file);
      const errors = result.errors.length ? `\n${result.errors.slice(0, 3).join('\n')}` : '';
      setError(`已导入 ${result.imported} 条供应商档案${errors}`);
      await load(1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <section className="admin-page customer-list-page supplier-list-page">
    <header className="page-header admin-title-bar supplier-page-heading">
      <div className="page-title"><h1>供应商管理</h1></div>
      <div className="toolbar action-toolbar supplier-header-actions">
        <input ref={uploadInput} className="visually-hidden" type="file" accept=".xlsx,.xls" onChange={(event) => void importSuppliers(event)} />
        <button type="button" disabled={importing} onClick={() => uploadInput.current?.click()}><Upload size={16} />{importing ? '导入中...' : '导入'}</button>
        <button type="button" onClick={() => download('/suppliers/export')}><Download size={16} />导出</button>
        <button className="primary-action" type="button" onClick={() => navigate('/suppliers/new')}><Plus size={16} />新增供应商</button>
      </div>
    </header>
    <div className="workspace-toolbar supplier-toolbar supplier-filter-bar">
      <div className="supplier-filter-grid">
        <input className="search-input" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(1); }} placeholder="供应商编码、名称、国家、品牌或联系人" />
        <select value={status} onChange={(event) => { setStatus(event.target.value); void load(1, keyword, event.target.value, supplierType); }} aria-label="合作状态">
          <option value="">全部合作状态</option><option value="normal">正常合作</option><option value="suspended">暂停合作</option><option value="terminated">终止合作</option><option value="not_cooperated">未合作过</option>
        </select>
        <select value={supplierType} onChange={(event) => { setSupplierType(event.target.value); void load(1, keyword, status, event.target.value); }} aria-label="供应商类型">
          <option value="">全部供应商类型</option><option value="manufacturer">原厂</option><option value="agent">代理商</option><option value="integrator">集成商</option><option value="third_party">第三方</option>
        </select>
        <button className="primary-action search-action" type="button" onClick={() => void load(1)}><Search size={16} />搜索</button>
      </div>
    </div>
    <FeedbackDialog message={error} onClose={() => setError('')} />
    <div className="table-wrap"><table><thead><tr>
      <th>供应商编码</th><th>供应商名称</th><th>类型</th><th>国家/地区</th><th>主要供应品类</th><th>合作品牌</th><th>合作状态</th><th>默认联系人</th><th className="actions">操作</th>
    </tr></thead><tbody>
      {loading && <LoadingTableRows columns={9} rows={8} />}
      {!loading && suppliers.map((supplier) => <tr key={supplier.id}>
        <td>{supplier.supplierCode}</td>
        <td><strong>{supplier.nameCn}</strong>{supplier.nameEn && <small className="supplier-en-name">{supplier.nameEn}</small>}</td>
        <td>{typeLabels[supplier.supplierType]}</td><td>{[supplier.country, supplier.city].filter(Boolean).join(' / ') || '-'}</td>
        <td><TagList values={supplier.supplyCategories} /></td><td><TagList values={supplier.brands} branded /></td>
        <td><span className={`supplier-status supplier-status-${supplier.cooperationStatus}`}>{statusLabels[supplier.cooperationStatus]}</span></td>
        <td>{supplier.contactName || '-'}{supplier.contactPhone && <small className="supplier-contact-phone">{supplier.contactPhone}</small>}</td>
        <td className="actions"><button className="icon-button" type="button" title="查看供应商档案" onClick={() => navigate(`/suppliers/${supplier.id}`)}><Eye size={16} /></button><button className="icon-button danger" type="button" title="删除供应商" onClick={() => void remove(supplier)}><Trash2 size={16} /></button></td>
      </tr>)}
      {!loading && !suppliers.length && <tr><td colSpan={9} className="empty-cell">暂无供应商档案</td></tr>}
    </tbody></table></div>
    <div className="pagination-bar"><span>共 {total} 条</span><div className="pagination-actions"><button type="button" disabled={page <= 1} onClick={() => void load(page - 1)}>上一页</button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => void load(page + 1)}>下一页</button></div></div>
  </section>;
}

function TagList({ values, branded = false }: { values: string[]; branded?: boolean }) {
  if (!values.length) return <>-</>;
  return <div className={`supplier-tag-list${branded ? ' is-branded' : ''}`}>{values.slice(0, 3).map((value) => <span key={value}>{value}</span>)}{values.length > 3 && <span>+{values.length - 3}</span>}</div>;
}
