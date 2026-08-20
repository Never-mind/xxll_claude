import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Cable,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileClock,
  History,
  Minus,
  PackagePlus,
  Plus,
  Search,
  Server,
  Sparkles,
} from 'lucide-react';

type PricingMode = 'parameter' | 'fixed';

type Variant = {
  id: string;
  brand: string;
  model: string;
  category: string;
  mode: PricingMode;
  baseLength?: number;
  basePrice?: number;
  stepLength?: number;
  stepPrice?: number;
  fixedSpecs?: Array<{ label: string; length: number; price: number; code: string }>;
};

const variants: Variant[] = [
  {
    id: 'cat6-a',
    brand: 'NetLink',
    model: 'CAT6 UTP',
    category: '六类非屏蔽网线',
    mode: 'parameter',
    baseLength: 1,
    basePrice: 3.2,
    stepLength: 1,
    stepPrice: 1.15,
  },
  {
    id: 'cat6-b',
    brand: 'ProCable',
    model: 'CAT6 UTP Pro',
    category: '六类非屏蔽网线',
    mode: 'parameter',
    baseLength: 1,
    basePrice: 3.6,
    stepLength: 1,
    stepPrice: 1.32,
  },
  {
    id: 'cat6a',
    brand: 'NetLink',
    model: 'CAT6A SFTP',
    category: '超六类屏蔽网线',
    mode: 'fixed',
    fixedSpecs: [
      { label: '1m', length: 1, price: 5.8, code: 'NL-C6A-01' },
      { label: '2m', length: 2, price: 7.1, code: 'NL-C6A-02' },
      { label: '5m', length: 5, price: 10.9, code: 'NL-C6A-05' },
      { label: '10m', length: 10, price: 17.6, code: 'NL-C6A-10' },
    ],
  },
];

const masterProducts = [
  { name: '网线', code: 'CAB', count: 12, icon: Cable, selected: true },
  { name: '光模块', code: 'OPT', count: 8, icon: Sparkles },
  { name: '服务器', code: 'SRV', count: 24, icon: Server },
];

const historyByVariant: Record<string, Array<{ customer: string; date: string; length: number; quote: number }>> = {
  'cat6-a': [
    { customer: '滴滴', date: '2026-08-12', length: 5, quote: 16.42 },
    { customer: '滴滴', date: '2026-06-29', length: 3, quote: 13.96 },
    { customer: '滴滴', date: '2026-05-08', length: 10, quote: 22.18 },
  ],
  'cat6-b': [
    { customer: '滴滴', date: '2026-08-03', length: 5, quote: 17.35 },
    { customer: '滴滴', date: '2026-06-17', length: 3, quote: 14.72 },
    { customer: '滴滴', date: '2026-04-22', length: 10, quote: 23.84 },
  ],
  cat6a: [
    { customer: '滴滴', date: '2026-08-09', length: 5, quote: 22.48 },
    { customer: '滴滴', date: '2026-07-01', length: 2, quote: 17.95 },
    { customer: '滴滴', date: '2026-05-20', length: 10, quote: 31.86 },
  ],
};

export default function ProductModelPreview() {
  const [variantId, setVariantId] = useState('cat6-a');
  const [length, setLength] = useState(5);
  const [fixedLength, setFixedLength] = useState(5);
  const [quoteAdded, setQuoteAdded] = useState(false);
  const [search, setSearch] = useState('');
  const variant = variants.find((item) => item.id === variantId) || variants[0];
  const isParameter = variant.mode === 'parameter';
  const selectedLength = isParameter ? length : fixedLength;
  const fixedSpec = variant.fixedSpecs?.find((item) => item.length === fixedLength) || variant.fixedSpecs?.[0];
  const purchasePrice = useMemo(() => {
    if (!isParameter) return fixedSpec?.price || 0;
    const baseLength = variant.baseLength || 1;
    const stepLength = variant.stepLength || 1;
    const extraSteps = Math.max(0, Math.ceil((length - baseLength) / stepLength));
    return (variant.basePrice || 0) + extraSteps * (variant.stepPrice || 0);
  }, [fixedSpec?.price, isParameter, length, variant]);
  const productCode = isParameter ? `NL-C6-${String(selectedLength).padStart(2, '0')}` : fixedSpec?.code || '';
  const shippingWeight = 0.11 + Math.max(0, selectedLength - 1) * 0.08;
  const quoteUnitPrice = purchasePrice * 1.32;
  const visibleMasters = masterProducts.filter((item) => item.name.includes(search) || item.code.toLowerCase().includes(search.toLowerCase()));
  const historyRows = historyByVariant[variant.id] || [];
  const exactHistory = historyRows.find((row) => row.length === selectedLength);

  function changeLength(delta: number) {
    setLength((current) => Math.max(1, Math.min(30, current + delta)));
    setQuoteAdded(false);
  }

  return <section className="product-model-preview">
    <header className="product-model-preview-header">
      <div>
        <div className="preview-breadcrumb"><span>产品管理</span><ChevronRight size={14} /><strong>产品结构预览</strong></div>
        <h1>产品主档与可报价规格</h1>
      </div>
      <div className="preview-header-actions"><span className="preview-status"><span />模拟数据</span><button type="button" onClick={() => window.history.back()}><ArrowLeft size={16} />返回</button></div>
    </header>

    <div className="product-model-preview-layout">
      <aside className="preview-master-panel">
        <div className="preview-panel-heading"><div><span>产品主档</span><strong>36</strong></div><button type="button" title="新增产品主档"><Plus size={16} /></button></div>
        <label className="preview-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索产品主档" /></label>
        <div className="preview-master-list">
          {visibleMasters.map(({ name, code, count, icon: Icon, selected }) => <button className={`preview-master-item${selected ? ' is-selected' : ''}`} type="button" key={code}>
            <span className="preview-product-icon"><Icon size={18} /></span><span><strong>{name}</strong><small>{code} · {count} 个型号</small></span><ChevronRight size={15} />
          </button>)}
        </div>
        <div className="preview-master-summary"><Cable size={18} /><div><strong>网线</strong><span>3 个品牌型号 · 2 种计价方式</span></div></div>
      </aside>

      <section className="preview-selection-panel">
        <div className="preview-section-head"><div><span>01</span><div><h2>选择品牌型号</h2><p>网线 / 六类非屏蔽网线</p></div></div><button type="button" className="preview-link-button">管理型号 <ArrowRight size={14} /></button></div>
        <div className="preview-variant-grid">
          {variants.map((item) => <button key={item.id} type="button" className={`preview-variant-card${item.id === variant.id ? ' is-selected' : ''}`} onClick={() => { setVariantId(item.id); setQuoteAdded(false); }}>
            <span className="preview-radio">{item.id === variant.id && <Check size={12} />}</span>
            <span className="preview-variant-brand">{item.brand}</span><strong>{item.model}</strong><small>{item.mode === 'parameter' ? '参数化规格' : '固定规格'}</small>
          </button>)}
        </div>

        <div className="preview-section-divider" />
        <div className="preview-section-head preview-compact-head"><div><span>02</span><div><h2>配置可报价规格</h2><p>{variant.brand} / {variant.model}</p></div></div><span className={`preview-pricing-badge ${isParameter ? 'parameter' : 'fixed'}`}><CircleDollarSign size={14} />{isParameter ? '按参数计价' : '固定规格价'}</span></div>

        {isParameter ? <div className="preview-pricing-workbench">
          <div className="preview-parameter-card">
            <div><span>长度</span><strong>{length}<small> m</small></strong></div>
            <div className="preview-stepper"><button type="button" aria-label="长度减少 1 米" onClick={() => changeLength(-1)}><Minus size={15} /></button><span>{length} m</span><button type="button" aria-label="长度增加 1 米" onClick={() => changeLength(1)}><Plus size={15} /></button></div>
          </div>
          <div className="preview-rule-card">
            <div className="preview-rule-title"><span>计价规则</span><button type="button" title="编辑计价规则"><ChevronDown size={15} /></button></div>
            <div className="preview-rule-line"><span>基准长度</span><strong>{variant.baseLength} m</strong><span>基准采购价</span><strong>USD {formatMoney(variant.basePrice || 0)}</strong></div>
            <div className="preview-rule-line"><span>增量规则</span><strong>每增加 {variant.stepLength} m</strong><span>采购加价</span><strong>USD {formatMoney(variant.stepPrice || 0)}</strong></div>
            <div className="preview-rule-result"><span>本次规格：{length}m</span><strong>USD {formatMoney(purchasePrice)}</strong></div>
          </div>
        </div> : <div className="preview-fixed-spec-grid">
          {variant.fixedSpecs?.map((spec) => <button type="button" key={spec.code} className={spec.length === fixedLength ? 'is-selected' : ''} onClick={() => { setFixedLength(spec.length); setQuoteAdded(false); }}><strong>{spec.label}</strong><span>USD {formatMoney(spec.price)}</span><small>{spec.code}</small></button>)}
        </div>}

        <div className="preview-product-output">
          <div><span>产品编码</span><strong>{productCode}</strong></div><div><span>规格</span><strong>长度：{selectedLength}m</strong></div><div><span>预估重量</span><strong>{shippingWeight.toFixed(2)} kg</strong></div><div><span>建议采购价</span><strong>USD {formatMoney(purchasePrice)}</strong></div>
        </div>
        <button className={`preview-add-button${quoteAdded ? ' is-added' : ''}`} type="button" onClick={() => setQuoteAdded(true)}>{quoteAdded ? <><Check size={17} />已加入报价单</> : <><PackagePlus size={17} />加入报价单</>}</button>
      </section>

      <aside className="preview-reference-panel">
        <section className="preview-quote-card">
          <div className="preview-side-heading"><div><span>报价明细</span><strong>草稿 Q-20260820-001</strong></div><button type="button" title="打开报价单"><ArrowRight size={16} /></button></div>
          {quoteAdded ? <div className="preview-added-line"><Cable size={18} /><div><strong>网线 · {variant.brand} {variant.model}</strong><span>{productCode} · 长度：{selectedLength}m</span></div><strong>USD {formatMoney(quoteUnitPrice)}</strong></div> : <div className="preview-empty-quote"><PackagePlus size={21} /><span>尚未加入产品</span></div>}
          <div className="preview-quote-total"><span>DDP 不含税单价</span><strong>USD {formatMoney(quoteAdded ? quoteUnitPrice : 0)}</strong></div>
        </section>

        <section className="preview-history-card">
          <div className="preview-side-heading"><div><span>历史报价</span><strong>客户：滴滴</strong></div><History size={17} /></div>
          <div className={`preview-history-match${exactHistory ? '' : ' is-empty'}`}><span className="preview-match-dot" /><div><strong>{exactHistory ? `${variant.brand} · ${variant.model} · 长度：${selectedLength}m` : '暂无完全相同规格的历史报价'}</strong><small>{exactHistory ? '精确匹配：产品主档 + 品牌型号 + 规格键' : '下方仅展示同品牌型号的其他规格参考价'}</small></div></div>
          <div className="preview-history-list">
            {historyRows.map((row) => <div className={`preview-history-row${row.length === selectedLength ? ' is-exact' : ''}`} key={`${row.date}-${row.length}`}><div><strong>长度：{row.length}m</strong><span>{row.customer} · {row.date}</span></div><div><small>{row.length === selectedLength ? '精确匹配' : '同型号参考'}</small><strong>USD {formatMoney(row.quote)}</strong></div></div>)}
          </div>
          <button type="button" className="preview-history-button"><FileClock size={15} />查看全部历史报价</button>
        </section>

        <div className="preview-snapshot-note"><Check size={15} /><span>确认报价后，型号、规格、重量和计价结果均保存为报价快照。</span></div>
      </aside>
    </div>
  </section>;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
