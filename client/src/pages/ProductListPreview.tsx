import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Cable,
  Download,
  Edit3,
  Eye,
  Filter,
  Package,
  Search,
  Server,
  Sparkles,
} from 'lucide-react';

type ProductMaster = {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  category: string;
  unit: string;
  modelCount: number;
  specCount: number;
  updatedAt: string;
  status: '已启用' | '已停用';
  icon: typeof Cable;
  models: Array<{ brand: string; model: string; mode: string; specs: string; supplier: string }>;
};

const masterProducts: ProductMaster[] = [
  {
    id: 'cab', code: 'CAB-001', name: '网线', nameEn: 'Network Cable', category: '线缆', unit: '条', modelCount: 3, specCount: 12, updatedAt: '2026-08-20 10:42', status: '已启用', icon: Cable,
    models: [
      { brand: 'NetLink', model: 'CAT6 UTP', mode: '参数化规格', specs: '1 条规则', supplier: '深圳连线科技有限公司' },
      { brand: 'ProCable', model: 'CAT6 UTP Pro', mode: '参数化规格', specs: '1 条规则', supplier: 'ProCable Global Ltd.' },
      { brand: 'NetLink', model: 'CAT6A SFTP', mode: '固定规格', specs: '4 个规格', supplier: '深圳连线科技有限公司' },
    ],
  },
  {
    id: 'opt', code: 'OPT-002', name: '光模块', nameEn: 'Optical Transceiver', category: '网络设备配件', unit: '个', modelCount: 2, specCount: 8, updatedAt: '2026-08-19 16:08', status: '已启用', icon: Sparkles,
    models: [
      { brand: 'FiberMax', model: 'SFP-1G-LX', mode: '固定规格', specs: '4 个规格', supplier: '广州光联供应链' },
      { brand: 'FiberMax', model: 'SFP-10G-SR', mode: '固定规格', specs: '4 个规格', supplier: '广州光联供应链' },
    ],
  },
  {
    id: 'srv', code: 'SRV-003', name: '机架式服务器', nameEn: 'Rack Server', category: '服务器', unit: '台', modelCount: 4, specCount: 4, updatedAt: '2026-08-18 09:31', status: '已启用', icon: Server,
    models: [
      { brand: 'Dell', model: 'PowerEdge R760', mode: '固定规格', specs: '1 个规格', supplier: '戴尔科技' },
      { brand: 'HPE', model: 'ProLiant DL380 Gen11', mode: '固定规格', specs: '1 个规格', supplier: '慧与科技' },
      { brand: 'Lenovo', model: 'ThinkSystem SR650', mode: '固定规格', specs: '1 个规格', supplier: '联想企业业务' },
      { brand: '浪潮', model: 'NF5688M6', mode: '固定规格', specs: '1 个规格', supplier: '浪潮' },
    ],
  },
];

export default function ProductListPreview() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('全部品类');
  const [status, setStatus] = useState('全部状态');
  const [expanded, setExpanded] = useState<string[]>(['cab']);
  const filteredRows = useMemo(() => masterProducts.filter((item) => {
    const content = `${item.code} ${item.name} ${item.nameEn} ${item.category}`.toLowerCase();
    return (!keyword || content.includes(keyword.toLowerCase())) && (category === '全部品类' || item.category === category) && (status === '全部状态' || item.status === status);
  }), [category, keyword, status]);

  function toggle(id: string) {
    setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <section className="product-list-preview">
    <header className="product-list-preview-header"><div><div className="list-preview-breadcrumb"><span>产品管理</span><ChevronRight size={14} /><strong>产品主档列表预览</strong></div><h1>产品主档</h1><p>按设备类型归纳产品，品牌型号和可报价规格在档案内维护。</p></div><div className="list-preview-header-actions"><button type="button" onClick={() => navigate('/product-archive-preview')}><Eye size={16} />查看档案效果</button><button className="primary-action" type="button"><CirclePlus size={16} />新增产品主档</button></div></header>

    <div className="product-list-summary"><div><span>产品主档</span><strong>36</strong><small>个</small></div><div><span>品牌型号</span><strong>92</strong><small>个</small></div><div><span>可报价规格</span><strong>248</strong><small>条</small></div><div className="list-summary-tip"><Filter size={15} /><span>列表默认显示主档，展开后查看品牌型号</span></div></div>

    <div className="product-list-toolbar"><div className="list-preview-search"><Search size={16} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索主档编码、名称或品类" /></div><select value={category} onChange={(event) => setCategory(event.target.value)}><option>全部品类</option><option>线缆</option><option>网络设备配件</option><option>服务器</option></select><select value={status} onChange={(event) => setStatus(event.target.value)}><option>全部状态</option><option>已启用</option><option>已停用</option></select><button type="button"><Search size={15} />查询</button><div className="list-toolbar-spacer" /><button type="button"><Download size={15} />导出</button></div>

    <div className="product-list-table-wrap"><table className="product-list-preview-table"><thead><tr><th className="list-expand-column" /><th>产品主档</th><th>品类</th><th>品牌型号</th><th>可报价规格</th><th>默认单位</th><th>更新时间</th><th>状态</th><th className="actions">操作</th></tr></thead><tbody>
      {filteredRows.map((item) => { const Icon = item.icon; const isExpanded = expanded.includes(item.id); return <>
        <tr className="product-list-master-row" key={item.id}><td className="list-expand-column"><button type="button" className="list-expand-button" aria-label={isExpanded ? `收起${item.name}` : `展开${item.name}`} onClick={() => toggle(item.id)}>{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></td><td><div className="list-product-name"><span className="list-product-icon"><Icon size={18} /></span><span><strong>{item.name}</strong><small>{item.code} · {item.nameEn}</small></span></div></td><td>{item.category}</td><td><strong className="list-count-value">{item.modelCount}</strong><span className="list-count-label"> 个型号</span></td><td><strong className="list-count-value">{item.specCount}</strong><span className="list-count-label"> 条</span></td><td>{item.unit}</td><td className="list-updated-time">{item.updatedAt}</td><td><span className="list-status-enabled">{item.status}</span></td><td className="actions"><button type="button" title="查看产品档案" onClick={() => navigate('/product-archive-preview')}><Eye size={15} /></button><button type="button" title="修改产品主档"><Edit3 size={15} /></button></td></tr>
        {isExpanded && <tr className="product-list-model-heading" key={`${item.id}-heading`}><td /><td colSpan={2}>品牌型号</td><td>计价方式</td><td>规格数量</td><td colSpan={2}>默认供应商</td><td>状态</td><td /></tr>}
        {isExpanded && item.models.map((model) => <tr className="product-list-model-row" key={`${item.id}-${model.brand}-${model.model}`}><td /><td colSpan={2}><div className="list-model-cell"><span className="list-model-dot" /><span><strong>{model.brand}</strong><small>{model.model}</small></span></div></td><td><span className="list-mode-label">{model.mode}</span></td><td>{model.specs}</td><td colSpan={2}>{model.supplier}</td><td><span className="list-status-enabled">已启用</span></td><td className="actions"><button type="button" title="编辑品牌型号"><Edit3 size={14} /></button></td></tr>)}
      </>; })}
      {!filteredRows.length && <tr><td colSpan={9} className="list-preview-empty">没有符合条件的产品主档</td></tr>}
    </tbody></table></div>
    <footer className="product-list-preview-footer"><span>共 36 个产品主档</span><div><button type="button" disabled>上一页</button><strong>1</strong><button type="button">2</button><button type="button">3</button><button type="button">下一页 <ChevronRight size={14} /></button></div><label>每页 <select defaultValue="10"><option>10</option><option>20</option><option>50</option></select></label></footer>
  </section>;
}
