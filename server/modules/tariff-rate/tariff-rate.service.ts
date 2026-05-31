import { Inject, Injectable } from '@nestjs/common';
import { ExcelStorageService } from '../../common/excel-storage.service.js';
import { rowsFromExcelBuffer, workbookBufferFromSheets } from '../../common/excel-utils.js';
import type { PageResult, TariffRate } from '../../../shared/api.interface.js';

type TariffInput = Omit<TariffRate, 'id' | 'createdAt' | 'updatedAt'>;
const FILE = 'tariff_rates.xlsx';

@Injectable()
export class TariffRateService {
  constructor(@Inject(ExcelStorageService) private readonly storage: ExcelStorageService) {}

  async list(keyword = '', page = 1, pageSize = 10): Promise<PageResult<TariffRate>> {
    const all = await this.all();
    const q = keyword.trim().toLowerCase();
    const filtered = q
      ? all.filter((item) => [item.deviceType, item.hsCode].some((value) => value.toLowerCase().includes(q)))
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

  all(): Promise<TariffRate[]> {
    return this.storage.readTable<TariffRate>(FILE);
  }

  async byHsCode(hsCode: string): Promise<TariffRate | undefined> {
    return (await this.storage.query<TariffRate>(FILE, { hsCode })).at(0);
  }

  async create(input: TariffInput): Promise<TariffRate> {
    const exists = await this.byHsCode(input.hsCode);
    if (exists) throw new Error(`HS code ${input.hsCode} already exists`);
    return this.storage.insert<TariffRate>(FILE, this.normalize(input));
  }

  update(id: string, input: Partial<TariffInput>): Promise<TariffRate> {
    return this.storage.update<TariffRate>(FILE, id, this.normalize(input));
  }

  remove(id: string): Promise<void> {
    return this.storage.delete(FILE, id);
  }

  async import(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    const rows = rowsFromExcelBuffer<Partial<TariffInput>>(buffer);
    const errors: string[] = [];
    let imported = 0;
    for (const [index, row] of rows.entries()) {
      try {
        await this.create(row as TariffInput);
        imported += 1;
      } catch (error) {
        errors.push(`Row ${index + 2}: ${(error as Error).message}`);
      }
    }
    return { imported, errors };
  }

  async export(): Promise<Buffer> {
    return workbookBufferFromSheets({ tariff_rates: await this.all() });
  }

  private normalize<T extends Partial<TariffInput>>(input: T): T {
    return {
      ...input,
      taxRate: Number(input.taxRate ?? 0),
      needNom: Boolean(input.needNom),
    };
  }
}
