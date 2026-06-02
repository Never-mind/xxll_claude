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
    expect(result.items[0].firstMileFreightCny).toBeCloseTo(320000, 4);
    expect(result.items[1].firstMileFreightCny).toBeCloseTo(600, 4);
    expect(result.quotation.totalCifUsd).toBeCloseTo(46056.6372, 4);
    expect(result.items[0].publicFeeAllocationUsd).toBeCloseTo(99.641, 4);
    expect(result.items[1].publicFeeAllocationUsd).toBeCloseTo(0.359, 4);
    expect(result.items[0].ddpUnitPriceUsd).toBeCloseTo(26257.8483, 4);
    expect(result.items[0].revenueUsd).toBeCloseTo(65644.6207, 4);
    expect(result.quotation.totalDdpUsd).toBeCloseTo(52721.1024, 4);
    expect(result.quotation.totalRevenueUsd).toBeCloseTo(65870.5671, 4);
    expect(result.quotation.totalProfitUsd).toBeCloseTo(13149.4647, 4);
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
