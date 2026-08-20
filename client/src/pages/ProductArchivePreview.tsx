import { useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Cable,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Copy,
  Edit3,
  FileClock,
  FileText,
  Layers3,
  PackageCheck,
  Plus,
  Save,
  Settings2,
  Tag,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type ArchiveTab = 'base' | 'models' | 'rules' | 'references';
type RuleMode = 'parameter' | 'fixed';

const modelRows = [
  { id: 'netlink-cat6', brand: 'NetLink', model: 'CAT6 UTP', kind: '参数化规格', status: '已启用', specs: '1 条规则', accent: 'blue' },
  { id: 'procable-cat6', brand: 'ProCable', model: 'CAT6 UTP Pro', kind: '参数化规格', status: '已启用', specs: '1 条规则', accent: 'cyan' },
  { id: 'netlink-cat6a', brand: 'NetLink', model: 'CAT6A SFTP', kind: '固定规格', status: '已启用', specs: '4 个规格', accent: 'violet' },
];

const tabs: Array<{ key: ArchiveTab; label: string; icon: typeof Layers3 }> = [
  { key: 'base', label: '基础资料', icon: PackageCheck },
  { key: 'models', label: '品牌型号', icon: Layers3 },
  { key: 'rules', label: '报价规格', icon: CircleDollarSign },
  { key: 'references', label: '引用记录', icon: ClipboardList },
];

export default function ProductArchivePreview() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ArchiveTab>('models');
  const [selectedModelId, setSelectedModelId] = useState('netlink-cat6');
  const [ruleMode, setRuleMode] = useState<RuleMode>('parameter');
  const selectedModel = modelRows.find((item) => item.id === selectedModelId) || modelRows[0];

  return <section className="product-archive-preview">
    <header className="archive-topbar">
      <div className="archive-title-group">
        <button className="archive-back-button" type="button" title="返回产品结构预览" onClick={() => navigate('/product-model-preview')}><ArrowLeft size={17} /></button>
        <div><div className="archive-breadcrumb"><span>产品管理</span><ChevronRight size={14} /><span>产品主档</span><ChevronRight size={14} /><strong>网线</strong></div><div className="archive-title-line"><h1>网线</h1><span className="archive-status"><BadgeCheck size={14} />已启用</span><span className="archive-code">CAB-001</span></div></div>
      </div>
      <div className="archive-top-actions"><button type="button"><Edit3 size={16} />修改</button><button className="primary-action" type="button"><Save size={16} />保存</button></div>
    </header>

    <div className="archive-overview-strip">
      <div className="archive-product-symbol"><Cable size={25} /></div>
      <div className="archive-overview-main"><strong>网线</strong><span>线缆 / 网络连接产品</span></div>
      <div className="archive-overview-metric"><span>品牌型号</span><strong>3</strong><small>个已建档</small></div>
      <div className="archive-overview-metric"><span>可报价规格</span><strong>12</strong><small>条规则与规格</small></div>
      <div className="archive-overview-metric"><span>已引用</span><strong>18</strong><small>报价、PO 与项目</small></div>
      <div className="archive-overview-note"><Tag size={15} /><span>主档聚合型号，不直接参与报价</span></div>
    </div>

    <nav className="archive-tabs" aria-label="产品档案分区">{tabs.map((item) => { const Icon = item.icon; return <button key={item.key} type="button" className={tab === item.key ? 'is-active' : ''} onClick={() => setTab(item.key)}><Icon size={16} />{item.label}</button>; })}</nav>

    {tab === 'base' && <BaseProfile />}
    {tab === 'models' && <ModelProfile selectedModelId={selectedModelId} onSelect={setSelectedModelId} selectedModel={selectedModel} />}
    {tab === 'rules' && <PricingProfile selectedModelId={selectedModelId} onSelect={setSelectedModelId} selectedModel={selectedModel} mode={ruleMode} onModeChange={setRuleMode} />}
    {tab === 'references' && <ReferenceProfile />}
  </section>;
}

function BaseProfile() {
  return <div className="archive-content archive-base-content">
    <section className="archive-section-card"><SectionHeading icon={<PackageCheck size={18} />} title="主档基础资料" description="该层用于归纳同类型设备的通用信息，不在报价单中独立计价。" action="修改基础资料" />
      <div className="archive-field-grid">
        <ArchiveField label="产品主档编码" value="CAB-001" monospace /><ArchiveField label="产品名称" value="网线" /><ArchiveField label="产品名称（英文）" value="Network Cable" />
        <ArchiveField label="产品品类" value="线缆" /><ArchiveField label="默认计量单位" value="条" /><ArchiveField label="默认 HS 编码" value="8544.4200" monospace />
        <ArchiveField label="报关品名" value="网络通讯用绝缘线缆" /><ArchiveField label="默认来源" value="采购建档" /><ArchiveField label="档案状态" value="已启用" success />
      </div>
    </section>
    <section className="archive-section-card"><SectionHeading icon={<Settings2 size={18} />} title="通用物流与合规" description="可被品牌型号继承，也允许型号层覆盖。" />
      <div className="archive-policy-grid"><Policy label="带电属性" value="否" /><Policy label="带磁属性" value="否" /><Policy label="NOM 认证" value="按型号维护" /><Policy label="默认运输方式" value="海运" /><Policy label="产品图片" value="主档统一维护" /></div>
    </section>
    <section className="archive-section-card"><SectionHeading icon={<FileText size={18} />} title="产品说明" />
      <p className="archive-description">用于网络设备与配套硬件连接。品牌、型号、屏蔽等级、长度和采购价格均在品牌型号及报价规格层维护。</p>
    </section>
  </div>;
}

function ModelProfile({ selectedModelId, onSelect, selectedModel }: { selectedModelId: string; onSelect: (value: string) => void; selectedModel: typeof modelRows[number] }) {
  return <div className="archive-content archive-split-content">
    <ModelRail selectedModelId={selectedModelId} onSelect={onSelect} />
    <section className="archive-section-card archive-model-detail"><SectionHeading icon={<Layers3 size={18} />} title={`${selectedModel.brand} · ${selectedModel.model}`} description="品牌型号承接可报价规格、供应信息、物流数据与合规属性。" action="修改型号" />
      <div className="archive-model-header"><div><span>型号编码</span><strong>{selectedModel.id === 'netlink-cat6' ? 'CAB-NL-CAT6-UTP' : selectedModel.id === 'procable-cat6' ? 'CAB-PC-CAT6-PRO' : 'CAB-NL-CAT6A-SFTP'}</strong></div><span className="archive-model-kind">{selectedModel.kind}</span><span className="archive-status"><BadgeCheck size={14} />{selectedModel.status}</span></div>
      <div className="archive-inner-divider" />
      <h3>型号资料</h3><div className="archive-field-grid archive-model-field-grid"><ArchiveField label="品牌" value={selectedModel.brand} /><ArchiveField label="型号" value={selectedModel.model} /><ArchiveField label="产品系列" value={selectedModel.model.includes('CAT6A') ? '超六类屏蔽网线' : '六类非屏蔽网线'} /><ArchiveField label="供应商" value={selectedModel.brand === 'NetLink' ? '深圳连线科技有限公司' : 'ProCable Global Ltd.'} /><ArchiveField label="默认采购币种" value="USD" /><ArchiveField label="墨西哥 HS 编码" value="8544.4200" monospace /></div>
      <h3 className="archive-subsection-title">物流与合规覆盖</h3><div className="archive-policy-grid archive-model-policies"><Policy label="基础重量" value="0.11 kg / 1m" /><Policy label="长度增量重量" value="0.08 kg / m" /><Policy label="包装方式" value="独立袋装" /><Policy label="NOM 认证" value="不需要" /></div>
      <div className="archive-model-footer"><div><CircleDollarSign size={17} /><span>已配置 <strong>{selectedModel.specs}</strong>，可直接进入报价选品。</span></div><button className="primary-action" type="button"><ChevronRight size={15} />管理报价规格</button></div>
    </section>
  </div>;
}

function PricingProfile({ selectedModelId, onSelect, selectedModel, mode, onModeChange }: { selectedModelId: string; onSelect: (value: string) => void; selectedModel: typeof modelRows[number]; mode: RuleMode; onModeChange: (mode: RuleMode) => void }) {
  return <div className="archive-content archive-split-content">
    <ModelRail selectedModelId={selectedModelId} onSelect={onSelect} />
    <section className="archive-section-card archive-pricing-detail"><SectionHeading icon={<CircleDollarSign size={18} />} title="报价规格与计价规则" description={`${selectedModel.brand} · ${selectedModel.model}。每个型号选择一种主计价方式。`} action="新增规格" />
      <div className="archive-rule-type-switch"><button type="button" className={mode === 'parameter' ? 'is-active' : ''} onClick={() => onModeChange('parameter')}><CircleDollarSign size={15} /><span><strong>参数化规格</strong><small>适用于长度、容量等连续变化参数</small></span></button><button type="button" className={mode === 'fixed' ? 'is-active' : ''} onClick={() => onModeChange('fixed')}><Layers3 size={15} /><span><strong>固定规格</strong><small>适用于独立 SKU 或非线性价格</small></span></button></div>
      {mode === 'parameter' ? <ParameterRule /> : <FixedSpecs />}
    </section>
  </div>;
}

function ParameterRule() {
  return <><div className="archive-rule-card"><div className="archive-rule-card-heading"><div><span>参数定义</span><strong>长度</strong></div><span className="archive-rule-badge">报价参数</span></div><div className="archive-rule-fields"><ArchiveField label="参数单位" value="m" /><ArchiveField label="允许范围" value="1 - 30" /><ArchiveField label="递增步长" value="1 m" /><ArchiveField label="规格键格式" value="length={value}m" monospace /></div></div>
    <div className="archive-rule-card"><div className="archive-rule-card-heading"><div><span>采购计价</span><strong>线性加价规则</strong></div><button type="button" title="编辑采购计价"><Edit3 size={15} /></button></div><div className="archive-rule-fields"><ArchiveField label="基准规格" value="1m" /><ArchiveField label="基准采购价" value="USD 3.20" primary /><ArchiveField label="每增加" value="1m" /><ArchiveField label="采购加价" value="USD 1.15" primary /></div><div className="archive-formula">采购单价 = USD 3.20 + (长度 - 1m) × USD 1.15</div></div>
    <div className="archive-example-table"><div className="archive-example-title"><span>系统计算示例</span><small>用于报价预览，不生成独立产品档案</small></div><table><thead><tr><th>输入长度</th><th>规格文本</th><th>规格键</th><th>建议采购价</th><th>预估重量</th></tr></thead><tbody><tr><td>1m</td><td>长度：1m</td><td>length=1m</td><td>USD 3.20</td><td>0.11 kg</td></tr><tr><td>5m</td><td>长度：5m</td><td>length=5m</td><td>USD 7.80</td><td>0.43 kg</td></tr><tr><td>10m</td><td>长度：10m</td><td>length=10m</td><td>USD 13.55</td><td>0.83 kg</td></tr></tbody></table></div>
  </>;
}

function FixedSpecs() {
  const specs = [{ code: 'NL-C6A-01', spec: '长度：1m', price: 'USD 5.80', weight: '0.13 kg' }, { code: 'NL-C6A-02', spec: '长度：2m', price: 'USD 7.10', weight: '0.21 kg' }, { code: 'NL-C6A-05', spec: '长度：5m', price: 'USD 10.90', weight: '0.46 kg' }, { code: 'NL-C6A-10', spec: '长度：10m', price: 'USD 17.60', weight: '0.91 kg' }];
  return <div className="archive-fixed-specs"><div className="archive-fixed-summary"><div><span>规格模式</span><strong>独立固定规格</strong><small>每个规格都可拥有独立产品编码、采购价及物流参数。</small></div><button className="primary-action" type="button"><Plus size={15} />新增固定规格</button></div><div className="archive-fixed-table"><table><thead><tr><th>规格编码</th><th>规格</th><th>建议采购价</th><th>预估重量</th><th>状态</th><th className="actions">操作</th></tr></thead><tbody>{specs.map((item) => <tr key={item.code}><td className="archive-monospace">{item.code}</td><td>{item.spec}</td><td className="archive-price">{item.price}</td><td>{item.weight}</td><td><span className="archive-status"><BadgeCheck size={13} />已启用</span></td><td className="actions"><button type="button" title="编辑规格"><Edit3 size={15} /></button><button type="button" className="archive-danger-icon" title="删除规格"><Trash2 size={15} /></button></td></tr>)}</tbody></table></div></div>;
}

function ReferenceProfile() {
  const rows = [
    { icon: FileText, type: '报价单', no: 'QT-20260812-003', relation: 'NetLink CAT6 UTP · 长度：5m', date: '2026-08-12', status: '已确认' },
    { icon: ClipboardList, type: '客户 PO', no: 'PO-20260815-011', relation: 'NetLink CAT6 UTP · 长度：5m', date: '2026-08-15', status: '已匹配' },
    { icon: FileClock, type: '历史报价', no: 'HIS-20260629-018', relation: 'NetLink CAT6 UTP · 长度：3m', date: '2026-06-29', status: '已归档' },
  ];
  return <div className="archive-content"><section className="archive-section-card"><SectionHeading icon={<ClipboardList size={18} />} title="引用记录" description="引用后不可物理删除型号或规格，可停用以防止后续新增报价使用。" />
    <div className="archive-reference-table"><table><thead><tr><th>来源</th><th>单据编号</th><th>型号与规格快照</th><th>日期</th><th>状态</th><th className="actions">操作</th></tr></thead><tbody>{rows.map((item) => { const Icon = item.icon; return <tr key={item.no}><td><span className="archive-reference-type"><Icon size={15} />{item.type}</span></td><td className="archive-monospace">{item.no}</td><td>{item.relation}</td><td>{item.date}</td><td><span className="archive-reference-status">{item.status}</span></td><td className="actions"><button type="button">查看 <ChevronRight size={14} /></button></td></tr>; })}</tbody></table></div>
  </section><div className="archive-snapshot-banner"><Copy size={17} /><div><strong>报价快照保护</strong><span>每条已确认报价都会保存当时的型号、规格键、采购价、重量、HS 编码和 DDP 单价；修改产品档案不会回写历史单据。</span></div></div></div>;
}

function ModelRail({ selectedModelId, onSelect }: { selectedModelId: string; onSelect: (value: string) => void }) {
  return <aside className="archive-model-rail"><div className="archive-rail-heading"><div><span>品牌型号</span><strong>3</strong></div><button type="button" title="新增品牌型号"><Plus size={16} /></button></div><div className="archive-model-list">{modelRows.map((item) => <button type="button" className={`archive-model-item ${item.accent}${selectedModelId === item.id ? ' is-selected' : ''}`} key={item.id} onClick={() => onSelect(item.id)}><span className="archive-model-mark"><Cable size={16} /></span><span><strong>{item.brand}</strong><small>{item.model}</small><em>{item.kind}</em></span><ChevronRight size={15} /></button>)}</div><button className="archive-new-model" type="button"><Plus size={15} />新增品牌型号</button></aside>;
}

function SectionHeading({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: string }) {
  return <div className="archive-section-heading"><div className="archive-section-icon">{icon}</div><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action && <button type="button" className="archive-text-action"><Edit3 size={14} />{action}</button>}</div>;
}

function ArchiveField({ label, value, monospace, primary, success }: { label: string; value: string; monospace?: boolean; primary?: boolean; success?: boolean }) {
  return <div className="archive-field"><span>{label}</span><strong className={`${monospace ? 'archive-monospace ' : ''}${primary ? 'archive-primary-value ' : ''}${success ? 'archive-success-value' : ''}`}>{value}</strong></div>;
}

function Policy({ label, value }: { label: string; value: string }) {
  return <div className="archive-policy"><span>{label}</span><strong>{value}</strong></div>;
}
