import { describe, expect, it } from 'vitest';
import { calculateSettlementPurchaseAmounts, summarizeSettlementOrderItems } from './settlement-purchase-amount.js';

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

  it('summarizes selected order items by quantity, currency totals, and USD cost totals', () => {
    const result = summarizeSettlementOrderItems([
      {
        purchaseQty: 2,
        purchaseUnitPrice: 100,
        currency: 'CNY',
        priceType: 'tax_excluded',
        taxRate: 13,
      },
      {
        purchaseQty: 3,
        purchaseUnitPrice: 20,
        currency: 'USD',
        priceType: 'tax_included',
        taxRate: 10,
      },
      {
        purchaseQty: 4,
        purchaseUnitPrice: 50,
        currency: 'CNY',
        priceType: 'tax_included',
        taxRate: 13,
      },
    ], 6.82, 0.06);

    expect(result.itemCount).toBe(3);
    expect(result.purchaseQty).toBe(9);
    expect(result.totalsByCurrency).toEqual({ CNY: 400, USD: 60, MXN: 0 });
    expect(result.taxExcludedUsd).toBeCloseTo(109.8228, 4);
    expect(result.taxIncludedUsd).toBeCloseTo(122.4633, 4);
  });
});
