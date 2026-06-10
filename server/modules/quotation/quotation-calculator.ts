import type {
  CreateQuotationDto,
  Product,
  Quotation,
  QuotationItem,
  TariffRate,
} from '../../../shared/api.interface.js';

export interface CalculatedQuotation {
  quotation: Omit<Quotation, 'id' | 'quotationNo' | 'createdAt' | 'updatedAt'>;
  items: Omit<QuotationItem, 'id' | 'quotationId' | 'createdAt' | 'updatedAt'>[];
}

export function calculateQuotation(
  dto: CreateQuotationDto,
  products: Product[],
  tariffs: TariffRate[],
): CalculatedQuotation {
  const publicFeeTotal = Number(dto.customsMiscFee || 0)
    + Number(dto.lastMileFee || 0)
    + Number(dto.storageOperationFee || 0)
    + Number(dto.implementationFee || 0);
  const { items: _items, ...quotationParams } = { ...dto, publicFeeTotal };
  const initialItems = dto.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    const tariff = tariffs.find((candidate) => candidate.hsCode === product.hsCodeMx);
    const purchaseQty = Number(item.purchaseQty);
    const purchasePriceExclTaxCny = item.purchasePriceExclTaxCny === undefined
      ? safeDivide(Number(item.purchasePriceCny), 1.13)
      : Number(item.purchasePriceExclTaxCny);
    const purchasePriceCny = item.purchasePriceCny === undefined
      ? purchasePriceExclTaxCny * 1.13
      : Number(item.purchasePriceCny);
    const totalTaxIncludedCny = purchaseQty * purchasePriceCny;
    const totalExclTaxCny = purchaseQty * purchasePriceExclTaxCny;
    const vatInputCny = totalTaxIncludedCny - totalExclTaxCny;
    const length = Number(product.length || 0);
    const width = Number(product.width || 0);
    const height = Number(product.height || 0);
    const volumetricWeight = length * width * height / 6000;
    const chargeableWeight = Math.max(volumetricWeight, Number(product.grossWeight || 0));
    const firstMileFreightCny =
      item.transportType === 'air'
        ? chargeableWeight * dto.airFreightRate * purchaseQty
        : item.transportType === 'sea'
          ? length * width * height / 1000000 * dto.seaFreightRate * purchaseQty
          : 0;
    const cifCny = totalExclTaxCny + firstMileFreightCny;
    const cifUsd = safeDivide(cifCny, dto.exchangeRateUsd);
    const igiTaxRate = item.isCustomsClearance ? Number(tariff?.taxRate ?? 0) : 0;
    const tariffUsd = cifUsd * igiTaxRate / 100;
    const capitalCostUsd = cifUsd * dto.capitalCostRate / 100 * dto.accountPeriod / 12;
    const customsFeeUsd = item.isCustomsClearance ? cifUsd * dto.customsFeeRate / 100 : 0;
    const enableNom = Boolean(item.enableNom ?? product.needNom ?? tariff?.needNom);
    const nomFeeUsd = enableNom && item.isCustomsClearance ? dto.nomFee : 0;
    const ddpTotalUsd = cifUsd + tariffUsd + capitalCostUsd + customsFeeUsd + nomFeeUsd;
    const ddpUnitPriceUsd = safeDivide(ddpTotalUsd, purchaseQty);
    const manualQuoteUnitUsd = normalizeOptionalNumber(item.ddpQuoteUnitUsd);
    const markupRate = manualQuoteUnitUsd === undefined
      ? Number(item.markupRate ?? dto.markupRate)
      : ddpUnitPriceUsd > 0
        ? (manualQuoteUnitUsd / ddpUnitPriceUsd - 1) * 100
        : 0;
    const ddpQuoteUnitUsd = manualQuoteUnitUsd ?? ddpUnitPriceUsd * (1 + markupRate / 100);
    const revenueUsd = ddpQuoteUnitUsd * purchaseQty;
    const operatingProfitUsd = revenueUsd - ddpTotalUsd;

    return {
      productId: product.id,
      productCode: product.productCode,
      productName: product.name,
      brand: product.brand || '',
      purchaseQty,
      purchasePriceCny,
      totalTaxIncludedCny,
      totalExclTaxCny,
      vatInputCny,
      transportType: item.transportType,
      isCustomsClearance: item.isCustomsClearance,
      firstMileFreightCny,
      cifCny,
      cifUsd,
      igiTaxRate,
      tariffUsd,
      capitalCostUsd,
      customsFeeUsd,
      nomFeeUsd,
      publicFeeAllocationUsd: 0,
      ddpTotalUsd,
      ddpUnitPriceUsd,
      ddpQuoteUnitUsd: manualQuoteUnitUsd,
      revenueUsd,
      operatingProfitUsd,
      grossMarginRate: revenueUsd > 0 ? operatingProfitUsd / revenueUsd * 100 : 0,
      badDebtProvisionUsd: revenueUsd * dto.badDebtRate / 100,
      markupRate,
      enableNom,
    };
  });

  const totalCifUsd = initialItems.reduce((sum, item) => sum + item.cifUsd, 0);
  const items = initialItems.map((item) => {
    const allocation = totalCifUsd > 0 ? publicFeeTotal * item.cifUsd / totalCifUsd : 0;
    const ddpTotalUsd = item.ddpTotalUsd + allocation;
    const ddpUnitPriceUsd = safeDivide(ddpTotalUsd, item.purchaseQty);
    const effectiveQuoteUnitUsd = item.ddpQuoteUnitUsd ?? ddpUnitPriceUsd * (1 + item.markupRate / 100);
    const revenueUsd = effectiveQuoteUnitUsd * item.purchaseQty;
    const operatingProfitUsd = revenueUsd - ddpTotalUsd;
    return roundObject({
      ...item,
      publicFeeAllocationUsd: allocation,
      ddpTotalUsd,
      ddpUnitPriceUsd,
      ddpQuoteUnitUsd: item.ddpQuoteUnitUsd,
      revenueUsd,
      operatingProfitUsd,
      grossMarginRate: revenueUsd > 0 ? operatingProfitUsd / revenueUsd * 100 : 0,
      badDebtProvisionUsd: revenueUsd * dto.badDebtRate / 100,
    });
  });

  const totalDdpUsd = items.reduce((sum, item) => sum + item.ddpTotalUsd, 0);
  const totalRevenueUsd = items.reduce((sum, item) => sum + item.revenueUsd, 0);
  const totalProfitUsd = items.reduce((sum, item) => sum + item.operatingProfitUsd, 0);

  return {
    quotation: roundObject({
      ...quotationParams,
      totalCifUsd,
      totalDdpUsd,
      totalRevenueUsd,
      totalProfitUsd,
      grossMarginRate: totalRevenueUsd > 0 ? totalProfitUsd / totalRevenueUsd * 100 : 0,
    }),
    items,
  };
}

function safeDivide(value: number, divisor: number): number {
  return divisor ? value / divisor : 0;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function roundObject<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, typeof value === 'number' ? Math.round(value * 10_000) / 10_000 : value]),
  ) as T;
}
