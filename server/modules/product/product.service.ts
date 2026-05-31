import { Inject, Injectable } from '@nestjs/common';
import { workbookBufferFromSheets, rowsFromExcelBuffer } from '../../common/excel-utils.js';
import { ExcelStorageService } from '../../common/excel-storage.service.js';
import type { PageResult, Product } from '../../../shared/api.interface.js';

type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
const FILE = 'products.xlsx';

@Injectable()
export class ProductService {
  constructor(@Inject(ExcelStorageService) private readonly storage: ExcelStorageService) {}

  async list(keyword = '', page = 1, pageSize = 10): Promise<PageResult<Product>> {
    const all = await this.storage.readTable<Product>(FILE);
    const normalized = keyword.trim().toLowerCase();
    const filtered = normalized
      ? all.filter((item) =>
          [item.productCode, item.name, item.category].some((value) => String(value ?? '').toLowerCase().includes(normalized)),
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

  async all(): Promise<Product[]> {
    return this.storage.readTable<Product>(FILE);
  }

  async findById(id: string): Promise<Product | undefined> {
    return (await this.storage.query<Product>(FILE, { id })).at(0);
  }

  async findByCode(productCode: string): Promise<Product | undefined> {
    return (await this.storage.query<Product>(FILE, { productCode })).at(0);
  }

  async create(input: ProductInput): Promise<Product> {
    const exists = await this.findByCode(input.productCode);
    if (exists) throw new Error(`Product code ${input.productCode} already exists`);
    return this.storage.insert<Product>(FILE, this.normalize(input));
  }

  async update(id: string, input: Partial<ProductInput>): Promise<Product> {
    return this.storage.update<Product>(FILE, id, this.normalize(input));
  }

  async remove(id: string): Promise<void> {
    await this.storage.delete(FILE, id);
  }

  async import(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    const rows = rowsFromExcelBuffer<Partial<ProductInput>>(buffer);
    const errors: string[] = [];
    let imported = 0;
    for (const [index, row] of rows.entries()) {
      try {
        await this.create(row as ProductInput);
        imported += 1;
      } catch (error) {
        errors.push(`Row ${index + 2}: ${(error as Error).message}`);
      }
    }
    return { imported, errors };
  }

  async export(): Promise<Buffer> {
    return workbookBufferFromSheets({ products: await this.all() });
  }

  private normalize<T extends Partial<ProductInput>>(input: T): T {
    return {
      ...input,
      unit: input.unit || '个',
      length: Number(input.length ?? 0),
      width: Number(input.width ?? 0),
      height: Number(input.height ?? 0),
      grossWeight: Number(input.grossWeight ?? 0),
      suggestedPrice: Number(input.suggestedPrice ?? 0),
      isMagnetic: Boolean(input.isMagnetic),
      isElectric: Boolean(input.isElectric),
      needNom: Boolean(input.needNom),
    };
  }
}
