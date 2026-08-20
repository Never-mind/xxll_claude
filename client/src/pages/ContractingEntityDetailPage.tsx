import { type ChangeEvent, useEffect, useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Download, FileUp, Landmark, Plus, Trash2, UserRound } from 'lucide-react';
import { apiGet, apiWrite, download, uploadFile } from '../api.js';
import type { ContractingEntity, ContractingEntityAttachment, ContractingEntityBankAccount, ContractingEntityContact, ContractingEntityDetail, CreateContractingEntityDto } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import DetailBackButton from '../components/DetailBackButton.js';

type EntityDraft = Pick<ContractingEntity, 'entityCode' | 'entityName' | 'nameCn' | 'nameEn' | 'shortName' | 'taxNumber' | 'country' | 'city' | 'registeredAddress' | 'remark'>;
type BankDraft = Pick<ContractingEntityBankAccount, 'accountName' | 'bankName' | 'bankAccount' | 'bankRoutingNumber' | 'swiftCode' | 'currency' | 'bankAddress' | 'isDefault'>;
type ContactDraft = Pick<ContractingEntityContact, 'name' | 'title' | 'phone' | 'email' | 'isPrimary'>;

const countries = ['中国', '中国香港', '巴西', '智利', '墨西哥', '美国', '新加坡', '阿联酋'];
const currencies = ['CNY - 人民币', 'USD - 美元', 'EUR - 欧元', 'BRL - 巴西雷亚尔', 'CLP - 智利比索', 'MXN - 墨西哥比索', 'HKD - 港元', 'SGD - 新加坡元'];
const tabs = [{ key: 'basic', label: '基础资料' }, { key: 'bank', label: '银行账户' }, { key: 'contact', label: '联系人' }, { key: 'attachment', label: '附件' }] as const;

const emptyEntity = (): EntityDraft => ({ entityCode: '', entityName: '', nameCn: '', nameEn: '', shortName: '', country: '', city: '', registeredAddress: '', taxNumber: '', remark: '' });
const emptyBank = (): BankDraft => ({ accountName: '', bankName: '', bankAccount: '', bankRoutingNumber: '', swiftCode: '', currency: '', bankAddress: '', isDefault: true });
const emptyContact = (): ContactDraft => ({ name: '', title: '', phone: '', email: '', isPrimary: true });

export default function ContractingEntityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const countryOptionsId = useId();
  const currencyOptionsId = useId();
  const sectionKey = useId().replaceAll(':', '');
  const [entity, setEntity] = useState<EntityDraft>(emptyEntity());
  const [banks, setBanks] = useState<BankDraft[]>([emptyBank()]);
  const [contacts, setContacts] = useState<ContactDraft[]>([emptyContact()]);
  const [attachments, setAttachments] = useState<ContractingEntityAttachment[]>([]);
  const [activeSection, setActiveSection] = useState<(typeof tabs)[number]['key']>('basic');
  const [editing, setEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function applyDetail(detail: ContractingEntityDetail) {
    const item = detail.entity;
    setEntity({
      entityCode: item.entityCode || '',
      entityName: item.entityName || '',
      nameCn: item.nameCn || item.entityName || '',
      nameEn: item.nameEn || '',
      shortName: item.shortName || item.entityName || '',
      country: item.country || '',
      city: item.city || '',
      registeredAddress: item.registeredAddress || item.address || '',
      taxNumber: item.taxNumber || '',
      remark: item.remark || '',
    });
    setBanks(detail.bankAccounts.length ? detail.bankAccounts.map(bankDraft) : [emptyBank()]);
    setContacts(detail.contacts.length ? detail.contacts.map(contactDraft) : [emptyContact()]);
    setAttachments(detail.attachments);
  }

  async function load(entityId: string) {
    setLoading(true);
    try {
      applyDetail(await apiGet<ContractingEntityDetail>(`/contracting-entities/${entityId}`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isNew) {
      setEntity(emptyEntity());
      setBanks([emptyBank()]);
      setContacts([emptyContact()]);
      setAttachments([]);
      setEditing(true);
      setLoading(false);
      return;
    }
    setEditing(false);
    void load(id);
  }, [id, isNew]);

  function updateBank(index: number, patch: Partial<BankDraft>) {
    setBanks((current) => ensureOneDefault(current.map((bank, bankIndex) => ({
      ...bank,
      ...(bankIndex === index ? patch : {}),
      isDefault: patch.isDefault ? bankIndex === index : bank.isDefault,
    }))));
  }

  function removeBank(index: number) {
    setBanks((current) => current.length === 1 ? current : ensureOneDefault(current.filter((_, bankIndex) => bankIndex !== index)));
  }

  function updateContact(index: number, patch: Partial<ContactDraft>) {
    setContacts((current) => ensureOnePrimary(current.map((contact, contactIndex) => ({
      ...contact,
      ...(contactIndex === index ? patch : {}),
      isPrimary: patch.isPrimary ? contactIndex === index : contact.isPrimary,
    }))));
  }

  function removeContact(index: number) {
    setContacts((current) => current.length === 1 ? current : ensureOnePrimary(current.filter((_, contactIndex) => contactIndex !== index)));
  }

  async function save() {
    if (!entity.nameCn?.trim()) {
      setError('请填写承接单位全称（中文）');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateContractingEntityDto = {
        ...entity,
        entityName: entity.shortName || entity.nameCn || '',
        bankAccounts: banks,
        contacts,
      };
      const detail = await apiWrite<ContractingEntityDetail>(isNew ? '/contracting-entities' : `/contracting-entities/${id}`, isNew ? 'POST' : 'PUT', payload);
      applyDetail(detail);
      setEditing(false);
      setNotice(isNew ? '承接单位档案已创建' : '承接单位档案已保存');
      if (isNew) navigate(`/contracting-entities/${detail.entity.id}`, { replace: true });
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
    if (isNew) {
      setError('请先保存承接单位档案，再上传附件');
      return;
    }
    const rejected = files.find((file) => file.size > 10 * 1024 * 1024);
    if (rejected) {
      setError(`文件“${rejected.name}”超过 10 MB 限制`);
      return;
    }
    setUploading(files.map((file) => file.name));
    try {
      for (const file of files) {
        const detail = await uploadFile<ContractingEntityDetail>(`/contracting-entities/${id}/attachments`, file);
        setAttachments(detail.attachments);
        setUploading((current) => current.filter((name) => name !== file.name));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading([]);
    }
  }

  async function deleteAttachment(attachment: ContractingEntityAttachment) {
    if (!id || isNew || !confirm(`确认删除附件“${attachment.fileName}”吗？`)) return;
    try {
      const detail = await apiWrite<ContractingEntityDetail>(`/contracting-entities/${id}/attachments/${attachment.id}`, 'DELETE');
      setAttachments(detail.attachments);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function scrollToSection(section: (typeof tabs)[number]['key']) {
    setActiveSection(section);
    requestAnimationFrame(() => document.getElementById(`${sectionKey}-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  if (loading) return <section className="admin-page"><div className="panel">正在加载承接单位档案...</div></section>;

  return <section className="admin-page customer-detail-page supplier-detail-page">
    <datalist id={countryOptionsId}>{countries.map((item) => <option key={item} value={item} />)}</datalist>
    <datalist id={currencyOptionsId}>{currencies.map((item) => <option key={item} value={item} />)}</datalist>
    <header className="page-header customer-detail-header supplier-detail-header">
      <div className="detail-heading-group"><DetailBackButton to="/contracting-entities" label="返回承接单位列表" /><div><h1>{isNew ? '新增承接单位' : entity.nameCn || entity.shortName || '承接单位档案'}</h1>{!isNew && <span className="supplier-detail-meta">{entity.entityCode}</span>}</div></div>
      <div className="toolbar">{editing ? <><button type="button" onClick={() => { if (!isNew) { setEditing(false); void load(id); } }}>取消</button><button className="primary-action" type="button" disabled={saving} onClick={() => void save()}>{saving ? '保存中...' : '保存'}</button></> : <button className="primary-action" type="button" onClick={() => setEditing(true)}>修改</button>}</div>
    </header>
    <FeedbackDialog message={error} onClose={() => setError('')} />
    <FeedbackDialog message={notice} title="操作成功" onClose={() => setNotice('')} />
    <nav className="supplier-detail-tabs" aria-label="承接单位档案分区">{tabs.map((tab) => <button className={activeSection === tab.key ? 'is-active' : ''} key={tab.key} type="button" onClick={() => scrollToSection(tab.key)}>{tab.label}</button>)}</nav>
    <fieldset className="detail-edit-surface" disabled={!editing}>
      <section className="customer-section supplier-detail-section" id={`${sectionKey}-basic`}>
        <div className="customer-section-heading"><Building2 size={18} /><div><h2>基础资料</h2></div></div>
        <div className="customer-form-grid supplier-form-grid">
          <TextField label="单位编码" value={entity.entityCode} onChange={(value) => setEntity((current) => ({ ...current, entityCode: value }))} placeholder="留空后自动生成" />
          <TextField label="单位全称（中文）" required value={entity.nameCn} onChange={(value) => setEntity((current) => ({ ...current, nameCn: value }))} />
          <TextField label="单位全称（英文）" value={entity.nameEn} onChange={(value) => setEntity((current) => ({ ...current, nameEn: value }))} />
          <TextField label="单位简称" required value={entity.shortName} onChange={(value) => setEntity((current) => ({ ...current, shortName: value, entityName: value }))} />
          <label><span>所在国家/地区</span><input list={countryOptionsId} value={entity.country || ''} onChange={(event) => setEntity((current) => ({ ...current, country: event.target.value }))} placeholder="选择或填写国家/地区" /></label>
          <TextField label="城市" value={entity.city} onChange={(value) => setEntity((current) => ({ ...current, city: value }))} />
          <TextField label="税号" value={entity.taxNumber} onChange={(value) => setEntity((current) => ({ ...current, taxNumber: value }))} />
          <TextField label="注册地址" wide value={entity.registeredAddress} onChange={(value) => setEntity((current) => ({ ...current, registeredAddress: value }))} />
          <TextArea label="备注" wide value={entity.remark} onChange={(value) => setEntity((current) => ({ ...current, remark: value }))} />
        </div>
      </section>
      <section className="customer-section supplier-detail-section" id={`${sectionKey}-bank`}>
        <div className="customer-section-heading"><Landmark size={18} /><div><h2>银行账户</h2></div><button type="button" className="add-inline-action" onClick={() => setBanks((current) => [...current, { ...emptyBank(), isDefault: false }])}><Plus size={15} />新增账户</button></div>
        <div className="repeat-list">{banks.map((bank, index) => <div className="repeat-card" key={`bank-${index}`}>
          <div className="repeat-card-header"><strong>账户 {index + 1}</strong><div className="repeat-card-actions"><label className="default-check"><input type="checkbox" checked={bank.isDefault} onChange={(event) => updateBank(index, { isDefault: event.target.checked })} />默认账户</label>{banks.length > 1 && <button type="button" className="icon-button danger" title="删除账户" onClick={() => removeBank(index)}><Trash2 size={15} /></button>}</div></div>
          <div className="customer-form-grid bank-form-grid"><TextField label="账户名称" value={bank.accountName} onChange={(value) => updateBank(index, { accountName: value })} /><TextField label="银行名称" value={bank.bankName} onChange={(value) => updateBank(index, { bankName: value })} /><TextField label="银行账户" value={bank.bankAccount} onChange={(value) => updateBank(index, { bankAccount: value })} /><label><span>账户币种</span><input list={currencyOptionsId} value={bank.currency || ''} onChange={(event) => updateBank(index, { currency: event.target.value })} placeholder="选择或填写币种" /></label><TextField label="银行行号" value={bank.bankRoutingNumber} onChange={(value) => updateBank(index, { bankRoutingNumber: value })} /><TextField label="SWIFT 码" value={bank.swiftCode} onChange={(value) => updateBank(index, { swiftCode: value })} /><TextField label="银行地址" wide value={bank.bankAddress} onChange={(value) => updateBank(index, { bankAddress: value })} /></div>
        </div>)}</div>
      </section>
      <section className="customer-section supplier-detail-section" id={`${sectionKey}-contact`}>
        <div className="customer-section-heading"><UserRound size={18} /><div><h2>联系人</h2></div><button type="button" className="add-inline-action" onClick={() => setContacts((current) => [...current, { ...emptyContact(), isPrimary: false }])}><Plus size={15} />新增联系人</button></div>
        <div className="repeat-list">{contacts.map((contact, index) => <div className="repeat-card contact-card" key={`contact-${index}`}>
          <div className="repeat-card-header"><strong>联系人 {index + 1}</strong><div className="repeat-card-actions"><label className="default-check"><input type="checkbox" checked={contact.isPrimary} onChange={(event) => updateContact(index, { isPrimary: event.target.checked })} />默认联系人</label>{contacts.length > 1 && <button type="button" className="icon-button danger" title="删除联系人" onClick={() => removeContact(index)}><Trash2 size={15} /></button>}</div></div>
          <div className="customer-form-grid contact-form-grid"><TextField label="联系人" value={contact.name} onChange={(value) => updateContact(index, { name: value })} /><TextField label="职位" value={contact.title} onChange={(value) => updateContact(index, { title: value })} /><TextField label="联系方式" value={contact.phone} onChange={(value) => updateContact(index, { phone: value })} /><TextField label="联系邮箱" value={contact.email} onChange={(value) => updateContact(index, { email: value })} /></div>
        </div>)}</div>
      </section>
    </fieldset>
    <section className="customer-section supplier-detail-section" id={`${sectionKey}-attachment`}>
      <div className="customer-section-heading"><FileUp size={18} /><div><h2>附件</h2></div><label className={`add-inline-action file-action${isNew || !editing ? ' is-disabled' : ''}`}><Plus size={15} />上传附件<input type="file" multiple disabled={isNew || !editing || uploading.length > 0} onChange={selectAttachments} /></label></div>
      <div className="attachment-list">{uploading.map((name) => <div className="attachment-row is-uploading" key={name}><FileUp size={17} /><div><strong>{name}</strong><small>上传中...</small></div></div>)}{attachments.map((attachment) => <div className="attachment-row" key={attachment.id}><FileUp size={17} /><div><strong>{attachment.fileName}</strong><small>{formatBytes(attachment.fileSize)} · {formatDate(attachment.uploadedAt)}</small></div><div className="attachment-actions"><button className="icon-button" type="button" title="下载附件" onClick={() => download(`/contracting-entities/${id}/attachments/${attachment.id}/download`)}><Download size={16} /></button><button className="icon-button danger" type="button" disabled={!editing} title="删除附件" onClick={() => void deleteAttachment(attachment)}><Trash2 size={16} /></button></div></div>)}{!attachments.length && !uploading.length && <div className="attachment-empty">{isNew ? '保存承接单位档案后可上传附件' : '暂无附件'}</div>}</div>
    </section>
  </section>;
}

function TextField({ label, value, required, wide, placeholder, onChange }: { label: string; value: string | undefined; required?: boolean; wide?: boolean; placeholder?: string; onChange: (value: string) => void }) {
  return <label className={wide ? 'field-wide' : ''}><span>{label}{required && <b> *</b>}</span><input value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, wide, onChange }: { label: string; value: string | undefined; wide?: boolean; onChange: (value: string) => void }) {
  return <label className={wide ? 'field-wide' : ''}><span>{label}</span><textarea value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>;
}

function bankDraft(bank: ContractingEntityBankAccount): BankDraft {
  return { accountName: bank.accountName || '', bankName: bank.bankName || '', bankAccount: bank.bankAccount || '', bankRoutingNumber: bank.bankRoutingNumber || '', swiftCode: bank.swiftCode || '', currency: bank.currency || '', bankAddress: bank.bankAddress || '', isDefault: bank.isDefault };
}

function contactDraft(contact: ContractingEntityContact): ContactDraft {
  return { name: contact.name || '', title: contact.title || '', phone: contact.phone || '', email: contact.email || '', isPrimary: contact.isPrimary };
}

function ensureOneDefault(items: BankDraft[]) {
  return items.some((item) => item.isDefault) ? items : items.map((item, index) => ({ ...item, isDefault: index === 0 }));
}

function ensureOnePrimary(items: ContactDraft[]) {
  return items.some((item) => item.isPrimary) ? items : items.map((item, index) => ({ ...item, isPrimary: index === 0 }));
}

function formatBytes(value: number) {
  return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}
