import { Inject, Injectable } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { rowsFromExcelBuffer, workbookBufferFromSheets } from '../../common/excel-utils.js';
import { ProductService } from '../product/product.service.js';
import type { HistoryQuotation, PageResult } from '../../../shared/api.interface.js';

type HistoryInput = Omit<HistoryQuotation, 'id' | 'createdAt' | 'updatedAt'>;
const FILE = 'history_quotations.xlsx';

@Injectable()
export class HistoryQuotationService {
  constructor(
    @Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService,
    @Inject(ProductService) private readonly products: ProductService,
  ) {}

  async list(keyword = '', page = 1, pageSize = 10): Promise<PageResult<HistoryQuotation>> {
    const all = await this.enrichedRows();
    const q = keyword.trim().toLowerCase();
    const filtered = q
      ? all.filter((item) =>
          [item.customerName, item.productCode, item.productName].some((value) => value.toLowerCase().includes(q)),
        )
      : all;
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));
    const safePage = Math.max(1, Number(page) || 1);
    return {
      items: filtered.slice((safePage - 1) * safePageSize, safePage * safePageSize),
      total: filtered.length,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  all(): Promise<HistoryQuotation[]> {
    return this.enrichedRows();
  }

  create(input: HistoryInput): Promise<HistoryQuotation> {
    return this.storage.insert<HistoryQuotation>(FILE, input);
  }

  update(id: string, input: Partial<HistoryInput>): Promise<HistoryQuotation> {
    return this.storage.update<HistoryQuotation>(FILE, id, input);
  }

  remove(id: string): Promise<void> {
    return this.storage.delete(FILE, id);
  }

  async import(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    const rows = rowsFromExcelBuffer<Partial<HistoryInput>>(buffer);
    const errors: string[] = [];
    let imported = 0;
    for (const [index, row] of rows.entries()) {
      try {
        await this.create(row as HistoryInput);
        imported += 1;
      } catch (error) {
        errors.push(`Row ${index + 2}: ${(error as Error).message}`);
      }
    }
    return { imported, errors };
  }

  async export(): Promise<Buffer> {
    return workbookBufferFromSheets({ history_quotations: await this.all() });
  }

  private async enrichedRows(): Promise<HistoryQuotation[]> {
    const [history, products] = await Promise.all([this.storage.readTable<HistoryQuotation>(FILE), this.products.all()]);
    return history.map((item) => {
      const product = products.find((candidate) => candidate.productCode === item.productCode);
      return {
        ...item,
        spec: item.spec || product?.spec,
        brand: item.brand || product?.brand,
      };
    });
  }
}
