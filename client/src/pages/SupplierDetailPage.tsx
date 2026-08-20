import { type ChangeEvent, type KeyboardEvent, useEffect, useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Download, FileUp, Landmark, Plus, Tags, Trash2, UserRound } from 'lucide-react';
import { apiGet, apiWrite, download, uploadFile } from '../api.js';
import type { CreateSupplierDto, Supplier, SupplierAttachment, SupplierBankAccount, SupplierContact, SupplierDetail } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import DetailBackButton from '../components/DetailBackButton.js';

type SupplierDraft = Pick<Supplier, 'supplierCode' | 'nameCn' | 'nameEn' | 'shortName' | 'country' | 'city' | 'registeredAddress' | 'taxNumber' | 'supplierType' | 'supplyCategories' | 'brands' | 'cooperationStatus' | 'website' | 'remark'>;
type BankDraft = Omit<Pick<SupplierBankAccount, 'accountName' | 'bankName' | 'bankAccount' | 'bankRoutingNumber' | 'swiftCode' | 'currency' | 'bankAddress' | 'isDefault'>, 'currency'> & { currency: string };
type ContactDraft = Pick<SupplierContact, 'name' | 'title' | 'phone' | 'email' | 'isPrimary'>;

const categoryOptions = ['服务器', '配件', '云服务', '货运', '清关', '人力'];
const countryOptions = ['中国', '中国香港', '巴西', '智利', '墨西哥', '美国', '新加坡', '阿联酋'];
const currencyOptions = ['CNY - 人民币', 'USD - 美元', 'EUR - 欧元', 'BRL - 巴西雷亚尔', 'CLP - 智利比索', 'MXN - 墨西哥比索', 'HKD - 港元', 'SGD - 新加坡元'];

const emptySupplier = (): SupplierDraft => ({ supplierCode: '', nameCn: '', nameEn: '', shortName: '', country: '', city: '', registeredAddress: '', taxNumber: '', supplierType: 'third_party', supplyCategories: [], brands: [], cooperationStatus: 'not_cooperated', website: '', remark: '' });
const emptyBank = (): BankDraft => ({ accountName: '', bankName: '', bankAccount: '', bankRoutingNumber: '', swiftCode: '', currency: '', bankAddress: '', isDefault: true });
const emptyContact = (): ContactDraft => ({ name: '', title: '', phone: '', email: '', isPrimary: true });
const detailTabs = [
  { key: 'basic', label: '基础资料' },
  { key: 'scope', label: '经营范围' },
  { key: 'bank', label: '银行账户' },
  { key: 'contact', label: '联系人' },
  { key: 'attachment', label: '附件' },
] as const;

export default function SupplierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const countryOptionsId = useId();
  const currencyOptionsId = useId();
  const sectionKey = useId().replaceAll(':', '');
  const isNew = !id || id === 'new';
  const [supplier, setSupplier] = useState<SupplierDraft>(emptySupplier());
  const [banks, setBanks] = useState<BankDraft[]>([emptyBank()]);
  const [contacts, setContacts] = useState<ContactDraft[]>([emptyContact()]);
  const [attachments, setAttachments] = useState<SupplierAttachment[]>([]);
  const [brandInput, setBrandInput] = useState('');
  const [activeSection, setActiveSection] = useState<(typeof detailTabs)[number]['key']>('basic');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(isNew);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(supplierId: string) {
    setLoading(true);
    try {
      applyDetail(await apiGet<SupplierDetail>(`/suppliers/${supplierId}`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function applyDetail(detail: SupplierDetail) {
    const item = detail.supplier;
    setSupplier({
      supplierCode: item.supplierCode || '', nameCn: item.nameCn || '', nameEn: item.nameEn || '', shortName: item.shortName || '', country: item.country || '', city: item.city || '', registeredAddress: item.registeredAddress || '', taxNumber: item.taxNumber || '',
      supplierType: item.supplierType, supplyCategories: item.supplyCategories || [], brands: item.brands || [], cooperationStatus: item.cooperationStatus, website: item.website || '', remark: item.remark || '',
    });
    setBanks(detail.bankAccounts.length ? detail.bankAccounts.map(bankDraft) : [emptyBank()]);
    setContacts(detail.contacts.length ? detail.contacts.map(contactDraft) : [emptyContact()]);
    setAttachments(detail.attachments);
  }

  useEffect(() => {
    if (isNew) {
      setSupplier(emptySupplier()); setBanks([emptyBank()]); setContacts([emptyContact()]); setAttachments([]); setLoading(false);
      setEditing(true);
      return;
    }
    setEditing(false);
    void load(id);
  }, [id, isNew]);

  function updateBank(index: number, patch: Partial<BankDraft>) {
    setBanks((current) => current.map((bank, itemIndex) => ({ ...bank, ...(itemIndex === index ? patch : {}), isDefault: patch.isDefault ? itemIndex === index : bank.isDefault })));
  }

  function removeBank(index: number) {
    setBanks((current) => {
      if (current.length === 1) return current;
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.some((bank) => bank.isDefault) ? next : next.map((bank, itemIndex) => ({ ...bank, isDefault: itemIndex === 0 }));
    });
  }

  function updateContact(index: number, patch: Partial<ContactDraft>) {
    setContacts((current) => current.map((contact, itemIndex) => ({ ...contact, ...(itemIndex === index ? patch : {}), isPrimary: patch.isPrimary ? itemIndex === index : contact.isPrimary })));
  }

  function removeContact(index: number) {
    setContacts((current) => {
      if (current.length === 1) return current;
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.some((contact) => contact.isPrimary) ? next : next.map((contact, itemIndex) => ({ ...contact, isPrimary: itemIndex === 0 }));
    });
  }

  function toggleCategory(category: string) {
    setSupplier((current) => ({ ...current, supplyCategories: current.supplyCategories.includes(category) ? current.supplyCategories.filter((item) => item !== category) : [...current.supplyCategories, category] }));
  }

  function addBrand() {
    const brand = brandInput.trim();
    if (!brand) return;
    setSupplier((current) => current.brands.includes(brand) ? current : { ...current, brands: [...current.brands, brand] });
    setBrandInput('');
  }

  function handleBrandKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') { event.preventDefault(); addBrand(); }
  }

  function scrollToSection(section: (typeof detailTabs)[number]['key']) {
    setActiveSection(section);
    requestAnimationFrame(() => document.getElementById(`${sectionKey}-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function save() {
    if (!supplier.nameCn.trim()) { setError('请填写供应商全称（中文）'); return; }
    setSaving(true);
    try {
      const payload: CreateSupplierDto = { ...supplier, bankAccounts: banks, contacts };
      const detail = await apiWrite<SupplierDetail>(isNew ? '/suppliers' : `/suppliers/${id}`, isNew ? 'POST' : 'PUT', payload);
      applyDetail(detail);
      setEditing(false);
      setNotice(isNew ? '供应商档案已创建' : '供应商档案已保存');
      if (isNew) navigate(`/suppliers/${detail.supplier.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function selectAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (isNew) { setError('请先保存供应商档案，再上传附件'); return; }
    const rejected = files.find((file) => file.size > 10 * 1024 * 1024);
    if (rejected) { setError(`文件“${rejected.name}”超过 10 MB 限制`); return; }
    setUploading(files.map((file) => file.name));
    try {
      for (const file of files) {
        const detail = await uploadFile<SupplierDetail>(`/suppliers/${id}/attachments`, file);
        setAttachments(detail.attachments);
        setUploading((current) => current.filter((name) => name !== file.name));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading([]);
    }
  }

  async function deleteAttachment(attachment: SupplierAttachment) {
    if (!id || isNew || !confirm(`确认删除附件“${attachment.fileName}”吗？`)) return;
    try {
      const detail = await apiWrite<SupplierDetail>(`/suppliers/${id}/attachments/${attachment.id}`, 'DELETE');
      setAttachments(detail.attachments);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) return <section className="admin-page"><div className="panel">正在加载供应商档案...</div></section>;

  return <section className="admin-page customer-detail-page supplier-detail-page">
    <datalist id={countryOptionsId}>{countryOptions.map((item) => <option key={item} value={item} />)}</datalist>
    <datalist id={currencyOptionsId}>{currencyOptions.map((item) => <option key={item} value={item} />)}</datalist>
    <header className="page-header customer-detail-header supplier-detail-header">
      <div className="detail-heading-group"><DetailBackButton to="/suppliers" label="返回供应商列表" /><div><h1>{isNew ? '新增供应商' : supplier.nameCn || '供应商档案'}</h1>{!isNew && <span className="supplier-detail-meta">{supplier.supplierCode}</span>}</div></div>
      <div className="toolbar">{editing ? <><button type="button" onClick={() => { if (!isNew) { setEditing(false); void load(id); } }}>取消</button><button className="primary-action" type="button" disabled={saving} onClick={() => void save()}>{saving ? '保存中...' : '保存'}</button></> : <button className="primary-action" type="button" onClick={() => setEditing(true)}>修改</button>}</div>
    </header>
    <FeedbackDialog message={error} onClose={() => setError('')} />
    <FeedbackDialog message={notice} title="操作成功" onClose={() => setNotice('')} />
    <nav className="supplier-detail-tabs" aria-label="供应商档案分区">
      {detailTabs.map((tab) => <button className={activeSection === tab.key ? 'is-active' : ''} key={tab.key} type="button" onClick={() => scrollToSection(tab.key)}>{tab.label}</button>)}
    </nav>
    <fieldset className="detail-edit-surface" disabled={!editing}>
    <section className="customer-section supplier-detail-section" id={`${sectionKey}-basic`}>
      <div className="customer-section-heading"><Building2 size={18} /><div><h2>基础资料</h2></div></div>
      <div className="customer-form-grid supplier-form-grid">
        <TextField label="供应商编码" value={supplier.supplierCode} onChange={(value) => setSupplier((current) => ({ ...current, supplierCode: value }))} placeholder="留空后自动生成" />
        <TextField label="供应商全称（中文）" required value={supplier.nameCn} onChange={(value) => setSupplier((current) => ({ ...current, nameCn: value }))} />
        <TextField label="供应商全称（英文）" value={supplier.nameEn} onChange={(value) => setSupplier((current) => ({ ...current, nameEn: value }))} />
        <TextField label="供应商简称" value={supplier.shortName} onChange={(value) => setSupplier((current) => ({ ...current, shortName: value }))} />
        <label><span>所在国家/地区</span><input list={countryOptionsId} value={supplier.country} onChange={(event) => setSupplier((current) => ({ ...current, country: event.target.value }))} placeholder="选择或填写国家/地区" /></label>
        <TextField label="城市" value={supplier.city} onChange={(value) => setSupplier((current) => ({ ...current, city: value }))} />
        <TextField label="注册地址" wide value={supplier.registeredAddress} onChange={(value) => setSupplier((current) => ({ ...current, registeredAddress: value }))} />
        <TextField label="税号" value={supplier.taxNumber} onChange={(value) => setSupplier((current) => ({ ...current, taxNumber: value }))} />
        <label><span>供应商类型</span><select value={supplier.supplierType} onChange={(event) => setSupplier((current) => ({ ...current, supplierType: event.target.value as Supplier['supplierType'] }))}><option value="manufacturer">原厂</option><option value="agent">代理商</option><option value="integrator">集成商</option><option value="third_party">第三方</option></select></label>
        <label><span>合作状态</span><select value={supplier.cooperationStatus} onChange={(event) => setSupplier((current) => ({ ...current, cooperationStatus: event.target.value as Supplier['cooperationStatus'] }))}><option value="not_cooperated">未合作过</option><option value="normal">正常合作</option><option value="suspended">暂停合作</option><option value="terminated">终止合作</option></select></label>
        <TextField label="官网" value={supplier.website} onChange={(value) => setSupplier((current) => ({ ...current, website: value }))} placeholder="https://" />
        <TextAreaField label="备注" wide value={supplier.remark} onChange={(value) => setSupplier((current) => ({ ...current, remark: value }))} />
      </div>
    </section>
    <section className="customer-section supplier-detail-section" id={`${sectionKey}-scope`}>
      <div className="customer-section-heading"><Tags size={18} /><div><h2>经营范围</h2></div></div>
      <div className="customer-form-grid supplier-form-grid">
        <div className="supplier-capability-field field-wide"><span>主要供应品类</span><div className="supplier-category-options">{categoryOptions.map((category) => <label key={category} className="supplier-category-option"><input type="checkbox" checked={supplier.supplyCategories.includes(category)} onChange={() => toggleCategory(category)} />{category}</label>)}</div></div>
        <div className="supplier-capability-field field-wide"><span>合作品牌</span><div className="supplier-brand-entry"><input value={brandInput} onChange={(event) => setBrandInput(event.target.value)} onKeyDown={handleBrandKeyDown} placeholder="输入品牌后按回车添加" /><button type="button" onClick={addBrand}><Plus size={15} />添加</button></div><div className="supplier-brand-tags">{supplier.brands.map((brand) => <span key={brand}>{brand}<button type="button" aria-label={`移除 ${brand}`} onClick={() => setSupplier((current) => ({ ...current, brands: current.brands.filter((item) => item !== brand) }))}>×</button></span>)}</div></div>
      </div>
    </section>
    <section className="customer-section supplier-detail-section" id={`${sectionKey}-bank`}>
      <div className="customer-section-heading"><Landmark size={18} /><div><h2>银行账户</h2></div><button type="button" className="add-inline-action" onClick={() => setBanks((current) => [...current.map((bank) => ({ ...bank, isDefault: false })), { ...emptyBank(), isDefault: false }])}><Plus size={15} />新增账户</button></div>
      <div className="repeat-list">{banks.map((bank, index) => <div className="repeat-card" key={`bank-${index}`}>
        <div className="repeat-card-header"><strong>账户 {index + 1}</strong><div className="repeat-card-actions"><label className="default-check"><input type="checkbox" checked={bank.isDefault} onChange={(event) => updateBank(index, { isDefault: event.target.checked })} />默认账户</label>{banks.length > 1 && <button type="button" className="icon-button danger" title="删除账户" onClick={() => removeBank(index)}><Trash2 size={15} /></button>}</div></div>
        <div className="customer-form-grid bank-form-grid">
          <TextField label="账户名称" value={bank.accountName} onChange={(value) => updateBank(index, { accountName: value })} />
          <TextField label="银行名称" value={bank.bankName} onChange={(value) => updateBank(index, { bankName: value })} />
          <TextField label="银行账户" value={bank.bankAccount} onChange={(value) => updateBank(index, { bankAccount: value })} />
          <label><span>账户币种</span><input list={currencyOptionsId} value={bank.currency} onChange={(event) => updateBank(index, { currency: event.target.value })} placeholder="选择或填写币种" /></label>
          <TextField label="银行行号" value={bank.bankRoutingNumber} onChange={(value) => updateBank(index, { bankRoutingNumber: value })} />
          <TextField label="SWIFT 码" value={bank.swiftCode} onChange={(value) => updateBank(index, { swiftCode: value })} />
          <TextField label="银行地址" wide value={bank.bankAddress} onChange={(value) => updateBank(index, { bankAddress: value })} />
        </div>
      </div>)}</div>
    </section>
    <section className="customer-section supplier-detail-section" id={`${sectionKey}-contact`}>
      <div className="customer-section-heading"><UserRound size={18} /><div><h2>联系人</h2></div><button type="button" className="add-inline-action" onClick={() => setContacts((current) => [...current.map((contact) => ({ ...contact, isPrimary: false })), { ...emptyContact(), isPrimary: false }])}><Plus size={15} />新增联系人</button></div>
      <div className="repeat-list">{contacts.map((contact, index) => <div className="repeat-card contact-card" key={`contact-${index}`}>
        <div className="repeat-card-header"><strong>联系人 {index + 1}</strong><div className="repeat-card-actions"><label className="default-check"><input type="checkbox" checked={contact.isPrimary} onChange={(event) => updateContact(index, { isPrimary: event.target.checked })} />默认联系人</label>{contacts.length > 1 && <button type="button" className="icon-button danger" title="删除联系人" onClick={() => removeContact(index)}><Trash2 size={15} /></button>}</div></div>
        <div className="customer-form-grid contact-form-grid"><TextField label="联系人" value={contact.name} onChange={(value) => updateContact(index, { name: value })} /><TextField label="职位" value={contact.title} onChange={(value) => updateContact(index, { title: value })} /><TextField label="联系方式" value={contact.phone} onChange={(value) => updateContact(index, { phone: value })} /><TextField label="联系邮箱" value={contact.email} onChange={(value) => updateContact(index, { email: value })} /></div>
      </div>)}</div>
    </section>
    </fieldset>
    <section className="customer-section supplier-detail-section" id={`${sectionKey}-attachment`}>
      <div className="customer-section-heading"><FileUp size={18} /><div><h2>附件</h2></div><label className={`add-inline-action file-action${isNew || !editing ? ' is-disabled' : ''}`}><Plus size={15} />上传附件<input type="file" multiple disabled={isNew || !editing || uploading.length > 0} onChange={selectAttachments} /></label></div>
      <div className="attachment-list">
        {uploading.map((name) => <div className="attachment-row is-uploading" key={name}><FileUp size={17} /><div><strong>{name}</strong><small>上传中...</small></div></div>)}
        {attachments.map((attachment) => <div className="attachment-row" key={attachment.id}><FileUp size={17} /><div><strong>{attachment.fileName}</strong><small>{formatBytes(attachment.fileSize)} · {formatDate(attachment.uploadedAt)}</small></div><div className="attachment-actions"><button className="icon-button" type="button" title="下载附件" onClick={() => download(`/suppliers/${id}/attachments/${attachment.id}/download`)}><Download size={16} /></button><button className="icon-button danger" type="button" disabled={!editing} title="删除附件" onClick={() => void deleteAttachment(attachment)}><Trash2 size={16} /></button></div></div>)}
        {!attachments.length && !uploading.length && <div className="attachment-empty">{isNew ? '保存供应商档案后可上传附件' : '暂无附件'}</div>}
      </div>
    </section>
  </section>;
}

function TextField({ label, value, required, wide, placeholder, onChange }: { label: string; value: string | undefined; required?: boolean; wide?: boolean; placeholder?: string; onChange: (value: string) => void }) {
  return <label className={wide ? 'field-wide' : ''}><span>{required && <b>*</b>}{label}</span><input value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextAreaField({ label, value, wide, onChange }: { label: string; value: string | undefined; wide?: boolean; onChange: (value: string) => void }) {
  return <label className={wide ? 'field-wide supplier-textarea-field' : 'supplier-textarea-field'}><span>{label}</span><textarea value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>;
}

function bankDraft(bank: SupplierBankAccount): BankDraft {
  return { accountName: bank.accountName || '', bankName: bank.bankName || '', bankAccount: bank.bankAccount || '', bankRoutingNumber: bank.bankRoutingNumber || '', swiftCode: bank.swiftCode || '', currency: bank.currency || '', bankAddress: bank.bankAddress || '', isDefault: bank.isDefault };
}

function contactDraft(contact: SupplierContact): ContactDraft {
  return { name: contact.name || '', title: contact.title || '', phone: contact.phone || '', email: contact.email || '', isPrimary: contact.isPrimary };
}

function formatBytes(size: number): string {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.max(1, Math.ceil(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
