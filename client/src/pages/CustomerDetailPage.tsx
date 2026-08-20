import { type ChangeEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Download, FileUp, Landmark, Mail, Plus, Trash2, UserRound } from 'lucide-react';
import { apiGet, apiWrite, download, uploadFile } from '../api.js';
import type { CreateCustomerDto, Customer, CustomerAttachment, CustomerBankAccount, CustomerContact, CustomerDetail } from '../api.js';
import type { CustomerBankCurrency } from '../../../shared/api.interface.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import DetailBackButton from '../components/DetailBackButton.js';

type CustomerDraft = Pick<Customer, 'customerCode' | 'name' | 'nameCn' | 'nameEn' | 'shortName' | 'taxNumber' | 'country' | 'address' | 'postalCode'>;
type BankDraft = Omit<Pick<CustomerBankAccount, 'accountName' | 'bankName' | 'bankAccount' | 'bankRoutingNumber' | 'swiftCode' | 'currency' | 'otherCurrency' | 'bankAddress' | 'isDefault'>, 'currency'> & { currency: CustomerBankCurrency | '' };
type ContactDraft = Pick<CustomerContact, 'name' | 'phone' | 'email' | 'isPrimary'>;

const currencyOptions = ['CNY', 'USD', 'BRL', 'CLP', 'MXN', 'OTHER'] as const;

const emptyBank = (): BankDraft => ({ accountName: '', bankName: '', bankAccount: '', bankRoutingNumber: '', swiftCode: '', currency: '', otherCurrency: '', bankAddress: '', isDefault: true });
const emptyContact = (): ContactDraft => ({ name: '', phone: '', email: '', isPrimary: true });
const emptyCustomer = (): CustomerDraft => ({ customerCode: '', name: '', nameCn: '', nameEn: '', shortName: '', taxNumber: '', country: '', address: '', postalCode: '' });

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const [customer, setCustomer] = useState<CustomerDraft>(emptyCustomer());
  const [banks, setBanks] = useState<BankDraft[]>([emptyBank()]);
  const [contacts, setContacts] = useState<ContactDraft[]>([emptyContact()]);
  const [attachments, setAttachments] = useState<CustomerAttachment[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(isNew);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(customerId: string) {
    setLoading(true);
    try {
      const detail = await apiGet<CustomerDetail>(`/customers/${customerId}`);
      applyDetail(detail);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function applyDetail(detail: CustomerDetail) {
    setCustomer({
      customerCode: detail.customer.customerCode || '', name: detail.customer.name || '', nameCn: detail.customer.nameCn || detail.customer.name || '', nameEn: detail.customer.nameEn || '', shortName: detail.customer.shortName || detail.customer.name || '', taxNumber: detail.customer.taxNumber || '',
      country: detail.customer.country || '', address: detail.customer.address || '', postalCode: detail.customer.postalCode || '',
    });
    setBanks(detail.bankAccounts.length ? detail.bankAccounts.map(bankDraft) : [emptyBank()]);
    setContacts(detail.contacts.length ? detail.contacts.map(contactDraft) : [legacyContact(detail.customer)]);
    setAttachments(detail.attachments);
  }

  useEffect(() => {
    if (isNew) {
      setCustomer(emptyCustomer());
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
    setBanks((current) => {
      const next = current.map((bank, itemIndex) => ({
        ...bank,
        ...(itemIndex === index ? patch : {}),
        isDefault: patch.isDefault ? itemIndex === index : bank.isDefault,
      }));
      return ensureOneDefault(next);
    });
  }

  function removeBank(index: number) {
    setBanks((current) => {
      if (current.length === 1) return current;
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.some((item) => item.isDefault) ? next : next.map((item, itemIndex) => ({ ...item, isDefault: itemIndex === 0 }));
    });
  }

  function updateContact(index: number, patch: Partial<ContactDraft>) {
    setContacts((current) => {
      const next = current.map((contact, itemIndex) => ({
        ...contact,
        ...(itemIndex === index ? patch : {}),
        isPrimary: patch.isPrimary ? itemIndex === index : contact.isPrimary,
      }));
      return ensureOnePrimary(next);
    });
  }

  function removeContact(index: number) {
    setContacts((current) => {
      if (current.length === 1) return current;
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.some((item) => item.isPrimary) ? next : next.map((item, itemIndex) => ({ ...item, isPrimary: itemIndex === 0 }));
    });
  }

  async function save() {
    if (!customer.nameCn?.trim()) {
      setError('请填写客户名称（中文）');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateCustomerDto = { ...customer, name: customer.shortName || customer.nameCn || '', bankAccounts: banks.map((bank) => ({ ...bank, currency: bank.currency || undefined })), contacts };
      const detail = await apiWrite<CustomerDetail>(isNew ? '/customers' : `/customers/${id}`, isNew ? 'POST' : 'PUT', payload);
      applyDetail(detail);
      setEditing(false);
      setNotice(isNew ? '客户档案已创建' : '客户档案已保存');
      if (isNew) navigate(`/customers/${detail.customer.id}`, { replace: true });
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
      setError('请先保存客户档案，再上传附件');
      return;
    }
    const rejected = files.find((file) => file.size > 10 * 1024 * 1024);
    if (rejected) {
      setError(`文件“${rejected.name}”超过 10 MB 限制`);
      return;
    }
    setUploading(files.map((file) => file.name));
    try {
      let detail: CustomerDetail | undefined;
      for (const file of files) {
        detail = await uploadFile<CustomerDetail>(`/customers/${id}/attachments`, file);
        setAttachments(detail.attachments);
        setUploading((current) => current.filter((name) => name !== file.name));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading([]);
    }
  }

  async function deleteAttachment(attachment: CustomerAttachment) {
    if (!id || isNew || !confirm(`确认删除附件“${attachment.fileName}”吗？`)) return;
    try {
      const detail = await apiWrite<CustomerDetail>(`/customers/${id}/attachments/${attachment.id}`, 'DELETE');
      setAttachments(detail.attachments);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) return <section className="admin-page"><div className="panel">正在加载客户档案...</div></section>;

  return <section className="admin-page customer-detail-page">
    <header className="page-header customer-detail-header">
      <div className="detail-heading-group"><DetailBackButton to="/customers" label="返回客户列表" /><div><h1>{isNew ? '新增客户' : customer.nameCn || customer.shortName || '客户档案'}</h1><p>{isNew ? '填写客户资料后即可继续维护附件。' : '客户主体、收款信息与业务联系人集中维护。'}</p></div></div>
      <div className="toolbar">{editing ? <><button type="button" onClick={() => { if (!isNew) { setEditing(false); void load(id); } }}>取消</button><button className="primary-action" type="button" disabled={saving} onClick={() => void save()}>{saving ? '保存中...' : '保存'}</button></> : <button className="primary-action" type="button" onClick={() => setEditing(true)}>修改</button>}</div>
    </header>
    <FeedbackDialog message={error} onClose={() => setError('')} />
    <FeedbackDialog message={notice} title="操作成功" onClose={() => setNotice('')} />
    <fieldset className="detail-edit-surface" disabled={!editing}>
    <section className="customer-section">
      <div className="customer-section-heading"><Building2 size={18} /><div><h2>客户主体</h2><p>用于报价单、客户 PO 和收款资料引用。</p></div></div>
      <div className="customer-form-grid">
        <TextField label="客户编码" value={customer.customerCode} onChange={(value) => setCustomer((current) => ({ ...current, customerCode: value }))} placeholder="例如 CUS-0001" />
        <TextField label="客户名称（中文）" required value={customer.nameCn} onChange={(value) => setCustomer((current) => ({ ...current, nameCn: value }))} />
        <TextField label="客户名称（英文）" value={customer.nameEn} onChange={(value) => setCustomer((current) => ({ ...current, nameEn: value }))} />
        <TextField label="客户简称" required value={customer.shortName} onChange={(value) => setCustomer((current) => ({ ...current, shortName: value, name: value }))} />
        <TextField label="税号" value={customer.taxNumber} onChange={(value) => setCustomer((current) => ({ ...current, taxNumber: value }))} />
        <TextField label="国家/地区" value={customer.country} onChange={(value) => setCustomer((current) => ({ ...current, country: value }))} />
        <TextField label="邮编" value={customer.postalCode} onChange={(value) => setCustomer((current) => ({ ...current, postalCode: value }))} />
        <TextField label="地址" wide value={customer.address} onChange={(value) => setCustomer((current) => ({ ...current, address: value }))} />
      </div>
    </section>
    <section className="customer-section">
      <div className="customer-section-heading"><Landmark size={18} /><div><h2>银行账户</h2><p>默认账户用于常规收款，可按客户需要增加多个收款账户。</p></div><button type="button" className="add-inline-action" onClick={() => setBanks((current) => [...current.map((bank) => ({ ...bank, isDefault: false })), { ...emptyBank(), isDefault: false }])}><Plus size={15} />新增账户</button></div>
      <div className="repeat-list">{banks.map((bank, index) => <div className="repeat-card" key={`bank-${index}`}>
        <div className="repeat-card-header"><strong>账户 {index + 1}</strong><div className="repeat-card-actions"><label className="default-check"><input type="checkbox" checked={bank.isDefault} onChange={(event) => updateBank(index, { isDefault: event.target.checked })} />默认账户</label>{banks.length > 1 && <button type="button" className="icon-button danger" title="删除账户" onClick={() => removeBank(index)}><Trash2 size={15} /></button>}</div></div>
        <div className="customer-form-grid bank-form-grid">
          <TextField label="账户名称" value={bank.accountName} onChange={(value) => updateBank(index, { accountName: value })} />
          <TextField label="银行名称" value={bank.bankName} onChange={(value) => updateBank(index, { bankName: value })} />
          <TextField label="银行账户" value={bank.bankAccount} onChange={(value) => updateBank(index, { bankAccount: value })} />
          <TextField label="银行行号" value={bank.bankRoutingNumber} onChange={(value) => updateBank(index, { bankRoutingNumber: value })} />
          <TextField label="SWIFT 码" value={bank.swiftCode} onChange={(value) => updateBank(index, { swiftCode: value })} />
          <label><span>账户币种</span><select value={bank.currency} onChange={(event) => updateBank(index, { currency: event.target.value as BankDraft['currency'], otherCurrency: event.target.value === 'OTHER' ? bank.otherCurrency : '' })}><option value="" disabled>请选择账户币种</option>{currencyOptions.map((currency) => <option key={currency} value={currency}>{currency === 'OTHER' ? '其他币种' : currency}</option>)}</select></label>
          {bank.currency === 'OTHER' && <TextField label="其他币种代码" required value={bank.otherCurrency} onChange={(value) => updateBank(index, { otherCurrency: value.toUpperCase() })} placeholder="例如 EUR" />}
          <TextField label="银行地址" wide value={bank.bankAddress} onChange={(value) => updateBank(index, { bankAddress: value })} />
        </div>
      </div>)}</div>
    </section>
    <section className="customer-section">
      <div className="customer-section-heading"><UserRound size={18} /><div><h2>联系人</h2><p>默认联系人会同步到现有报价和客户 PO 流程。</p></div><button type="button" className="add-inline-action" onClick={() => setContacts((current) => [...current.map((contact) => ({ ...contact, isPrimary: false })), { ...emptyContact(), isPrimary: false }])}><Plus size={15} />新增联系人</button></div>
      <div className="repeat-list">{contacts.map((contact, index) => <div className="repeat-card contact-card" key={`contact-${index}`}>
        <div className="repeat-card-header"><strong>联系人 {index + 1}</strong><div className="repeat-card-actions"><label className="default-check"><input type="checkbox" checked={contact.isPrimary} onChange={(event) => updateContact(index, { isPrimary: event.target.checked })} />默认联系人</label>{contacts.length > 1 && <button type="button" className="icon-button danger" title="删除联系人" onClick={() => removeContact(index)}><Trash2 size={15} /></button>}</div></div>
        <div className="customer-form-grid contact-form-grid"><TextField label="联系人" value={contact.name} onChange={(value) => updateContact(index, { name: value })} /><TextField label="联系方式" value={contact.phone} onChange={(value) => updateContact(index, { phone: value })} /><TextField label="联系邮箱" value={contact.email} onChange={(value) => updateContact(index, { email: value })} /></div>
      </div>)}</div>
    </section>
    </fieldset>
    <section className="customer-section">
      <div className="customer-section-heading"><FileUp size={18} /><div><h2>附件</h2><p>可上传合同、资质、开户证明等多个文件，单个文件不超过 10 MB。</p></div><label className={`add-inline-action file-action${isNew || !editing ? ' is-disabled' : ''}`}><Plus size={15} />上传附件<input type="file" multiple disabled={isNew || !editing || uploading.length > 0} onChange={selectAttachments} /></label></div>
      <div className="attachment-list">
        {uploading.map((name) => <div className="attachment-row is-uploading" key={name}><FileUp size={17} /><div><strong>{name}</strong><small>上传中...</small></div></div>)}
        {attachments.map((attachment) => <div className="attachment-row" key={attachment.id}><FileUp size={17} /><div><strong>{attachment.fileName}</strong><small>{formatBytes(attachment.fileSize)} · {formatDate(attachment.uploadedAt)}</small></div><div className="attachment-actions"><button className="icon-button" type="button" title="下载附件" onClick={() => download(`/customers/${id}/attachments/${attachment.id}/download`)}><Download size={16} /></button><button className="icon-button danger" type="button" disabled={!editing} title="删除附件" onClick={() => void deleteAttachment(attachment)}><Trash2 size={16} /></button></div></div>)}
        {!attachments.length && !uploading.length && <div className="attachment-empty">{isNew ? '保存客户档案后可上传附件' : '暂无附件'}</div>}
      </div>
    </section>
  </section>;
}

function TextField({ label, value, required, wide, placeholder, onChange }: { label: string; value: string | undefined; required?: boolean; wide?: boolean; placeholder?: string; onChange: (value: string) => void }) {
  return <label className={wide ? 'field-wide' : ''}><span>{label}{required && <b> *</b>}</span><input value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function bankDraft(bank: CustomerBankAccount): BankDraft {
  const supported = currencyOptions.includes(bank.currency as typeof currencyOptions[number]);
  return { accountName: bank.accountName || '', bankName: bank.bankName || '', bankAccount: bank.bankAccount || '', bankRoutingNumber: bank.bankRoutingNumber || '', swiftCode: bank.swiftCode || '', currency: supported ? bank.currency : 'OTHER', otherCurrency: bank.otherCurrency || (supported ? '' : bank.currency), bankAddress: bank.bankAddress || '', isDefault: bank.isDefault };
}

function contactDraft(contact: CustomerContact): ContactDraft { return { name: contact.name || '', phone: contact.phone || '', email: contact.email || '', isPrimary: contact.isPrimary }; }
function legacyContact(customer: Customer): ContactDraft { return { name: customer.contactName || '', phone: customer.contactPhone || '', email: customer.contactEmail || '', isPrimary: true }; }
function formatBytes(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(2)} MB`; }
function formatDate(value: string) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'; }
function ensureOneDefault(items: BankDraft[]) { return items.some((item) => item.isDefault) ? items : items.map((item, index) => ({ ...item, isDefault: index === 0 })); }
function ensureOnePrimary(items: ContactDraft[]) { return items.some((item) => item.isPrimary) ? items : items.map((item, index) => ({ ...item, isPrimary: index === 0 })); }
