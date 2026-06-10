import { describe, expect, it } from 'vitest';
import { calculateSettlementPurchaseAmounts } from './settlement-purchase-amount.js';

describe('calculateSettlementPurchaseAmounts', () => {
  it('calculates tax-excluded and tax-included USD amounts from a tax-excluded CNY price', () => {
    const result = calculateSettlementPurchaseAmounts({
      purchaseQty: 2,
      purchaseUnitPrice: 100,
      currency: 'CNY',
      priceType: 'tax_excluded',
      taxRate: 13,
      exchangeRateUsd: 6.82,
      exchangeRateMxn: 0.06,
    });

    expect(result.purchaseTotal).toBe(200);
    expect(result.taxExcludedUsd).toBeCloseTo(29.3255, 4);
    expect(result.taxIncludedUsd).toBeCloseTo(33.1378, 4);
  });

  it('calculates tax-excluded and tax-included USD amounts from a tax-included MXN price', () => {
    const result = calculateSettlementPurchaseAmounts({
      purchaseQty: 10,
      purchaseUnitPrice: 50,
      currency: 'MXN',
      priceType: 'tax_included',
      taxRate: 16,
      exchangeRateUsd: 6.82,
      exchangeRateMxn: 0.06,
    });

    expect(result.purchaseTotal).toBe(500);
    expect(result.taxIncludedUsd).toBeCloseTo(30, 4);
    expect(result.taxExcludedUsd).toBeCloseTo(25.8621, 4);
  });
});
