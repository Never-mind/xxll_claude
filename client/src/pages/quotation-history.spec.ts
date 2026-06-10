import { describe, expect, it } from 'vitest';
import type { HistoryQuotation, Product } from '../api.js';
import { findHistoricalDdpQuoteUsd } from './quotation-history.js';

describe('findHistoricalDdpQuoteUsd', () => {
  it('returns the latest historical customer price for the selected customer and product', () => {
    const product = productFixture({ productCode: 'A100', name: 'Pump' });
    const histories: HistoryQuotation[] = [
      historyFixture({ customerName: 'Acme', productCode: 'A100', productName: 'Pump', customerPriceUsd: 88, quotationDate: '2026-01-01' }),
      historyFixture({ customerName: 'Acme', productCode: 'A100', productName: 'Pump', customerPriceUsd: 99, quotationDate: '2026-03-01' }),
      historyFixture({ customerName: 'Other', productCode: 'A100', productName: 'Pump', customerPriceUsd: 120, quotationDate: '2026-04-01' }),
    ];

    expect(findHistoricalDdpQuoteUsd(histories, 'Acme', product)).toBe(99);
  });

  it('returns null when the customer or product has no historical quote', () => {
    const product = productFixture({ productCode: 'B200', name: 'Valve' });
    const histories: HistoryQuotation[] = [
      historyFixture({ customerName: 'Acme', productCode: 'A100', productName: 'Pump', customerPriceUsd: 88 }),
    ];

    expect(findHistoricalDdpQuoteUsd(histories, 'Acme', product)).toBeNull();
    expect(findHistoricalDdpQuoteUsd(histories, '', product)).toBeNull();
  });
});

function productFixture(overrides: Partial<Product>): Product {
  return {
    id: 'p1',
    productCode: 'A100',
    name: 'Pump',
    unit: 'pcs',
    length: 1,
    width: 1,
    height: 1,
    grossWeight: 1,
    hsCodeMx: '0000',
    suggestedPrice: 1,
    isMagnetic: false,
    isElectric: false,
    needNom: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function historyFixture(overrides: Partial<HistoryQuotation>): HistoryQuotation {
  return {
    id: 'h1',
    quotationDate: '2026-01-01',
    customerName: 'Acme',
    productCode: 'A100',
    productName: 'Pump',
    transportType: 'sea',
    customerPriceUsd: 88,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
