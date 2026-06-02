import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import type { PageResult } from '../../shared/api.interface.js';

type AnyRecord = object;
type RowRecord = Record<string, unknown>;

const TABLES: Record<string, string> = {
  'products.xlsx': 'products',
  'customers.xlsx': 'customers',
  'tariff_rates.xlsx': 'tariff_rates',
  'history_quotations.xlsx': 'history_quotations',
  'quotations.xlsx': 'quotations',
  'quotation_items.xlsx': 'quotation_items',
};

const BOOLEAN_FIELDS: Record<string, string[]> = {
  products: ['isMagnetic', 'isElectric', 'needNom'],
  tariff_rates: ['needNom'],
  quotation_items: ['isCustomsClearance', 'enableNom'],
};

@Injectable()
export class DatabaseStorageService {
  private static pool: Pool | undefined;

  static async closePool(): Promise<void> {
    if (!DatabaseStorageService.pool) return;
    await DatabaseStorageService.pool.end();
    DatabaseStorageService.pool = undefined;
  }

  async readTable<T extends AnyRecord>(fileName: string): Promise<T[]> {
    const table = tableFor(fileName);
    const [rows] = await this.pool().query<RowDataPacket[]>(`SELECT * FROM ${quoteId(table)} ORDER BY ${quoteId('createdAt')} ASC, ${quoteId('id')} ASC`);
    return rows.map((row) => normalizeRow<T>(table, row as RowRecord));
  }

  async writeTable<T extends AnyRecord>(fileName: string, data: T[]): Promise<void> {
    const table = tableFor(fileName);
    const connection = await this.pool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(`DELETE FROM ${quoteId(table)}`);
      for (const row of data) {
        await this.insertIntoTable(table, row as RowRecord, connection);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async query<T extends AnyRecord>(fileName: string, where: Partial<T>): Promise<T[]> {
    const table = tableFor(fileName);
    const entries = Object.entries(where as RowRecord).filter(([, value]) => value !== undefined);
    const params = entries.map(([, value]) => toDbValue(value));
    const clause = entries.length
      ? `WHERE ${entries.map(([key]) => `${quoteId(key)} = ?`).join(' AND ')}`
      : '';
    const [rows] = await this.pool().query<RowDataPacket[]>(
      `SELECT * FROM ${quoteId(table)} ${clause} ORDER BY ${quoteId('createdAt')} ASC, ${quoteId('id')} ASC`,
      params,
    );
    return rows.map((row) => normalizeRow<T>(table, row as RowRecord));
  }

  async insert<T extends AnyRecord>(fileName: string, record: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<T>): Promise<T> {
    const table = tableFor(fileName);
    const now = new Date().toISOString();
    const row = {
      id: (record as RowRecord).id ?? randomUUID(),
      ...record,
      createdAt: (record as RowRecord).createdAt ?? now,
      updatedAt: now,
    } as RowRecord;
    await this.insertIntoTable(table, row);
    return normalizeRow<T>(table, row);
  }

  async update<T extends AnyRecord>(fileName: string, id: string, data: Partial<T>): Promise<T> {
    const table = tableFor(fileName);
    const patch = { ...(data as RowRecord), updatedAt: new Date().toISOString() };
    const entries = Object.entries(patch).filter(([key, value]) => key !== 'id' && value !== undefined);
    if (!entries.length) {
      const existing = (await this.query<T>(fileName, { id } as unknown as Partial<T>)).at(0);
      if (!existing) throw new Error(`Record ${id} not found in ${fileName}`);
      return existing;
    }
    await this.pool().query(
      `UPDATE ${quoteId(table)} SET ${entries.map(([key]) => `${quoteId(key)} = ?`).join(', ')} WHERE ${quoteId('id')} = ?`,
      [...entries.map(([, value]) => toDbValue(value)), id],
    );
    const updated = (await this.query<T>(fileName, { id } as unknown as Partial<T>)).at(0);
    if (!updated) throw new Error(`Record ${id} not found in ${fileName}`);
    return updated;
  }

  async delete(fileName: string, id: string): Promise<void> {
    const table = tableFor(fileName);
    await this.pool().query(`DELETE FROM ${quoteId(table)} WHERE ${quoteId('id')} = ?`, [id]);
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

  private pool(): Pool {
    if (!DatabaseStorageService.pool) {
      DatabaseStorageService.pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'quotation',
        waitForConnections: true,
        connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
        decimalNumbers: true,
        dateStrings: true,
        ssl: process.env.DB_SSL === 'true' ? {} : undefined,
      });
    }
    return DatabaseStorageService.pool;
  }

  private async insertIntoTable(table: string, row: RowRecord, executor: Pick<Pool, 'query'> = this.pool()): Promise<void> {
    const entries = Object.entries(row).filter(([, value]) => value !== undefined);
    if (!entries.length) return;
    await executor.query(
      `INSERT INTO ${quoteId(table)} (${entries.map(([key]) => quoteId(key)).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`,
      entries.map(([, value]) => toDbValue(value)),
    );
  }
}

function tableFor(fileName: string): string {
  const table = TABLES[fileName];
  if (!table) throw new Error(`No MySQL table configured for ${fileName}`);
  return table;
}

function quoteId(identifier: string): string {
  return `\`${identifier.replaceAll('`', '``')}\``;
}

function toDbValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function normalizeRow<T extends AnyRecord>(table: string, row: RowRecord): T {
  const normalized = { ...row };
  for (const key of BOOLEAN_FIELDS[table] ?? []) {
    if (key in normalized) normalized[key] = Boolean(normalized[key]);
  }
  return normalized as T;
}
