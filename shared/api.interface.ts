export type TransportType = 'air' | 'sea' | 'none';
export type QuotationStatus = 'draft' | 'completed';

export interface Product {
  id: string;
  productCode: string;
  name: string;
  spec?: string;
  brand?: string;
  category?: string;
  unit: string;
  length: number;
  width: number;
  height: number;
  grossWeight: number;
  hsCodeCn?: string;
  hsCodeMx: string;
  suggestedPrice: number;
  contactName1?: string;
  contactPhone1?: string;
  contactName2?: string;
  contactPhone2?: string;
  isMagnetic: boolean;
  isElectric: boolean;
  needNom: boolean;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TariffRate {
  id: string;
  deviceType: string;
  hsCode: string;
  taxRate: number;
  needNom: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryQuotation {
  id: string;
  quotationDate: string;
  customerName: string;
  productCode: string;
  productName: string;
  spec?: string;
  brand?: string;
  transportType: TransportType;
  customerPriceUsd: number;
  createdAt: string;
  updatedAt: string;
}

export interface Quotation {
  id: string;
  quotationNo: string;
  exchangeRateUsd: number;
  exchangeRateMxn: number;
  capitalCostRate: number;
  accountPeriod: number;
  badDebtRate: number;
  customsFeeRate: number;
  vatOverseas: number;
  markupRate: number;
  seaFreightRate: number;
  airFreightRate: number;
  nomFee: number;
  customsMiscFee: number;
  lastMileFee: number;
  storageOperationFee: number;
  implementationFee: number;
  publicFeeTotal: number;
  totalCifUsd: number;
  totalDdpUsd: number;
  totalRevenueUsd: number;
  totalProfitUsd: number;
  grossMarginRate: number;
  status: QuotationStatus;
  customerId?: string;
  customerName?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  productId: string;
  productCode: string;
  productName: string;
  brand?: string;
  purchaseQty: number;
  purchasePriceCny: number;
  totalTaxIncludedCny: number;
  totalExclTaxCny: number;
  vatInputCny: number;
  transportType: TransportType;
  isCustomsClearance: boolean;
  firstMileFreightCny: number;
  cifCny: number;
  cifUsd: number;
  igiTaxRate: number;
  tariffUsd: number;
  capitalCostUsd: number;
  customsFeeUsd: number;
  nomFeeUsd: number;
  publicFeeAllocationUsd: number;
  ddpTotalUsd: number;
  ddpUnitPriceUsd: number;
  ddpQuoteUnitUsd?: number;
  revenueUsd: number;
  operatingProfitUsd: number;
  grossMarginRate: number;
  badDebtProvisionUsd: number;
  markupRate: number;
  enableNom: boolean;
  historicalDdpQuoteUsd?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationItemDto {
  productId: string;
  productCode?: string;
  productName?: string;
  purchaseQty: number;
  purchasePriceCny: number;
  purchasePriceExclTaxCny?: number;
  transportType: TransportType;
  isCustomsClearance: boolean;
  markupRate?: number;
  ddpQuoteUnitUsd?: number;
  enableNom?: boolean;
}

export interface CreateQuotationDto {
  exchangeRateUsd: number;
  exchangeRateMxn: number;
  capitalCostRate: number;
  accountPeriod: number;
  badDebtRate: number;
  customsFeeRate: number;
  vatOverseas: number;
  markupRate: number;
  seaFreightRate: number;
  airFreightRate: number;
  nomFee: number;
  customsMiscFee: number;
  lastMileFee: number;
  storageOperationFee: number;
  implementationFee: number;
  publicFeeTotal: number;
  status: QuotationStatus;
  customerId?: string;
  customerName?: string;
  remark?: string;
  items: CreateQuotationItemDto[];
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QuotationDetail {
  quotation: Quotation;
  items: QuotationItem[];
}

export type SettlementCurrency = 'CNY' | 'USD' | 'MXN';
export type SettlementPriceType = 'tax_included' | 'tax_excluded';
export type SettlementExpenseType = 'first_mile_freight' | 'customs_fee' | 'labor_fee' | 'equipment_service_fee' | 'other';
export type SettlementInvoiceType = 'income' | 'cost';

export interface SettlementProject {
  id: string;
  quotationId: string;
  quotationNo: string;
  customerName?: string;
  remark?: string;
  exchangeRateUsd: number;
  exchangeRateMxn: number;
  quotedPurchaseCostUsd: number;
  purchasedCostUsd: number;
  quotedSalesRevenueUsd: number;
  receivedRevenueUsd: number;
  grossProfitUsd: number;
  status: 'open' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface SettlementItem {
  id: string;
  projectId: string;
  quotationItemId: string;
  productId: string;
  productCode: string;
  productName: string;
  brand?: string;
  plannedQty: number;
  purchaseQty: number;
  purchaseUnitPrice: number;
  currency: SettlementCurrency;
  priceType: SettlementPriceType;
  taxRate: number;
  quotedWarehouseCostUsd: number;
  quotedSalesRevenueUsd: number;
  purchasedCostUsd: number;
  receivedRevenueUsd: number;
  invoiceNo?: string;
  ordered: boolean;
  orderedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementProjectDetail {
  project: SettlementProject;
  items: SettlementItem[];
  unpurchasedItems: SettlementItem[];
  purchasedItems: SettlementItem[];
  expenses: SettlementExpense[];
  sales: SettlementSale[];
  invoices: SettlementInvoice[];
  attachments: SettlementAttachment[];
}

export interface SettlementOrderItemDto {
  itemId: string;
  purchaseQty: number;
  purchaseUnitPrice: number;
  currency: SettlementCurrency;
  priceType: SettlementPriceType;
  taxRate: number;
  invoiceNo?: string;
}

export interface SettlementOrderDto {
  items: SettlementOrderItemDto[];
}

export type UpdateSettlementItemDto = Omit<SettlementOrderItemDto, 'itemId'>;
export type UpdateSettlementExpenseDto = CreateSettlementExpenseDto;
export type UpdateSettlementSaleDto = CreateSettlementSaleDto;
export type UpdateSettlementInvoiceDto = CreateSettlementInvoiceDto;

export interface SettlementExpense {
  id: string;
  projectId: string;
  type: SettlementExpenseType;
  description?: string;
  amount: number;
  currency: SettlementCurrency;
  priceType: SettlementPriceType;
  taxRate: number;
  costUsd: number;
  invoiceNo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementSale {
  id: string;
  projectId: string;
  description?: string;
  amount: number;
  currency: SettlementCurrency;
  priceType: SettlementPriceType;
  taxRate: number;
  receivedRevenueUsd: number;
  invoiceNo?: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSettlementExpenseDto {
  type: SettlementExpenseType;
  description?: string;
  amount: number;
  currency: SettlementCurrency;
  priceType: SettlementPriceType;
  taxRate: number;
  invoiceNo?: string;
}

export interface CreateSettlementSaleDto {
  description?: string;
  amount: number;
  currency: SettlementCurrency;
  priceType: SettlementPriceType;
  taxRate: number;
  invoiceNo?: string;
  receivedAt?: string;
}

export interface SettlementInvoice {
  id: string;
  projectId: string;
  type: SettlementInvoiceType;
  accountPeriod?: string;
  invoiceEntity?: string;
  invoiceDate?: string;
  invoiceNo?: string;
  invoiceTotal: number;
  invoiceTaxExcludedTotal: number;
  taxRate: number;
  invoiceTaxAmount: number;
  currency: SettlementCurrency;
  exchangeRate: number;
  usdAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSettlementInvoiceDto {
  type: SettlementInvoiceType;
  accountPeriod?: string;
  invoiceEntity?: string;
  invoiceDate?: string;
  invoiceNo?: string;
  invoiceTotal: number;
  invoiceTaxExcludedTotal: number;
  taxRate: number;
  invoiceTaxAmount: number;
  currency: SettlementCurrency;
  exchangeRate: number;
}

export interface SettlementAttachment {
  id: string;
  projectId: string;
  fileName: string;
  fileType?: string;
  fileSize: number;
  dataUrl: string;
  description?: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSettlementAttachmentDto {
  fileName: string;
  fileType?: string;
  fileSize: number;
  dataUrl: string;
  description?: string;
}

export interface FinanceInvoiceRow extends SettlementInvoice {
  quotationNo: string;
  customerName?: string;
  projectName?: string;
  projectStatus: SettlementProject['status'];
}
