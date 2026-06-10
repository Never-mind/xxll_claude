import type { SettlementCurrency, SettlementPriceType } from '../../../shared/api.interface.js';

interface SettlementPurchaseAmountInput {
  purchaseQty: number;
  purchaseUnitPrice: number;
  currency: SettlementCurrency;
  priceType: SettlementPriceType;
  taxRate: number;
  exchangeRateUsd: number;
  exchangeRateMxn: number;
}

export function calculateSettlementPurchaseAmounts(input: SettlementPurchaseAmountInput) {
  const purchaseTotal = Number(input.purchaseQty || 0) * Number(input.purchaseUnitPrice || 0);
  const taxRate = Number(input.taxRate || 0);
  const taxFactor = 1 + taxRate / 100;
  const taxExcludedTotal = input.priceType === 'tax_included' ? safeDivide(purchaseTotal, taxFactor) : purchaseTotal;
  const taxIncludedTotal = input.priceType === 'tax_excluded' ? purchaseTotal * taxFactor : purchaseTotal;

  return {
    purchaseTotal,
    taxExcludedUsd: round(convertToUsd(taxExcludedTotal, input.currency, input.exchangeRateUsd, input.exchangeRateMxn)),
    taxIncludedUsd: round(convertToUsd(taxIncludedTotal, input.currency, input.exchangeRateUsd, input.exchangeRateMxn)),
  };
}

function convertToUsd(amount: number, currency: SettlementCurrency, exchangeRateUsd: number, exchangeRateMxn: number): number {
  if (currency === 'USD') return amount;
  if (currency === 'MXN') return amount * Number(exchangeRateMxn || 0);
  return exchangeRateUsd ? amount / exchangeRateUsd : 0;
}

function safeDivide(value: number, divisor: number): number {
  return divisor ? value / divisor : 0;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
