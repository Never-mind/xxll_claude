import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { utils, read, write } from 'xlsx';
import type { PageResult } from '../../shared/api.interface.js';

type AnyRecord = object;
type RowRecord = Record<string, unknown>;

@Injectable()
export class ExcelStorageService {
  private readonly dataDir = join(process.cwd(), 'data');
  private readonly queues = new Map<string, Promise<unknown>>();

  async readTable<T extends AnyRecord>(fileName: string): Promise<T[]> {
    return this.withFileLock(fileName, async () => this.readUnlocked<T>(fileName));
  }

  async writeTable<T extends AnyRecord>(fileName: string, data: T[]): Promise<void> {
    await this.withFileLock(fileName, async () => this.writeUnlocked(fileName, data));
  }

  async query<T extends AnyRecord>(fileName: string, where: Partial<T>): Promise<T[]> {
    const rows = await this.readTable<T>(fileName);
    return rows.filter((row) =>
      Object.entries(where).every(([key, value]) => value === undefined || (row as RowRecord)[key] === value),
    );
  }

  async insert<T extends AnyRecord>(fileName: string, record: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<T>): Promise<T> {
    return this.withFileLock(fileName, async () => {
      const rows = await this.readUnlocked<T>(fileName);
      const now = new Date().toISOString();
      const rowRecord = record as RowRecord;
      const next = {
        id: crypto.randomUUID(),
        ...record,
        createdAt: rowRecord.createdAt ?? now,
        updatedAt: now,
      } as unknown as T;
      rows.push(next);
      await this.writeUnlocked(fileName, rows);
      return next;
    });
  }

  async update<T extends AnyRecord>(fileName: string, id: string, data: Partial<T>): Promise<T> {
    return this.withFileLock(fileName, async () => {
      const rows = await this.readUnlocked<T>(fileName);
      const index = rows.findIndex((row) => (row as RowRecord).id === id);
      if (index < 0) throw new Error(`Record ${id} not found in ${fileName}`);
      rows[index] = { ...rows[index], ...data, id, updatedAt: new Date().toISOString() } as unknown as T;
      await this.writeUnlocked(fileName, rows);
      return rows[index];
    });
  }

  async delete(fileName: string, id: string): Promise<void> {
    await this.withFileLock(fileName, async () => {
      const rows = await this.readUnlocked(fileName);
      await this.writeUnlocked(
        fileName,
        rows.filter((row) => (row as RowRecord).id !== id),
      );
    });
  }

  async paginate<T extends AnyRecord>(
    fileName: string,
    page = 1,
    pageSize = 10,
    where?: Partial<T>,
  ): Promise<PageResult<T>> {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));
    const source = where ? await this.query<T>(fileName, where) : await this.readTable<T>(fileName);
    const start = (safePage - 1) * safePageSize;
    return {
      items: source.slice(start, start + safePageSize),
      total: source.length,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  private async readUnlocked<T extends AnyRecord>(fileName: string): Promise<T[]> {
    const filePath = this.pathFor(fileName);
    try {
      const buffer = await readFile(filePath);
      const workbook = read(buffer, { type: 'buffer', cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) return [];
      return utils.sheet_to_json<T>(sheet, { defval: '' }).map((row) => this.normalizeRow(row));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private async writeUnlocked<T extends AnyRecord>(fileName: string, data: T[]): Promise<void> {
    const filePath = this.pathFor(fileName);
    await mkdir(dirname(filePath), { recursive: true });
    const workbook = utils.book_new();
    const sheet = utils.json_to_sheet(data);
    utils.book_append_sheet(workbook, sheet, 'Sheet1');
    await writeFile(filePath, write(workbook, { bookType: 'xlsx', type: 'buffer' }));
  }

  private pathFor(fileName: string): string {
    if (!fileName.endsWith('.xlsx')) throw new Error('Excel file name must end with .xlsx');
    return join(this.dataDir, fileName);
  }

  private async withFileLock<T>(fileName: string, action: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(fileName) ?? Promise.resolve();
    const next = previous.then(action, action);
    this.queues.set(fileName, next.catch(() => undefined));
    return next;
  }

  private normalizeRow<T extends AnyRecord>(row: T): T {
    const normalized = { ...(row as RowRecord) };
    for (const [key, value] of Object.entries(normalized)) {
      if (value === '') normalized[key] = undefined;
      if (value === 'true') normalized[key] = true;
      if (value === 'false') normalized[key] = false;
    }
    return normalized as T;
  }
}
