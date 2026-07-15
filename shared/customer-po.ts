import type { CreateQuotationDto, CustomerPo, CustomerPoItem } from './api.interface.js';

export const customerPoDefaultQuotationParams = {
  exchangeRateUsd: 6.82,
  exchangeRateMxn: 0.06,
  capitalCostRate: 6,
  accountPeriod: 2,
  badDebtRate: 1,
  customsFeeRate: 0.8,
  vatOverseas: 16,
  markupRate: 20,
  seaFreightRate: 3200,
  airFreightRate: 100,
  nomFee: 700,
  customsMiscFee: 0,
  lastMileFee: 0,
  storageOperationFee: 0,
  implementationFee: 0,
  publicFeeTotal: 0,
};

export function customerPoToQuotationDraft(
  po: CustomerPo,
  items: CustomerPoItem[],
  overrides: Partial<CreateQuotationDto> = {},
): CreateQuotationDto {
  if (!po.customerId) throw new Error('客户 PO 必须选择系统客户后才能生成报价单');
  if (!items.length) throw new Error('客户 PO 至少需要一条产品明细');
  const unmatched = items.filter((item) => !item.matchedProductId);
  if (unmatched.length) {
    throw new Error(`还有 ${unmatched.length} 条 PO 明细未匹配系统产品，不能生成报价单`);
  }

  return {
    ...customerPoDefaultQuotationParams,
    ...overrides,
    status: 'draft',
    customerId: po.customerId,
    customerName: po.customerName,
    remark: buildQuotationRemark(po),
    sourceType: 'customer_po',
    sourcePoId: po.id,
    sourcePoNo: po.poNo,
    items: items.map((item) => ({
      productId: item.matchedProductId || '',
      productCode: item.matchedProductCode || '',
      productName: item.matchedProductName || item.customerProductName,
      purchaseQty: Number(item.quantity || 0),
      purchaseCurrency: 'CNY',
      purchaseUnitPrice: 0,
      transportType: 'sea',
      isCustomsClearance: true,
      sourcePoItemId: item.id,
      sourcePoLineNo: item.lineNo,
    })),
  };
}

function buildQuotationRemark(po: CustomerPo): string {
  const parts = [`来源客户PO: ${po.poNo}`];
  if (po.remark?.trim()) parts.push(po.remark.trim());
  return parts.join(' | ');
}
