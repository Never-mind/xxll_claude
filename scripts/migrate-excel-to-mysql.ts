import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { DatabaseStorageService } from '../server/common/database-storage.service.js';
import { ExcelStorageService } from '../server/common/excel-storage.service.js';
import type { HistoryQuotation, Product, Quotation, QuotationItem, TariffRate } from '../shared/api.interface.js';

type Row = Record<string, unknown>;

const excel = new ExcelStorageService();
const database = new DatabaseStorageService();

async function main() {
  const products = withMetadata(await excel.readTable<Product>('products.xlsx'));
  const tariffRates = withMetadata(await excel.readTable<TariffRate>('tariff_rates.xlsx'));
  const history = withMetadata(await excel.readTable<HistoryQuotation>('history_quotations.xlsx'));
  const quotations = withMetadata(await excel.readTable<Quotation>('quotations.xlsx'));
  const quotationItems = withMetadata(await excel.readTable<QuotationItem>('quotation_items.xlsx'));

  await database.writeTable('products.xlsx', products);
  await database.writeTable('tariff_rates.xlsx', tariffRates);
  await database.writeTable('history_quotations.xlsx', history);
  await database.writeTable('quotations.xlsx', quotations);
  await database.writeTable('quotation_items.xlsx', quotationItems);

  console.log(`Migrated ${products.length} products`);
  console.log(`Migrated ${tariffRates.length} tariff rates`);
  console.log(`Migrated ${history.length} history quotation rows`);
  console.log(`Migrated ${quotations.length} quotations`);
  console.log(`Migrated ${quotationItems.length} quotation items`);
}

function withMetadata<T extends object>(rows: T[]): T[] {
  return rows.map((row) => {
    const record = row as Row;
    const now = new Date().toISOString();
    return {
      ...record,
      id: record.id || randomUUID(),
      createdAt: record.createdAt || now,
      updatedAt: record.updatedAt || now,
    } as T;
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await DatabaseStorageService.closePool();
});
