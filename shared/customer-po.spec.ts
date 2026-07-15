import { describe, expect, it } from 'vitest';
import { customerPoToQuotationDraft } from './customer-po.js';
import type { CustomerPo, CustomerPoItem } from './api.interface.js';

describe('customerPoToQuotationDraft', () => {
  it('rejects PO items that are not matched to system products', () => {
    expect(() => customerPoToQuotationDraft(po(), [
      poItem({ id: 'item-1', matchedProductId: '' }),
    ])).toThrow('还有 1 条 PO 明细未匹配系统产品，不能生成报价单');
  });

  it('converts matched PO items into a quotation draft with PO source links', () => {
    const draft = customerPoToQuotationDraft(po({ remark: 'urgent order' }), [
      poItem({
        id: 'item-1',
        lineNo: 2,
        quantity: 12,
        matchedProductId: 'product-1',
        matchedProductCode: 'P-001',
        matchedProductName: 'System Product',
      }),
    ]);

    expect(draft.status).toBe('draft');
    expect(draft.customerId).toBe('customer-1');
    expect(draft.sourceType).toBe('customer_po');
    expect(draft.sourcePoId).toBe('po-1');
    expect(draft.sourcePoNo).toBe('PO-001');
    expect(draft.remark).toBe('来源客户PO: PO-001 | urgent order');
    expect(draft.items).toEqual([
      expect.objectContaining({
        productId: 'product-1',
        productCode: 'P-001',
        productName: 'System Product',
        purchaseQty: 12,
        purchaseCurrency: 'CNY',
        purchaseUnitPrice: 0,
        transportType: 'sea',
        isCustomsClearance: true,
        sourcePoItemId: 'item-1',
        sourcePoLineNo: 2,
      }),
    ]);
  });
});

function po(overrides: Partial<CustomerPo> = {}): CustomerPo {
  return {
    id: 'po-1',
    poNo: 'PO-001',
    customerId: 'customer-1',
    customerName: 'Customer A',
    poDate: '2026-06-18',
    deliveryDate: '',
    currency: 'USD',
    status: 'matched',
    remark: '',
    quotationId: '',
    quotationNo: '',
    createdBy: 'sales',
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides,
  };
}

function poItem(overrides: Partial<CustomerPoItem> = {}): CustomerPoItem {
  return {
    id: 'item-1',
    poId: 'po-1',
    lineNo: 1,
    customerSku: 'SKU-1',
    customerProductName: 'Customer Product',
    customerSpec: '',
    customerBrand: '',
    unit: 'pcs',
    quantity: 1,
    targetUnitPrice: 0,
    currency: 'USD',
    imageUrl: '',
    remark: '',
    matchedProductId: '',
    matchedProductCode: '',
    matchedProductName: '',
    matchStatus: 'unmatched',
    matchMethod: '',
    sourceType: 'temporary',
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides,
  };
}
