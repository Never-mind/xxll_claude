import { Inject, Injectable } from '@nestjs/common';
import { workbookBufferFromSheets, rowsFromExcelBuffer } from '../../common/excel-utils.js';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import type { Customer, PageResult } from '../../../shared/api.interface.js';

type CustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;
const FILE = 'customers.xlsx';

@Injectable()
export class CustomerService {
  constructor(@Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService) {}

  async list(keyword = '', page = 1, pageSize = 10): Promise<PageResult<Customer>> {
    const all = await this.all();
    const q = keyword.trim().toLowerCase();
    const filtered = q
      ? all.filter((item) => [item.name, item.address, item.contactName, item.contactPhone].some((value) => String(value ?? '').toLowerCase().includes(q)))
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

  all(): Promise<Customer[]> {
    return this.storage.readTable<Customer>(FILE);
  }

  async findById(id: string): Promise<Customer | undefined> {
    return (await this.storage.query<Customer>(FILE, { id })).at(0);
  }

  async create(input: CustomerInput): Promise<Customer> {
    if (!input.name?.trim()) throw new Error('Customer name is required');
    return this.storage.insert<Customer>(FILE, input);
  }

  update(id: string, input: Partial<CustomerInput>): Promise<Customer> {
    return this.storage.update<Customer>(FILE, id, input);
  }

  remove(id: string): Promise<void> {
    return this.storage.delete(FILE, id);
  }

  async import(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    const rows = rowsFromExcelBuffer<Partial<CustomerInput>>(buffer);
    const errors: string[] = [];
    let imported = 0;
    for (const [index, row] of rows.entries()) {
      try {
        await this.create(row as CustomerInput);
        imported += 1;
      } catch (error) {
        errors.push(`Row ${index + 2}: ${(error as Error).message}`);
      }
    }
    return { imported, errors };
  }

  async export(): Promise<Buffer> {
    return workbookBufferFromSheets({ customers: await this.all() });
  }
}
