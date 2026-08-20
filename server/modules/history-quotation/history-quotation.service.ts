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
    const pageResult = await this.storage.paginate<HistoryQuotation>(FILE, page, pageSize, undefined, {
      search: { keyword, columns: ['customerName', 'productCode', 'productName'] },
      orderBy: [{ column: 'quotationDate', direction: 'DESC' }, { column: 'createdAt', direction: 'DESC' }],
    });
    const items = await Promise.all(pageResult.items.map(async (item) => {
      const product = await this.products.findByCode(item.productCode);
      return {
        ...item,
        spec: item.spec || product?.spec,
        brand: item.brand || product?.brand,
      };
    }));
    return {
      ...pageResult,
      items,
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
    const rows = (await this.all()).map((history) => ({
      报价日期: history.quotationDate,
      客户名称: history.customerName,
      产品编码: history.productCode,
      产品名称: history.productName,
      规格: history.spec || '',
      品牌: history.brand || '',
      运输方式: history.transportType,
      '客户报价(USD)': history.customerPriceUsd,
    }));
    return workbookBufferFromSheets({ 历史报价: rows });
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
