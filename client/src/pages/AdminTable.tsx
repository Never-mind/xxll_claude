import { FormEvent, useEffect, useState } from 'react';
import { apiGet, apiWrite, download } from '../api.js';
import type { PageResult } from '../../../shared/api.interface.js';

export interface FieldConfig {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'checkbox' | 'date' | 'select';
  options?: string[];
}

interface AdminTableProps<T extends { id: string }> {
  title: string;
  endpoint: string;
  searchPlaceholder: string;
  fields: FieldConfig[];
  columns: FieldConfig[];
}

export default function AdminTable<T extends { id: string }>({ title, endpoint, searchPlaceholder, fields, columns }: AdminTableProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Partial<T> | null>(null);
  const [error, setError] = useState('');

  async function load() {
    const result = await apiGet<PageResult<T>>(`${endpoint}?keyword=${encodeURIComponent(keyword)}&page=1&pageSize=20`);
    setRows(result.items);
    setTotal(result.total);
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

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{total} 条记录</p>
        </div>
        <div className="toolbar">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={searchPlaceholder} />
          <button onClick={() => load()}>搜索</button>
          <button onClick={() => setEditing({})}>新增</button>
          <button onClick={() => download(`${endpoint}/export`)}>导出</button>
        </div>
      </header>
      {error && <div className="alert">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => <th key={column.key}>{column.label}</th>)}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => <td key={column.key}>{formatCell(row[column.key as keyof T])}</td>)}
                <td className="actions">
                  <button onClick={() => setEditing(row)}>编辑</button>
                  <button onClick={() => remove(row.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={submit}>
            <h2>{editing.id ? '编辑' : '新增'}{title}</h2>
            <div className="form-grid">
              {fields.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  {field.type === 'checkbox' ? (
                    <input type="checkbox" name={field.key} defaultChecked={Boolean(editing[field.key as keyof T])} />
                  ) : field.type === 'select' ? (
                    <select name={field.key} defaultValue={String(editing[field.key as keyof T] ?? field.options?.[0] ?? '')}>
                      {field.options?.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input type={field.type ?? 'text'} name={field.key} defaultValue={String(editing[field.key as keyof T] ?? '')} />
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

function formatCell(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return Number.isInteger(value) ? value : value.toFixed(2);
  return String(value ?? '');
}
