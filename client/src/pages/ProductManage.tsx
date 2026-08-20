import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2, Upload, Download } from 'lucide-react';
import { apiGet, apiWrite, download, upload } from '../api.js';
import type { Product, ProductPage, TariffPage, TariffRate } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import LoadingTableRows from '../components/LoadingTableRows.js';

type ProductDraft = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

const emptyDraft = (): ProductDraft => ({
  productCode: '', name: '', spec: '', brand: '', category: '', unit: '个', length: 0, width: 0, height: 0, grossWeight: 0,
  hsCodeCn: '', hsCodeMx: '', suggestedPrice: 0, contactName1: '', contactPhone1: '', contactName2: '', contactPhone2: '',
  isMagnetic: false, isElectric: false, needNom: false, imageUrl: '',
});

export default function ProductManage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [tariffs, setTariffs] = useState<TariffRate[]>([]);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function load(nextPage: number | unknown = page) {
    const resolvedPage = typeof nextPage === 'number' ? nextPage : 1;
    setLoading(true);
    try {
      const [productPage, tariffPage] = await Promise.all([
        apiGet<ProductPage>(`/products?keyword=${encodeURIComponent(keyword)}&page=${resolvedPage}&pageSize=${pageSize}`),
        apiGet<TariffPage>('/tariff-rates?page=1&pageSize=50'),
      ]);
      setProducts(productPage.items);
      setTotal(productPage.total);
      setPage(productPage.page);
      setTariffs(tariffPage.items);
      setExpanded([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(page); }, [page]);

  const groups = useMemo(() => groupProducts(products), [products]);

  async function save() {
    if (!editing) return;
    const payload = normalizeDraft(editing, tariffs);
    try {
      await apiWrite(`/products${editing.id ? `/${editing.id}` : ''}`, editing.id ? 'PUT' : 'POST', payload);
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(product: Product) {
    if (!confirm(`确认删除品牌型号“${product.brand || '-'} ${product.productCode}”？`)) return;
    try {
      await apiWrite(`/products/${product.id}`, 'DELETE');
      await load(products.length === 1 && page > 1 ? page - 1 : page);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      const result = await upload('/products/import', file);
      setError(`导入成功 ${result.imported} 条；失败 ${result.errors.length} 条${result.errors.length ? `\n${result.errors.slice(0, 3).join('\n')}` : ''}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return <section className="admin-page product-catalog-page">
    <header className="page-header admin-title-bar">
      <div className="page-title"><h1>产品信息管理</h1><p>{groups.length} 个产品主档，{products.length} 个品牌型号</p></div>
    </header>
    <div className="workspace-toolbar">
      <div className="search-group"><input className="search-input" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索产品编码、名称或品类" /><button className="primary-action search-action" onClick={load}><Search size={16} />搜索</button></div>
      <div className="toolbar action-toolbar">
        <button className="primary-action" onClick={() => setEditing(emptyDraft())}><Plus size={16} />新增产品</button>
        <label className="file-action"><Upload size={16} />导入<input type="file" accept=".xlsx,.xls" onChange={(event) => importFile(event.target.files?.[0])} /></label>
        <button onClick={() => download('/products/export')}><Download size={16} />导出</button>
      </div>
    </div>
    <FeedbackDialog message={error} onClose={() => setError('')} />
    <div className="product-catalog-note">同名称、规格和品类的记录会自动归入一个产品主档；展开后可维护不同品牌型号、供应商及采购价格。</div>
    <div className="table-wrap"><table><thead><tr><th>产品主档</th><th>通用规格</th><th>品类</th><th>品牌型号</th><th>默认展示</th><th>建议采购价</th><th className="actions">操作</th></tr></thead><tbody>
      {loading && <LoadingTableRows columns={7} rows={8} />}
      {!loading && groups.map((group) => <ProductGroup key={group.key} group={group} expanded={expanded.includes(group.key)} onToggle={() => setExpanded((current) => current.includes(group.key) ? current.filter((key) => key !== group.key) : [...current, group.key])} onEdit={setEditing} onRemove={remove} />)}
      {!loading && !groups.length && <tr><td colSpan={7} className="empty-cell">暂无产品数据</td></tr>}
    </tbody></table></div>
    <div className="pagination-bar"><span>共 {total} 条</span><div className="pagination-actions"><button type="button" disabled={loading || page <= 1} onClick={() => void load(page - 1)}>上一页</button><span>第 {page} / {totalPages} 页</span><button type="button" disabled={loading || page >= totalPages} onClick={() => void load(page + 1)}>下一页</button></div></div>
    {editing && <ProductDialog product={editing} tariffs={tariffs} onChange={setEditing} onClose={() => setEditing(null)} onSave={save} />}
  </section>;
}

function ProductGroup({ group, expanded, onToggle, onEdit, onRemove }: { group: ProductGroupData; expanded: boolean; onToggle: () => void; onEdit: (product: Partial<Product>) => void; onRemove: (product: Product) => void }) {
  const primary = group.items[0];
  return <>
    <tr className="product-master-row"><td><button type="button" className="product-master-toggle" onClick={onToggle}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<span><strong>{primary.name}</strong><small>{primary.productCode}</small></span></button></td><td>{primary.spec || '-'}</td><td>{primary.category || '-'}</td><td><span className="variant-count">{group.items.length} 个品牌型号</span></td><td>{primary.brand || '-'}</td><td>{formatMoney(primary.suggestedPrice)}</td><td className="actions"><button className="icon-button edit" title="编辑默认品牌型号" onClick={() => onEdit(primary)}><Pencil size={15} /></button></td></tr>
    {expanded && group.items.map((product) => <tr className="product-variant-row" key={product.id}><td><span className="product-variant-indent">品牌型号</span></td><td>{product.brand || '未填写品牌'}</td><td>{product.productCode}</td><td>{[product.contactName1, product.contactPhone1].filter(Boolean).join(' / ') || '-'}</td><td>{product.unit}</td><td>{formatMoney(product.suggestedPrice)}</td><td className="actions"><button className="icon-button edit" title="编辑" onClick={() => onEdit(product)}><Pencil size={15} /></button><button className="icon-button danger" title="删除" onClick={() => onRemove(product)}><Trash2 size={15} /></button></td></tr>)}
  </>;
}

function ProductDialog({ product, tariffs, onChange, onClose, onSave }: { product: Partial<Product>; tariffs: TariffRate[]; onChange: (product: Partial<Product>) => void; onClose: () => void; onSave: () => void }) {
  const update = (key: keyof Product, value: unknown) => onChange({ ...product, [key]: value });
  return <div className="modal-backdrop"><div className="modal product-dialog"><div className="modal-header"><h2>{product.id ? '编辑品牌型号' : '新增品牌型号'}</h2><button className="modal-close" onClick={onClose}>×</button></div><div className="form-grid">
    <Field label="产品编码" value={product.productCode} onChange={(value) => update('productCode', value)} /><Field label="产品主档名称" value={product.name} onChange={(value) => update('name', value)} /><Field label="通用规格" value={product.spec} onChange={(value) => update('spec', value)} /><Field label="品牌" value={product.brand} onChange={(value) => update('brand', value)} />
    <label><span>品类</span><select value={product.category || ''} onChange={(event) => update('category', event.target.value)}><option value="">请选择</option>{tariffs.map((tariff) => <option key={tariff.id} value={tariff.deviceType}>{tariff.deviceType}</option>)}</select></label><Field label="单位" value={product.unit} onChange={(value) => update('unit', value)} /><Field label="建议采购价（CNY）" type="number" value={product.suggestedPrice} onChange={(value) => update('suggestedPrice', Number(value || 0))} /><Field label="中国 HS 编码" value={product.hsCodeCn} onChange={(value) => update('hsCodeCn', value)} />
    <Field label="联系人" value={product.contactName1} onChange={(value) => update('contactName1', value)} /><Field label="联系方式" value={product.contactPhone1} onChange={(value) => update('contactPhone1', value)} /><Field label="长（cm）" type="number" value={product.length} onChange={(value) => update('length', Number(value || 0))} /><Field label="宽（cm）" type="number" value={product.width} onChange={(value) => update('width', Number(value || 0))} /><Field label="高（cm）" type="number" value={product.height} onChange={(value) => update('height', Number(value || 0))} /><Field label="毛重（kg）" type="number" value={product.grossWeight} onChange={(value) => update('grossWeight', Number(value || 0))} />
  </div><footer className="modal-actions"><button onClick={onClose}>取消</button><button className="primary-action" onClick={onSave}>保存</button></footer></div></div>;
}

function Field({ label, value, type = 'text', onChange }: { label: string; value: unknown; type?: string; onChange: (value: string) => void }) { return <label><span>{label}</span><input type={type} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} /></label>; }

type ProductGroupData = { key: string; items: Product[] };
function groupProducts(products: Product[]): ProductGroupData[] { const groups = new Map<string, Product[]>(); products.forEach((product) => { const key = [product.name, product.spec || '', product.category || ''].map((value) => value.trim().toLowerCase()).join('::'); groups.set(key, [...(groups.get(key) || []), product]); }); return [...groups.entries()].map(([key, items]) => ({ key, items })); }
function normalizeDraft(product: Partial<Product>, tariffs: TariffRate[]): ProductDraft { const tariff = tariffs.find((item) => item.deviceType === product.category); return { ...emptyDraft(), ...product, productCode: String(product.productCode || '').trim(), name: String(product.name || '').trim(), hsCodeMx: tariff?.hsCode || String(product.hsCodeMx || '') } as ProductDraft; }
function formatMoney(value: number) { return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
