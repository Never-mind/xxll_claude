import type {
  CreateQuotationDto,
  CreateCustomerPoDto,
  CreateCustomerDto,
  CreateSettlementAttachmentDto,
  CreateSettlementExpenseDto,
  CreateSettlementInvoiceDto,
  CreateSettlementSaleDto,
  Customer,
  CustomerAttachment,
  CustomerBankAccount,
  CustomerContact,
  CustomerDetail,
  CreateSupplierDto,
  ContractingEntity,
  ContractingEntityAttachment,
  ContractingEntityBankAccount,
  ContractingEntityContact,
  ContractingEntityDetail,
  CreateContractingEntityDto,
  UpdateContractingEntityDto,
  CustomerPo,
  CustomerPoDetail,
  FinanceInvoiceRow,
  HistoryQuotation,
  LoginDto,
  LoginResult,
  PageResult,
  Product,
  Quotation,
  QuotationDetail,
  QuotationDetailPage,
  SettlementCurrency,
  SettlementExpense,
  SettlementItem,
  SettlementInvoiceType,
  SettlementOrderDto,
  SettlementProject,
  SettlementProjectDetail,
  SettlementProjectDetailPage,
  SettlementSale,
  Supplier,
  SupplierAttachment,
  SupplierBankAccount,
  SupplierContact,
  SupplierDetail,
  TariffRate,
  UpdateSettlementExpenseDto,
  UpdateSettlementInvoiceDto,
  UpdateSettlementItemDto,
  UpdateSettlementSaleDto,
  UpdateCustomerDto,
} from '../../shared/api.interface.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`);
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

export async function apiWrite<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? JSON_HEADERS : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.headers.get('content-type')?.includes('application/json') ? response.json() : (undefined as T);
}

export async function upload(path: string, file: File): Promise<{ imported: number; errors: string[] }> {
  return uploadFile<{ imported: number; errors: string[] }>(path, file);
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

export function download(path: string): void {
  window.location.href = `/api${path}`;
}

export async function login(credentials: LoginDto): Promise<LoginResult> {
  return apiWrite<LoginResult>('/auth/login', 'POST', credentials);
}

async function errorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `${response.status} ${response.statusText}`.trim();
  try {
    const body = JSON.parse(text) as { message?: string | string[]; error?: string };
    if (Array.isArray(body.message)) return body.message.join('\n');
    return body.message || body.error || text;
  } catch {
    return text;
  }
}

export type ProductPage = PageResult<Product>;
export type TariffPage = PageResult<TariffRate>;
export type QuotationPage = PageResult<Quotation>;
export type HistoryPage = PageResult<HistoryQuotation>;
export type CustomerPage = PageResult<Customer>;
export type SupplierPage = PageResult<Supplier>;
export type ContractingEntityPage = PageResult<ContractingEntity>;
export type CustomerPoPage = PageResult<CustomerPo>;
export type SettlementProjectPage = PageResult<SettlementProject>;
export type FinanceInvoicePage = PageResult<FinanceInvoiceRow>;
export type {
  Product,
  TariffRate,
  HistoryQuotation,
  Quotation,
  QuotationDetail,
  QuotationDetailPage,
  CreateQuotationDto,
  CreateCustomerPoDto,
  CreateCustomerDto,
  Customer,
  CustomerAttachment,
  CustomerBankAccount,
  CustomerContact,
  CustomerDetail,
  CreateSupplierDto,
  CustomerPo,
  CustomerPoDetail,
  FinanceInvoiceRow,
  LoginDto,
  LoginResult,
  SettlementCurrency,
  SettlementExpense,
  SettlementItem,
  SettlementInvoiceType,
  SettlementOrderDto,
  SettlementProject,
  SettlementProjectDetail,
  SettlementProjectDetailPage,
  SettlementSale,
  Supplier,
  SupplierAttachment,
  SupplierBankAccount,
  SupplierContact,
  SupplierDetail,
  CreateSettlementAttachmentDto,
  CreateSettlementExpenseDto,
  CreateSettlementInvoiceDto,
  CreateSettlementSaleDto,
  UpdateSettlementExpenseDto,
  UpdateSettlementInvoiceDto,
  UpdateSettlementItemDto,
  UpdateSettlementSaleDto,
  UpdateCustomerDto,
  ContractingEntity,
  ContractingEntityAttachment,
  ContractingEntityBankAccount,
  ContractingEntityContact,
  ContractingEntityDetail,
  CreateContractingEntityDto,
  UpdateContractingEntityDto,
};
