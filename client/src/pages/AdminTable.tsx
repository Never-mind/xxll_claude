import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { apiGet, apiWrite, download, upload } from '../api.js';
import FeedbackDialog from '../components/FeedbackDialog.js';
import type { PageResult } from '../../../shared/api.interface.js';

export interface FieldConfig {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'checkbox' | 'date' | 'select' | 'image';
  options?: string[];
  readOnly?: boolean;
  submit?: boolean;
  step?: string;
}

interface AdminTableProps<T extends { id: string }> {
  title: string;
  endpoint: string;
  searchPlaceholder: string;
  fields: FieldConfig[];
  columns: FieldConfig[];
  getCellValue?: (row: T, column: FieldConfig) => unknown;
  onFieldChange?: (draft: Partial<T>, field: FieldConfig, value: unknown) => Partial<T>;
  prepareEdit?: (draft: Partial<T>) => Partial<T>;
  enableBulkDelete?: boolean;
}

export default function AdminTable<T extends { id: string }>({ title, endpoint, searchPlaceholder, fields, columns, getCellValue, onFieldChange, prepareEdit, enableBulkDelete = false }: AdminTableProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<Partial<T> | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function load(nextPage = page, nextPageSize = pageSize) {
    const result = await apiGet<PageResult<T>>(`${endpoint}?keyword=${encodeURIComponent(keyword)}&page=${nextPage}&pageSize=${nextPageSize}`);
    setRows(result.items);
    setTotal(result.total);
    setSelectedIds([]);
    const nextTotalPages = Math.max(1, Math.ceil(result.total / nextPageSize));
    if (nextPage > nextTotalPages) setPage(nextTotalPages);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [page, pageSize]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      fields.filter((field) => field.submit !== false).map((field) => {
        const value = field.type === 'checkbox' ? form.get(field.key) === 'on' : form.get(field.key);
        return [field.key, field.type === 'number' ? Number(value || 0) : value];
      }),
    );
    try {
      await apiWrite(`${endpoint}${editing?.id ? `/${editing.id}` : ''}`, editing?.id ? 'PUT' : 'POST', payload);
      setEditing(null);
      await load();
    } catch (err) {
      const message = (err as Error).message;
      if (endpoint === '/products' && !editing?.id && /already exists|duplicate|重复/i.test(message)) {
        setError('产品已存在');
      } else if (endpoint === '/customers' && !editing?.id && /already exists|duplicate|重复/i.test(message)) {
        setError('客户已存在');
      } else if (endpoint === '/tariff-rates' && /already exists|duplicate|重复/i.test(message)) {
        setError('设备类型已存在');
      } else {
        setError(message);
      }
    }
  }

  async function remove(id: string) {
    if (!confirm('确认删除这条记录？')) return;
    await apiWrite(`${endpoint}/${id}`, 'DELETE');
    await load();
  }

  async function removeSelected() {
    if (!selectedIds.length) return;
    if (!confirm(`确认删除选中的 ${selectedIds.length} 条记录？`)) return;
    for (const id of selectedIds) {
      await apiWrite(`${endpoint}/${id}`, 'DELETE');
    }
    await load();
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const result = await upload(`${endpoint}/import`, file);
    setError([
      `导入成功 ${result.imported} 条数据，失败 ${result.errors.length} 条数据。`,
      result.errors.length ? `失败原因：${result.errors.slice(0, 3).join('；')}` : '',
    ].filter(Boolean).join('\n'));
    await load();
  }

  function updateEditingField(field: FieldConfig, value: unknown) {
    setEditing((current) => {
      const next = { ...current, [field.key]: value } as Partial<T>;
      return onFieldChange ? onFieldChange(next, field, value) : next;
    });
  }

  return (
    <section className="admin-page">
      <header className="page-header admin-title-bar">
        <div className="page-title">
          <h1>{title}</h1>
          <p>{total} 条记录</p>
        </div>
      </header>
      <div className="workspace-toolbar">
        <div className="search-group">
          <input className="search-input" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={`搜索${searchPlaceholder}`} />
          <button className="primary-action search-action" onClick={() => {
            setPage(1);
            if (page === 1) load().catch((err) => setError(err.message));
          }}>搜索</button>
        </div>
        <div className="toolbar action-toolbar">
          <button className="primary-action" onClick={() => setEditing(prepareEdit ? prepareEdit({}) : {})}>+ 新增</button>
          {enableBulkDelete && <button className="danger-action" disabled={!selectedIds.length} onClick={removeSelected}>删除</button>}
          <label className="file-action">
            导入
            <input type="file" accept=".xlsx,.xls" onChange={importFile} />
          </label>
          <button onClick={() => download(`${endpoint}/export`)}>导出</button>
        </div>
      </div>
      <FeedbackDialog message={error} onClose={() => setError('')} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {enableBulkDelete && (
                <th>
                  <input
                    type="checkbox"
                    aria-label="全选"
                    checked={rows.length > 0 && selectedIds.length === rows.length}
                    onChange={(event) => setSelectedIds(event.target.checked ? rows.map((row) => row.id) : [])}
                  />
                </th>
              )}
              {columns.map((column) => <th key={column.key}>{column.label}</th>)}
              <th className="actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {enableBulkDelete && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label="选择"
                      checked={selectedIds.includes(row.id)}
                      onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key}>
                    {formatCell(getCellValue ? getCellValue(row, column) : column.key === 'features' ? row : row[column.key as keyof T], column)}
                  </td>
                ))}
                <td className="actions">
                  <button className="icon-button edit" title="编辑" aria-label="编辑" onClick={() => setEditing(prepareEdit ? prepareEdit(row) : row)}>✎</button>
                  <button className="icon-button danger" title="删除" aria-label="删除" onClick={() => remove(row.id)}>⌫</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination-bar">
        <span>第 {page} / {totalPages} 页</span>
        <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>下一页</button>
        <label>
          每页
          <select value={pageSize} onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}>
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      {editing && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={submit}>
            <div className="modal-header">
              <h2>{editing.id ? '编辑' : '新增'}{title.replace('信息管理', '').replace('税率管理', '税率')}</h2>
              <button className="modal-close" type="button" onClick={() => setEditing(null)}>×</button>
            </div>
            <div className="form-grid">
              {fields.map((field) => (
                <label key={field.key} className={field.key === 'imageUrl' ? 'image-field' : undefined}>
                  <span>{field.label}</span>
                  {field.type === 'image' ? (
                    <div className="image-upload-row">
                      {String(editing[field.key as keyof T] ?? '') ? (
                        <img className="image-preview" src={String(editing[field.key as keyof T] ?? '')} alt="" />
                      ) : (
                        <div className="image-placeholder">▧</div>
                      )}
                      <input type="file" accept="image/*" onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setEditing((current) => ({ ...current, [field.key]: String(reader.result || '') } as Partial<T>));
                        reader.readAsDataURL(file);
                      }} />
                      <input type="hidden" name={field.key} value={String(editing[field.key as keyof T] ?? '')} />
                    </div>
                  ) : field.type === 'checkbox' ? (
                    <input type="checkbox" name={field.key} defaultChecked={Boolean(editing[field.key as keyof T])} />
                  ) : field.type === 'select' ? (
                    <select name={field.key} value={String(editing[field.key as keyof T] ?? field.options?.[0] ?? '')} onChange={(event) => updateEditingField(field, event.target.value)} disabled={field.readOnly}>
                      {field.options?.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type ?? 'text'}
                      step={field.type === 'number' ? field.step ?? 'any' : field.step}
                      name={field.key}
                      value={formatInputDefault(editing[field.key as keyof T])}
                      readOnly={field.readOnly}
                      onChange={(event) => updateEditingField(field, field.type === 'number' ? event.target.value : event.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            <footer className="modal-actions">
              <button type="button" onClick={() => setEditing(null)}>取消</button>
              <button type="submit">保存</button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function formatCell(value: unknown, column: FieldConfig) {
  if (column.key === 'imageUrl') {
    const source = String(value ?? '');
    return source ? <img className="table-thumb" src={source} alt="" /> : <span className="table-thumb placeholder">▧</span>;
  }
  if (column.key === 'features') {
    const row = value as Record<string, unknown>;
    const features = [
      row.isMagnetic ? '带磁' : '',
      row.isElectric ? '带电' : '',
      row.needNom ? 'NOM认证' : '',
    ].filter(Boolean);
    return features.length ? (
      <div className="feature-list">
        {features.map((feature) => <span key={feature}>{feature}</span>)}
      </div>
    ) : '';
  }
  if (column.key === 'contacts') {
    const row = value as Record<string, unknown>;
    const contacts = [
      ['联系方式1', row.contactName1, row.contactPhone1],
      ['联系方式2', row.contactName2, row.contactPhone2],
    ].filter(([, name, phone]) => String(name ?? '').trim() || String(phone ?? '').trim());
    return contacts.length ? (
      <div className="contact-list">
        {contacts.map(([label, name, phone]) => (
          <div key={String(label)}>
            <span>{String(name || '-')}：{String(phone || '-')}</span>
          </div>
        ))}
      </div>
    ) : '';
  }
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return isQuantityLikeColumn(column.key) ? integer(value) : value.toFixed(2);
  return String(value ?? '');
}

function formatInputDefault(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  return String(value);
}

function integer(value = 0) {
  return String(Math.trunc(Number(value || 0)));
}

function isQuantityLikeColumn(key: string) {
  return /(^|_)(qty|quantity)(_|$)|purchaseQty|plannedQty|数量/i.test(key);
}
