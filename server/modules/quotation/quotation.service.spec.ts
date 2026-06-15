import { describe, expect, it, vi } from 'vitest';
import type { Quotation, QuotationItem } from '../../../shared/api.interface.js';
import { QuotationService } from './quotation.service.js';

const draftQuotation: Quotation = {
  id: 'quotation-1',
  quotationNo: 'QTN-1',
  exchangeRateUsd: 7,
  exchangeRateMxn: 0.06,
  capitalCostRate: 6,
  accountPeriod: 2,
  badDebtRate: 1,
  customsFeeRate: 0.8,
  vatOverseas: 16,
  markupRate: 10,
  seaFreightRate: 3200,
  airFreightRate: 100,
  nomFee: 700,
  customsMiscFee: 0,
  lastMileFee: 0,
  storageOperationFee: 0,
  implementationFee: 0,
  publicFeeTotal: 0,
  totalCifUsd: 100,
  totalDdpUsd: 120,
  totalRevenueUsd: 140,
  totalProfitUsd: 20,
  grossMarginRate: 14.2857,
  status: 'draft',
  customerId: 'customer-1',
  customerName: '客户A',
  remark: '项目A',
  createdAt: '2026-06-10T00:00:00.000Z',
  updatedAt: '2026-06-10T00:00:00.000Z',
};

const quotationItem: QuotationItem = {
  id: 'item-1',
  quotationId: 'quotation-1',
  productId: 'product-1',
  productCode: 'P-1',
  productName: '产品A',
  brand: '品牌A',
  purchaseQty: 2,
  purchaseCurrency: 'CNY',
  purchaseUnitPrice: 50,
  purchaseTotalOriginal: 100,
  purchaseTotalUsd: 14.2857,
  transportType: 'sea',
  isCustomsClearance: true,
  firstMileFreightUsd: 5,
  cifUsd: 19.2857,
  igiTaxRate: 10,
  tariffUsd: 1.9286,
  capitalCostUsd: 0.1929,
  customsFeeUsd: 0.1543,
  nomFeeUsd: 0,
  publicFeeAllocationUsd: 0,
  ddpTotalUsd: 21.5615,
  ddpUnitPriceUsd: 10.7808,
  ddpQuoteUnitUsd: 12,
  revenueUsd: 24,
  operatingProfitUsd: 2.4385,
  grossMarginRate: 10.1604,
  badDebtProvisionUsd: 0.24,
  markupRate: 11.308,
  enableNom: false,
  createdAt: '2026-06-10T00:00:00.000Z',
  updatedAt: '2026-06-10T00:00:00.000Z',
};

describe('QuotationService.confirm', () => {
  it('marks a draft quotation as completed and syncs related records', async () => {
    const storage = {
      query: vi.fn(async (file: string) => file === 'quotations.xlsx' ? [draftQuotation] : [quotationItem]),
      update: vi.fn(async (_file: string, _id: string, patch: Partial<Quotation>) => ({ ...draftQuotation, ...patch })),
    };
    const products = { all: vi.fn(async () => [{ id: 'product-1', spec: '规格A', brand: '品牌A' }]) };
    const customers = {};
    const tariffs = {};
    const history = {
      all: vi.fn(async () => []),
      create: vi.fn(async () => undefined),
    };
    const settlements = { ensureForQuotation: vi.fn(async () => undefined) };
    const service = new QuotationService(
      storage as never,
      products as never,
      customers as never,
      tariffs as never,
      history as never,
      settlements as never,
    );

    const result = await service.confirm('quotation-1');

    expect(result.quotation.status).toBe('completed');
    expect(storage.update).toHaveBeenCalledWith('quotations.xlsx', 'quotation-1', { status: 'completed' });
    expect(history.create).toHaveBeenCalledOnce();
    expect(settlements.ensureForQuotation).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }), expect.any(Array));
  });
});
