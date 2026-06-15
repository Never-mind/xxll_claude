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
  'settlement_projects.xlsx': 'settlement_projects',
  'settlement_items.xlsx': 'settlement_items',
  'settlement_expenses.xlsx': 'settlement_expenses',
  'settlement_sales.xlsx': 'settlement_sales',
  'settlement_invoices.xlsx': 'settlement_invoices',
  'settlement_attachments.xlsx': 'settlement_attachments',
};

const BOOLEAN_FIELDS: Record<string, string[]> = {
  products: ['isMagnetic', 'isElectric', 'needNom'],
  tariff_rates: ['needNom'],
  quotation_items: ['isCustomsClearance', 'enableNom'],
  settlement_items: ['ordered'],
};

@Injectable()
export class DatabaseStorageService {
  private static pool: Pool | undefined;
  private static schemaReady: Promise<void> | undefined;

  static async closePool(): Promise<void> {
    if (!DatabaseStorageService.pool) return;
    await DatabaseStorageService.pool.end();
    DatabaseStorageService.pool = undefined;
  }

  async readTable<T extends AnyRecord>(fileName: string): Promise<T[]> {
    await this.ensureSchema();
    const table = tableFor(fileName);
    const [rows] = await this.pool().query<RowDataPacket[]>(`SELECT * FROM ${quoteId(table)} ORDER BY ${quoteId('createdAt')} ASC, ${quoteId('id')} ASC`);
    return rows.map((row) => normalizeRow<T>(table, row as RowRecord));
  }

  async writeTable<T extends AnyRecord>(fileName: string, data: T[]): Promise<void> {
    await this.ensureSchema();
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
    await this.ensureSchema();
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
    await this.ensureSchema();
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
    await this.ensureSchema();
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

  private async ensureSchema(): Promise<void> {
    if (!DatabaseStorageService.schemaReady) {
      DatabaseStorageService.schemaReady = this.applySchemaUpdates();
    }
    return DatabaseStorageService.schemaReady;
  }

  private async applySchemaUpdates(): Promise<void> {
    await ensureColumn(this.pool(), 'quotation_items', 'ddpQuoteUnitUsd', 'DECIMAL(14,4) NULL AFTER `ddpUnitPriceUsd`');
    await ensureColumn(this.pool(), 'quotation_items', 'brand', 'VARCHAR(255) NULL AFTER `productName`');
    await ensureColumn(this.pool(), 'quotation_items', 'purchaseCurrency', "VARCHAR(10) NOT NULL DEFAULT 'CNY' AFTER `purchaseQty`");
    await ensureColumn(this.pool(), 'quotation_items', 'purchaseUnitPrice', 'DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER `purchaseCurrency`');
    await ensureColumn(this.pool(), 'quotation_items', 'purchaseTotalOriginal', 'DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER `purchaseUnitPrice`');
    await ensureColumn(this.pool(), 'quotation_items', 'purchaseTotalUsd', 'DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER `purchaseTotalOriginal`');
    await ensureColumn(this.pool(), 'quotation_items', 'firstMileFreightUsd', 'DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER `isCustomsClearance`');
    await ensureColumn(this.pool(), 'settlement_items', 'brand', 'VARCHAR(255) NULL AFTER `productName`');
    await ensureColumn(this.pool(), 'settlement_items', 'invoiceNo', 'VARCHAR(100) NULL AFTER `receivedRevenueUsd`');
    await ensureColumn(this.pool(), 'settlement_items', 'invoiceEntity', 'VARCHAR(255) NULL AFTER `receivedRevenueUsd`');
    await ensureColumn(this.pool(), 'settlement_items', 'invoiceDate', 'VARCHAR(32) NULL AFTER `invoiceEntity`');
    await ensureColumn(this.pool(), 'settlement_items', 'invoiceExchangeRate', 'DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER `invoiceDate`');
    await ensureColumn(this.pool(), 'settlement_expenses', 'invoiceNo', 'VARCHAR(100) NULL AFTER `costUsd`');
    await ensureColumn(this.pool(), 'settlement_expenses', 'invoiceEntity', 'VARCHAR(255) NULL AFTER `costUsd`');
    await ensureColumn(this.pool(), 'settlement_expenses', 'invoiceDate', 'VARCHAR(32) NULL AFTER `invoiceEntity`');
    await ensureColumn(this.pool(), 'settlement_expenses', 'invoiceExchangeRate', 'DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER `invoiceDate`');
    await ensureColumn(this.pool(), 'settlement_sales', 'invoiceNo', 'VARCHAR(100) NULL AFTER `receivedRevenueUsd`');
    await ensureColumn(this.pool(), 'settlement_sales', 'invoiceEntity', 'VARCHAR(255) NULL AFTER `receivedRevenueUsd`');
    await ensureColumn(this.pool(), 'settlement_sales', 'invoiceDate', 'VARCHAR(32) NULL AFTER `invoiceEntity`');
    await ensureColumn(this.pool(), 'settlement_sales', 'invoiceExchangeRate', 'DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER `invoiceDate`');
    await ensureColumn(this.pool(), 'settlement_invoices', 'isPaid', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER `usdAmount`');
    await ensureTable(this.pool(), 'settlement_invoices', `
      CREATE TABLE IF NOT EXISTS ${quoteId('settlement_invoices')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('projectId')} CHAR(36) NOT NULL,
        ${quoteId('type')} VARCHAR(20) NOT NULL DEFAULT 'cost',
        ${quoteId('accountPeriod')} VARCHAR(100) NULL,
        ${quoteId('invoiceEntity')} VARCHAR(255) NULL,
        ${quoteId('invoiceDate')} VARCHAR(32) NULL,
        ${quoteId('invoiceNo')} VARCHAR(100) NULL,
        ${quoteId('invoiceTotal')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('invoiceTaxExcludedTotal')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('taxRate')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('invoiceTaxAmount')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('currency')} VARCHAR(10) NOT NULL DEFAULT 'CNY',
        ${quoteId('exchangeRate')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('usdAmount')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('isPaid')} TINYINT(1) NOT NULL DEFAULT 0,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_settlement_invoices_project')} (${quoteId('projectId')})
      )
    `);
    await ensureTable(this.pool(), 'settlement_attachments', `
      CREATE TABLE IF NOT EXISTS ${quoteId('settlement_attachments')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('projectId')} CHAR(36) NOT NULL,
        ${quoteId('fileName')} VARCHAR(255) NOT NULL,
        ${quoteId('fileType')} VARCHAR(120) NULL,
        ${quoteId('fileSize')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('dataUrl')} LONGTEXT NOT NULL,
        ${quoteId('description')} VARCHAR(255) NULL,
        ${quoteId('uploadedAt')} VARCHAR(32) NOT NULL,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_settlement_attachments_project')} (${quoteId('projectId')})
      )
    `);
  }

  private async insertIntoTable(table: string, row: RowRecord, executor: Pick<Pool, 'query'> = this.pool()): Promise<void> {
    await this.ensureSchema();
    const entries = Object.entries(row).filter(([, value]) => value !== undefined);
    if (!entries.length) return;
    await executor.query(
      `INSERT INTO ${quoteId(table)} (${entries.map(([key]) => quoteId(key)).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`,
      entries.map(([, value]) => toDbValue(value)),
    );
  }
}

async function ensureColumn(pool: Pool, table: string, column: string, definition: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (Number(rows[0]?.count || 0) > 0) return;
  await pool.query(`ALTER TABLE ${quoteId(table)} ADD COLUMN ${quoteId(column)} ${definition}`);
}

async function ensureTable(pool: Pool, table: string, createSql: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table],
  );
  if (Number(rows[0]?.count || 0) > 0) return;
  await pool.query(createSql);
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
