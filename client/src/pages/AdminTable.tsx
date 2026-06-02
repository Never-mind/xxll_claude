import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { apiGet, apiWrite, download, upload } from '../api.js';
import type { PageResult } from '../../../shared/api.interface.js';

export interface FieldConfig {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'checkbox' | 'date' | 'select' | 'image';
  options?: string[];
  step?: string;
}

interface AdminTableProps<T extends { id: string }> {
  title: string;
  endpoint: string;
  searchPlaceholder: string;
  fields: FieldConfig[];
  columns: FieldConfig[];
  getCellValue?: (row: T, column: FieldConfig) => unknown;
  enableBulkDelete?: boolean;
}

export default function AdminTable<T extends { id: string }>({ title, endpoint, searchPlaceholder, fields, columns, getCellValue, enableBulkDelete = false }: AdminTableProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Partial<T> | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const result = await apiGet<PageResult<T>>(`${endpoint}?keyword=${encodeURIComponent(keyword)}&page=1&pageSize=20`);
    setRows(result.items);
    setTotal(result.total);
    setSelectedIds([]);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      fields.map((field) => {
        const value = field.type === 'checkbox' ? form.get(field.key) === 'on' : form.get(field.key);
        return [field.key, field.type === 'number' ? Number(value || 0) : value];
      }),
    );
    await apiWrite(`${endpoint}${editing?.id ? `/${editing.id}` : ''}`, editing?.id ? 'PUT' : 'POST', payload);
    setEditing(null);
    await load();
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
    if (result.errors.length) {
      setError(`导入 ${result.imported} 条，${result.errors.length} 条失败：${result.errors.slice(0, 3).join('；')}`);
    } else {
      setError('');
    }
    await load();
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
          <button className="primary-action search-action" onClick={() => load()}>搜索</button>
        </div>
        <div className="toolbar action-toolbar">
          <button className="primary-action" onClick={() => setEditing({})}>+ 新增</button>
          {enableBulkDelete && <button className="danger-action" disabled={!selectedIds.length} onClick={removeSelected}>删除</button>}
          <label className="file-action">
            导入
            <input type="file" accept=".xlsx,.xls" onChange={importFile} />
          </label>
          <button onClick={() => download(`${endpoint}/export`)}>导出</button>
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
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
              <th>操作</th>
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
                  <button className="icon-button edit" title="编辑" aria-label="编辑" onClick={() => setEditing(row)}>✎</button>
                  <button className="icon-button danger" title="删除" aria-label="删除" onClick={() => remove(row.id)}>⌫</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
                    <select name={field.key} defaultValue={String(editing[field.key as keyof T] ?? field.options?.[0] ?? '')}>
                      {field.options?.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input type={field.type ?? 'text'} step={field.step} name={field.key} defaultValue={String(editing[field.key as keyof T] ?? '')} />
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
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return Number.isInteger(value) ? value : value.toFixed(2);
  return String(value ?? '');
}
