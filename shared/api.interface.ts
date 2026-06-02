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
  revenueUsd: number;
  operatingProfitUsd: number;
  grossMarginRate: number;
  badDebtProvisionUsd: number;
  markupRate: number;
  enableNom: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationItemDto {
  productId: string;
  purchaseQty: number;
  purchasePriceCny: number;
  transportType: TransportType;
  isCustomsClearance: boolean;
  markupRate?: number;
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
