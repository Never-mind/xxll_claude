import type { CreateQuotationDto, PageResult, Product, Quotation, QuotationDetail, TariffRate, HistoryQuotation } from '../../shared/api.interface.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function apiWrite<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? JSON_HEADERS : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.headers.get('content-type')?.includes('application/json') ? response.json() : (undefined as T);
}

export function download(path: string): void {
  window.location.href = `/api${path}`;
}

export type ProductPage = PageResult<Product>;
export type TariffPage = PageResult<TariffRate>;
export type QuotationPage = PageResult<Quotation>;
export type HistoryPage = PageResult<HistoryQuotation>;
export type { Product, TariffRate, HistoryQuotation, Quotation, QuotationDetail, CreateQuotationDto };
