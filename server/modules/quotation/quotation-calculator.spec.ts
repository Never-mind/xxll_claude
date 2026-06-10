import { describe, expect, it } from 'vitest';
import type { CreateQuotationDto, Product, TariffRate } from '../../../shared/api.interface.js';
import { calculateQuotation } from './quotation-calculator.js';

describe('calculateQuotation', () => {
  it('allocates public fees by CIF and recalculates DDP revenue and profit', () => {
    const products: Product[] = [
      product({ id: 'p1', productCode: 'A100', length: 100, width: 50, height: 40, grossWeight: 12, hsCodeMx: '8501' }),
      product({ id: 'p2', productCode: 'B200', length: 50, width: 40, height: 20, grossWeight: 4, hsCodeMx: '8502' }),
    ];
    const tariffs: TariffRate[] = [
      tariff({ hsCode: '8501', taxRate: 10 }),
      tariff({ hsCode: '8502', taxRate: 20 }),
    ];
    const dto: CreateQuotationDto = {
      exchangeRateUsd: 7,
      exchangeRateMxn: 0.4,
      capitalCostRate: 12,
      accountPeriod: 3,
      badDebtRate: 2,
      customsFeeRate: 1,
      vatOverseas: 16,
      markupRate: 25,
      seaFreightRate: 800,
      airFreightRate: 30,
      nomFee: 100,
      customsMiscFee: 30,
      lastMileFee: 20,
      storageOperationFee: 10,
      implementationFee: 40,
      publicFeeTotal: 150,
      status: 'completed',
      items: [
        { productId: 'p1', purchaseQty: 2, purchasePriceCny: 700, transportType: 'sea', isCustomsClearance: true, enableNom: true },
        { productId: 'p2', purchaseQty: 3, purchasePriceCny: 210, transportType: 'air', isCustomsClearance: true, markupRate: 10 },
      ],
    };

    const result = calculateQuotation(dto, products, tariffs);

    expect(result.quotation.publicFeeTotal).toBe(100);
    expect(result.items[0].firstMileFreightCny).toBeCloseTo(320, 4);
    expect(result.items[1].firstMileFreightCny).toBeCloseTo(600, 4);
    expect(result.quotation.totalCifUsd).toBeCloseTo(388.0657, 4);
    expect(result.items[0].publicFeeAllocationUsd).toBeCloseTo(57.3886, 4);
    expect(result.items[1].publicFeeAllocationUsd).toBeCloseTo(42.6114, 4);
    expect(result.items[0].ddpUnitPriceUsd).toBeCloseTo(205.6364, 4);
    expect(result.items[0].revenueUsd).toBeCloseTo(514.091, 4);
    expect(result.quotation.totalDdpUsd).toBeCloseTo(658.931, 4);
    expect(result.quotation.totalRevenueUsd).toBeCloseTo(786.515, 4);
    expect(result.quotation.totalProfitUsd).toBeCloseTo(127.584, 4);
  });

  it('uses tax excluded purchase unit price as the CIF cost basis', () => {
    const products: Product[] = [
      product({ id: 'p1', productCode: 'A100', length: 10, width: 10, height: 10, grossWeight: 1, hsCodeMx: '8501' }),
    ];
    const dto: CreateQuotationDto = {
      exchangeRateUsd: 7,
      exchangeRateMxn: 0.4,
      capitalCostRate: 0,
      accountPeriod: 0,
      badDebtRate: 0,
      customsFeeRate: 0,
      vatOverseas: 16,
      markupRate: 0,
      seaFreightRate: 0,
      airFreightRate: 0,
      nomFee: 0,
      customsMiscFee: 0,
      lastMileFee: 0,
      storageOperationFee: 0,
      implementationFee: 0,
      publicFeeTotal: 0,
      status: 'draft',
      items: [
        { productId: 'p1', purchaseQty: 10, purchasePriceCny: 113, purchasePriceExclTaxCny: 100, transportType: 'none', isCustomsClearance: false },
      ],
    };

    const result = calculateQuotation(dto, products, []);

    expect(result.items[0].totalTaxIncludedCny).toBeCloseTo(1130, 4);
    expect(result.items[0].totalExclTaxCny).toBeCloseTo(1000, 4);
    expect(result.items[0].cifCny).toBeCloseTo(1000, 4);
    expect(result.items[0].cifUsd).toBeCloseTo(142.8571, 4);
  });

  it('preserves manually entered DDP quote unit price for draft edits', () => {
    const products: Product[] = [
      product({ id: 'p1', productCode: 'A100', length: 10, width: 10, height: 10, grossWeight: 1, hsCodeMx: '8501' }),
    ];
    const dto: CreateQuotationDto = {
      exchangeRateUsd: 7,
      exchangeRateMxn: 0.4,
      capitalCostRate: 0,
      accountPeriod: 0,
      badDebtRate: 0,
      customsFeeRate: 0,
      vatOverseas: 16,
      markupRate: 0,
      seaFreightRate: 0,
      airFreightRate: 0,
      nomFee: 0,
      customsMiscFee: 0,
      lastMileFee: 0,
      storageOperationFee: 0,
      implementationFee: 0,
      publicFeeTotal: 0,
      status: 'draft',
      items: [
        {
          productId: 'p1',
          purchaseQty: 3,
          purchasePriceCny: 113,
          purchasePriceExclTaxCny: 100,
          transportType: 'none',
          isCustomsClearance: false,
          ddpQuoteUnitUsd: 12.345678,
        },
      ],
    };

    const result = calculateQuotation(dto, products, []);

    expect(result.items[0].ddpQuoteUnitUsd).toBeCloseTo(12.3457, 4);
    expect(result.items[0].revenueUsd).toBeCloseTo(37.037, 4);
  });
});

function product(overrides: Partial<Product>): Product {
  return {
    id: 'p',
    productCode: 'CODE',
    name: 'Product',
    unit: '个',
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

function tariff(overrides: Partial<TariffRate>): TariffRate {
  return {
    id: 't',
    deviceType: 'device',
    hsCode: '0000',
    taxRate: 0,
    needNom: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}
