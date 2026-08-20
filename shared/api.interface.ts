export type TransportType = 'air' | 'sea' | 'none';
export type QuotationStatus = 'draft' | 'completed';
export type PurchaseCurrency = 'CNY' | 'USD' | 'MXN';
export type CustomerPoStatus = 'draft' | 'matched' | 'quoted' | 'cancelled';
export type CustomerPoItemMatchStatus = 'unmatched' | 'matched' | 'temporary';
export type CustomerPoItemSourceType = 'system' | 'temporary';

export interface LoginDto {
  username: string;
  password: string;
}

export interface LoginResult {
  username: string;
  token: string;
}

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
  customerCode?: string;
  nameCn?: string;
  nameEn?: string;
  shortName?: string;
  name: string;
  taxNumber?: string;
  country?: string;
  address?: string;
  postalCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export type CustomerBankCurrency = 'CNY' | 'USD' | 'BRL' | 'CLP' | 'MXN' | 'OTHER';

export interface CustomerBankAccount {
  id: string;
  customerId: string;
  accountName?: string;
  bankName: string;
  bankAccount: string;
  bankRoutingNumber?: string;
  swiftCode?: string;
  currency: CustomerBankCurrency;
  otherCurrency?: string;
  bankAddress?: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  phone?: string;
  email?: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAttachment {
  id: string;
  customerId: string;
  fileName: string;
  fileType?: string;
  fileSize: number;
  dataUrl?: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail {
  customer: Customer;
  bankAccounts: CustomerBankAccount[];
  contacts: CustomerContact[];
  attachments: CustomerAttachment[];
}

export interface CreateCustomerBankAccountDto {
  accountName?: string;
  bankName?: string;
  bankAccount?: string;
  bankRoutingNumber?: string;
  swiftCode?: string;
  currency?: CustomerBankCurrency;
  otherCurrency?: string;
  bankAddress?: string;
  isDefault?: boolean;
}

export interface CreateCustomerContactDto {
  name?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}

export interface CreateCustomerDto {
  customerCode?: string;
  nameCn?: string;
  nameEn?: string;
  shortName?: string;
  name: string;
  taxNumber?: string;
  country?: string;
  address?: string;
  postalCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  bankAccounts?: CreateCustomerBankAccountDto[];
  contacts?: CreateCustomerContactDto[];
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

export type SupplierType = 'manufacturer' | 'agent' | 'integrator' | 'third_party';
export type SupplierCooperationStatus = 'normal' | 'suspended' | 'terminated' | 'not_cooperated';

export interface Supplier {
  id: string;
  supplierCode: string;
  nameCn: string;
  nameEn?: string;
  shortName?: string;
  country?: string;
  city?: string;
  registeredAddress?: string;
  taxNumber?: string;
  supplierType: SupplierType;
  supplyCategories: string[];
  brands: string[];
  cooperationStatus: SupplierCooperationStatus;
  website?: string;
  remark?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierBankAccount {
  id: string;
  supplierId: string;
  accountName?: string;
  bankName: string;
  bankAccount: string;
  bankRoutingNumber?: string;
  swiftCode?: string;
  currency: string;
  bankAddress?: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierContact {
  id: string;
  supplierId: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierAttachment {
  id: string;
  supplierId: string;
  fileName: string;
  fileType?: string;
  fileSize: number;
  dataUrl?: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDetail {
  supplier: Supplier;
  bankAccounts: SupplierBankAccount[];
  contacts: SupplierContact[];
  attachments: SupplierAttachment[];
}

export interface CreateSupplierBankAccountDto {
  accountName?: string;
  bankName?: string;
  bankAccount?: string;
  bankRoutingNumber?: string;
  swiftCode?: string;
  currency?: string;
  bankAddress?: string;
  isDefault?: boolean;
}

export interface CreateSupplierContactDto {
  name?: string;
  title?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}

export interface CreateSupplierDto {
  supplierCode?: string;
  nameCn: string;
  nameEn?: string;
  shortName?: string;
  country?: string;
  city?: string;
  registeredAddress?: string;
  taxNumber?: string;
  supplierType?: SupplierType;
  supplyCategories?: string[];
  brands?: string[];
  cooperationStatus?: SupplierCooperationStatus;
  website?: string;
  remark?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  bankAccounts?: CreateSupplierBankAccountDto[];
  contacts?: CreateSupplierContactDto[];
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {}

export interface ContractingEntityBankAccount {
  id: string;
  entityId: string;
  accountName?: string;
  bankName: string;
  bankAccount: string;
  bankRoutingNumber?: string;
  swiftCode?: string;
  currency: string;
  bankAddress?: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContractingEntityContact {
  id: string;
  entityId: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContractingEntityAttachment {
  id: string;
  entityId: string;
  fileName: string;
  fileType?: string;
  fileSize: number;
  dataUrl?: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractingEntityDetail {
  entity: ContractingEntity;
  bankAccounts: ContractingEntityBankAccount[];
  contacts: ContractingEntityContact[];
  attachments: ContractingEntityAttachment[];
}

export interface ContractingEntity {
  id: string;
  entityCode: string;
  nameCn?: string;
  nameEn?: string;
  shortName?: string;
  entityName: string;
  taxNumber?: string;
  country?: string;
  city?: string;
  registeredAddress?: string;
  address?: string;
  remark?: string;
  bankAccount?: string;
  contactName?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractingEntityDto {
  entityCode?: string;
  nameCn?: string;
  nameEn?: string;
  shortName?: string;
  entityName: string;
  taxNumber?: string;
  country?: string;
  city?: string;
  registeredAddress?: string;
  address?: string;
  remark?: string;
  bankAccount?: string;
  contactName?: string;
  contactPhone?: string;
  bankAccounts?: Array<Partial<ContractingEntityBankAccount>>;
  contacts?: Array<Partial<ContractingEntityContact>>;
}

export interface UpdateContractingEntityDto extends Partial<CreateContractingEntityDto> {}

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
  contractingEntityId?: string;
  contractingEntityName?: string;
  remark?: string;
  sourceType?: 'customer_po' | '';
  sourcePoId?: string;
  sourcePoNo?: string;
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
  purchaseCurrency: PurchaseCurrency;
  purchaseUnitPrice: number;
  purchaseTotalOriginal: number;
  purchaseTotalUsd: number;
  transportType: TransportType;
  isCustomsClearance: boolean;
  firstMileFreightUsd: number;
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
  sourcePoItemId?: string;
  sourcePoLineNo?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationItemDto {
  productId: string;
  productCode?: string;
  productName?: string;
  purchaseQty: number;
  purchaseCurrency?: PurchaseCurrency;
  purchaseUnitPrice?: number;
  purchasePriceCny?: number;
  purchasePriceExclTaxCny?: number;
  transportType: TransportType;
  isCustomsClearance: boolean;
  markupRate?: number;
  ddpQuoteUnitUsd?: number;
  enableNom?: boolean;
  sourcePoItemId?: string;
  sourcePoLineNo?: number;
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
  contractingEntityId?: string;
  contractingEntityName?: string;
  remark?: string;
  sourceType?: 'customer_po' | '';
  sourcePoId?: string;
  sourcePoNo?: string;
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

export interface QuotationDetailPage {
  quotation: Quotation;
  items: PageResult<QuotationItem>;
}

export interface CustomerPo {
  id: string;
  poNo: string;
  customerId: string;
  customerName: string;
  poDate: string;
  deliveryDate?: string;
  currency: PurchaseCurrency;
  status: CustomerPoStatus;
  remark?: string;
  quotationId?: string;
  quotationNo?: string;
  createdBy?: string;
  itemCount?: number;
  totalQuantity?: number;
  totalAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPoItem {
  id: string;
  poId: string;
  lineNo: number;
  customerSku?: string;
  customerProductName: string;
  customerSpec?: string;
  customerBrand?: string;
  unit?: string;
  quantity: number;
  targetUnitPrice?: number;
  currency: PurchaseCurrency;
  imageUrl?: string;
  remark?: string;
  matchedProductId?: string;
  matchedProductCode?: string;
  matchedProductName?: string;
  matchStatus: CustomerPoItemMatchStatus;
  matchMethod?: string;
  sourceType: CustomerPoItemSourceType;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPoDetail {
  po: CustomerPo;
  items: CustomerPoItem[];
}

export interface CustomerProductAlias {
  id: string;
  customerId: string;
  customerName: string;
  customerSku?: string;
  customerProductName: string;
  customerSpec?: string;
  customerBrand?: string;
  productId: string;
  productCode: string;
  productName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerPoItemDto {
  id?: string;
  lineNo?: number;
  customerSku?: string;
  customerProductName: string;
  customerSpec?: string;
  customerBrand?: string;
  unit?: string;
  quantity: number;
  targetUnitPrice?: number;
  currency?: PurchaseCurrency;
  imageUrl?: string;
  remark?: string;
  matchedProductId?: string;
  matchedProductCode?: string;
  matchedProductName?: string;
  matchStatus?: CustomerPoItemMatchStatus;
  matchMethod?: string;
  sourceType?: CustomerPoItemSourceType;
}

export interface CreateCustomerPoDto {
  poNo: string;
  customerId: string;
  customerName?: string;
  poDate: string;
  deliveryDate?: string;
  currency: PurchaseCurrency;
  status?: CustomerPoStatus;
  remark?: string;
  createdBy?: string;
  items: CreateCustomerPoItemDto[];
}

export interface UpdateCustomerPoDto extends CreateCustomerPoDto {}

export type SettlementCurrency = 'CNY' | 'USD' | 'MXN';
export type SettlementPriceType = 'tax_included' | 'tax_excluded';
export type SettlementExpenseType = 'first_mile_freight' | 'customs_fee' | 'labor_fee' | 'equipment_service_fee' | 'other';
export type SettlementInvoiceType = 'income' | 'cost';

export interface SettlementProject {
  id: string;
  projectNo: string;
  quotationId: string;
  quotationNo: string;
  customerName?: string;
  contractingEntityId?: string;
  contractingEntityName?: string;
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

export interface SettlementProjectDetailPage {
  project: SettlementProject;
  items: PageResult<SettlementItem>;
  unpurchasedItems: PageResult<SettlementItem>;
  purchasedItems: PageResult<SettlementItem>;
  expenses: PageResult<SettlementExpense>;
  sales: PageResult<SettlementSale>;
  invoices: PageResult<SettlementInvoice>;
  attachments: PageResult<SettlementAttachment>;
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
  accountingDate?: string;
  companyEntity?: string;
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
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSettlementInvoiceDto {
  type: SettlementInvoiceType;
  accountPeriod?: string;
  accountingDate?: string;
  companyEntity?: string;
  invoiceEntity?: string;
  invoiceDate?: string;
  invoiceNo?: string;
  invoiceTotal: number;
  invoiceTaxExcludedTotal: number;
  taxRate: number;
  invoiceTaxAmount: number;
  currency: SettlementCurrency;
  exchangeRate: number;
  isPaid?: boolean;
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
  projectId: string;
  projectNo: string;
  quotationId: string;
  quotationNo: string;
  customerName?: string;
  projectName?: string;
  projectStatus: SettlementProject['status'];
  contractingEntityId?: string;
  contractingEntityName?: string;
  contractingEntityShortName?: string;
  customerShortName?: string;
}
