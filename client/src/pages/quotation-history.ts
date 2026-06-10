import type { HistoryQuotation, Product } from '../api.js';

export function findHistoricalDdpQuoteUsd(
  histories: HistoryQuotation[],
  customerName: string,
  product: Product | undefined | null,
): number | null {
  const normalizedCustomer = customerName.trim();
  if (!normalizedCustomer || !product) return null;

  const matched = histories
    .filter((history) =>
      history.customerName.trim() === normalizedCustomer
      && (history.productCode === product.productCode || history.productName === product.name),
    )
    .sort((left, right) => historyTime(right) - historyTime(left));

  return matched[0]?.customerPriceUsd ?? null;
}

function historyTime(history: HistoryQuotation): number {
  return Date.parse(history.quotationDate || history.createdAt || '') || 0;
}
