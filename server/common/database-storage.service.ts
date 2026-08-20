import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import type { PageResult } from '../../shared/api.interface.js';

type AnyRecord = object;
type RowRecord = Record<string, unknown>;

export interface PaginationOptions {
  search?: {
    columns: string[];
    keyword: string;
  };
  orderBy?: Array<{
    column: string;
    direction?: 'ASC' | 'DESC';
  }>;
}

export interface CustomPageQuery<T> {
  countSql: string;
  countParams?: unknown[];
  itemsSql: string;
  itemsParams?: unknown[];
  mapRow?: (row: Record<string, unknown>) => T;
}

const TABLES: Record<string, string> = {
  'products.xlsx': 'products',
  'customers.xlsx': 'customers',
  'customer_bank_accounts.xlsx': 'customer_bank_accounts',
  'customer_contacts.xlsx': 'customer_contacts',
  'customer_attachments.xlsx': 'customer_attachments',
  'suppliers.xlsx': 'suppliers',
  'contracting_entities.xlsx': 'contracting_entities',
  'contracting_entity_bank_accounts.xlsx': 'contracting_entity_bank_accounts',
  'contracting_entity_contacts.xlsx': 'contracting_entity_contacts',
  'contracting_entity_attachments.xlsx': 'contracting_entity_attachments',
  'supplier_bank_accounts.xlsx': 'supplier_bank_accounts',
  'supplier_contacts.xlsx': 'supplier_contacts',
  'supplier_attachments.xlsx': 'supplier_attachments',
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
  'customer_pos.xlsx': 'customer_pos',
  'customer_po_items.xlsx': 'customer_po_items',
  'customer_product_aliases.xlsx': 'customer_product_aliases',
};

const BOOLEAN_FIELDS: Record<string, string[]> = {
  products: ['isMagnetic', 'isElectric', 'needNom'],
  tariff_rates: ['needNom'],
  quotation_items: ['isCustomsClearance', 'enableNom'],
  settlement_items: ['ordered'],
  customer_bank_accounts: ['isDefault'],
  customer_contacts: ['isPrimary'],
  supplier_bank_accounts: ['isDefault'],
  supplier_contacts: ['isPrimary'],
  contracting_entity_bank_accounts: ['isDefault'],
  contracting_entity_contacts: ['isPrimary'],
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
    options: PaginationOptions = {},
  ): Promise<PageResult<T>> {
    await this.ensureSchema();
    const table = tableFor(fileName);
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));
    const exactEntries = Object.entries((where || {}) as RowRecord).filter(([, value]) => value !== undefined);
    const conditions = exactEntries.map(([key]) => `${quoteId(key)} = ?`);
    const params = exactEntries.map(([, value]) => toDbValue(value));
    const keyword = options.search?.keyword.trim();
    const searchColumns = (options.search?.columns || []).filter(isSafeColumn);
    if (keyword && searchColumns.length) {
      conditions.push(`(${searchColumns.map((column) => `${quoteId(column)} LIKE ?`).join(' OR ')})`);
      params.push(...searchColumns.map(() => `%${keyword}%`));
    }
    const clause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = (options.orderBy?.length ? options.orderBy : [
      { column: 'createdAt', direction: 'ASC' },
      { column: 'id', direction: 'ASC' },
    ])
      .filter(({ column }) => isSafeColumn(column))
      .map(({ column, direction }) => `${quoteId(column)} ${direction === 'DESC' ? 'DESC' : 'ASC'}`)
      .join(', ');
    const [countRows] = await this.pool().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM ${quoteId(table)} ${clause}`,
      params,
    );
    const [rows] = await this.pool().query<RowDataPacket[]>(
      `SELECT * FROM ${quoteId(table)} ${clause} ORDER BY ${orderBy || `${quoteId('createdAt')} ASC, ${quoteId('id')} ASC`} LIMIT ? OFFSET ?`,
      [...params, safePageSize, (safePage - 1) * safePageSize],
    );
    return {
      items: rows.map((row) => normalizeRow<T>(table, row as RowRecord)),
      total: Number(countRows[0]?.total || 0),
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async paginateCustom<T>(page = 1, pageSize = 10, query: CustomPageQuery<T>): Promise<PageResult<T>> {
    await this.ensureSchema();
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));
    const [countRows] = await this.pool().query<RowDataPacket[]>(query.countSql, query.countParams || []);
    const [rows] = await this.pool().query<RowDataPacket[]>(
      `${query.itemsSql} LIMIT ? OFFSET ?`,
      [...(query.itemsParams || []), safePageSize, (safePage - 1) * safePageSize],
    );
    return {
      items: rows.map((row) => query.mapRow ? query.mapRow(row as RowRecord) : row as T),
      total: Number(countRows[0]?.total || 0),
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
        connectionLimit: dbConnectionLimit(),
        decimalNumbers: true,
        dateStrings: true,
        ssl: process.env.DB_SSL === 'true' ? {} : undefined,
      });
    }
    return DatabaseStorageService.pool;
  }

  private async ensureSchema(): Promise<void> {
    if (process.env.DB_AUTO_MIGRATE === 'false') return;
    if (!DatabaseStorageService.schemaReady) {
      DatabaseStorageService.schemaReady = this.applySchemaUpdates();
    }
    return DatabaseStorageService.schemaReady;
  }

  private async applySchemaUpdates(): Promise<void> {
    await ensureColumn(this.pool(), 'customers', 'customerCode', 'VARCHAR(100) NULL AFTER `id`');
    await ensureColumn(this.pool(), 'customers', 'taxNumber', 'VARCHAR(100) NULL AFTER `name`');
    await ensureColumn(this.pool(), 'customers', 'nameCn', 'VARCHAR(255) NULL AFTER `name`');
    await ensureColumn(this.pool(), 'customers', 'nameEn', 'VARCHAR(255) NULL AFTER `nameCn`');
    await ensureColumn(this.pool(), 'customers', 'shortName', 'VARCHAR(255) NULL AFTER `nameEn`');
    await this.pool().query("UPDATE `customers` SET `nameCn` = `name` WHERE `nameCn` IS NULL OR `nameCn` = ''");
    await this.pool().query("UPDATE `customers` SET `shortName` = `name` WHERE `shortName` IS NULL OR `shortName` = ''");
    await ensureColumn(this.pool(), 'customers', 'country', 'VARCHAR(100) NULL AFTER `taxNumber`');
    await ensureColumn(this.pool(), 'customers', 'postalCode', 'VARCHAR(50) NULL AFTER `address`');
    await ensureColumn(this.pool(), 'customers', 'contactEmail', 'VARCHAR(255) NULL AFTER `contactPhone`');
    await ensureTable(this.pool(), 'customer_bank_accounts', `
      CREATE TABLE IF NOT EXISTS ${quoteId('customer_bank_accounts')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('customerId')} CHAR(36) NOT NULL,
        ${quoteId('accountName')} VARCHAR(255) NULL,
        ${quoteId('bankName')} VARCHAR(255) NULL,
        ${quoteId('bankAccount')} VARCHAR(255) NULL,
        ${quoteId('bankRoutingNumber')} VARCHAR(100) NULL,
        ${quoteId('swiftCode')} VARCHAR(100) NULL,
        ${quoteId('currency')} VARCHAR(20) NOT NULL DEFAULT 'USD',
        ${quoteId('otherCurrency')} VARCHAR(50) NULL,
        ${quoteId('bankAddress')} TEXT NULL,
        ${quoteId('sortOrder')} INT NOT NULL DEFAULT 1,
        ${quoteId('isDefault')} TINYINT(1) NOT NULL DEFAULT 0,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_customer_bank_accounts_customer')} (${quoteId('customerId')}, ${quoteId('sortOrder')})
      )
    `);
    await ensureColumn(this.pool(), 'customer_bank_accounts', 'accountName', 'VARCHAR(255) NULL AFTER `customerId`');
    await ensureTable(this.pool(), 'customer_contacts', `
      CREATE TABLE IF NOT EXISTS ${quoteId('customer_contacts')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('customerId')} CHAR(36) NOT NULL,
        ${quoteId('name')} VARCHAR(255) NULL,
        ${quoteId('phone')} VARCHAR(100) NULL,
        ${quoteId('email')} VARCHAR(255) NULL,
        ${quoteId('sortOrder')} INT NOT NULL DEFAULT 1,
        ${quoteId('isPrimary')} TINYINT(1) NOT NULL DEFAULT 0,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_customer_contacts_customer')} (${quoteId('customerId')}, ${quoteId('sortOrder')})
      )
    `);
    await ensureTable(this.pool(), 'customer_attachments', `
      CREATE TABLE IF NOT EXISTS ${quoteId('customer_attachments')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('customerId')} CHAR(36) NOT NULL,
        ${quoteId('fileName')} VARCHAR(255) NOT NULL,
        ${quoteId('fileType')} VARCHAR(120) NULL,
        ${quoteId('fileSize')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('dataUrl')} LONGTEXT NOT NULL,
        ${quoteId('uploadedAt')} VARCHAR(32) NOT NULL,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_customer_attachments_customer')} (${quoteId('customerId')}, ${quoteId('uploadedAt')})
      )
    `);
    await ensureTable(this.pool(), 'suppliers', `
      CREATE TABLE IF NOT EXISTS ${quoteId('suppliers')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('supplierCode')} VARCHAR(100) NOT NULL,
        ${quoteId('nameCn')} VARCHAR(255) NOT NULL,
        ${quoteId('nameEn')} VARCHAR(255) NULL,
        ${quoteId('shortName')} VARCHAR(255) NULL,
        ${quoteId('country')} VARCHAR(100) NULL,
        ${quoteId('city')} VARCHAR(100) NULL,
        ${quoteId('registeredAddress')} TEXT NULL,
        ${quoteId('taxNumber')} VARCHAR(100) NULL,
        ${quoteId('supplierType')} VARCHAR(30) NOT NULL DEFAULT 'third_party',
        ${quoteId('supplyCategories')} TEXT NULL,
        ${quoteId('brands')} TEXT NULL,
        ${quoteId('cooperationStatus')} VARCHAR(30) NOT NULL DEFAULT 'not_cooperated',
        ${quoteId('website')} VARCHAR(500) NULL,
        ${quoteId('remark')} TEXT NULL,
        ${quoteId('contactName')} VARCHAR(255) NULL,
        ${quoteId('contactPhone')} VARCHAR(100) NULL,
        ${quoteId('contactEmail')} VARCHAR(255) NULL,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        UNIQUE KEY ${quoteId('uniq_suppliers_supplier_code')} (${quoteId('supplierCode')}),
        UNIQUE KEY ${quoteId('uniq_suppliers_name_cn')} (${quoteId('nameCn')}),
        INDEX ${quoteId('idx_suppliers_keyword')} (${quoteId('supplierCode')}, ${quoteId('nameCn')}, ${quoteId('shortName')}, ${quoteId('country')}),
        INDEX ${quoteId('idx_suppliers_status')} (${quoteId('cooperationStatus')})
      )
    `);
    await ensureTable(this.pool(), 'supplier_bank_accounts', `
      CREATE TABLE IF NOT EXISTS ${quoteId('supplier_bank_accounts')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('supplierId')} CHAR(36) NOT NULL,
        ${quoteId('accountName')} VARCHAR(255) NULL,
        ${quoteId('bankName')} VARCHAR(255) NULL,
        ${quoteId('bankAccount')} VARCHAR(255) NULL,
        ${quoteId('bankRoutingNumber')} VARCHAR(100) NULL,
        ${quoteId('swiftCode')} VARCHAR(100) NULL,
        ${quoteId('currency')} VARCHAR(50) NOT NULL DEFAULT 'USD',
        ${quoteId('bankAddress')} TEXT NULL,
        ${quoteId('sortOrder')} INT NOT NULL DEFAULT 1,
        ${quoteId('isDefault')} TINYINT(1) NOT NULL DEFAULT 0,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_supplier_bank_accounts_supplier')} (${quoteId('supplierId')}, ${quoteId('sortOrder')})
      )
    `);
    await ensureTable(this.pool(), 'supplier_contacts', `
      CREATE TABLE IF NOT EXISTS ${quoteId('supplier_contacts')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('supplierId')} CHAR(36) NOT NULL,
        ${quoteId('name')} VARCHAR(255) NULL,
        ${quoteId('title')} VARCHAR(255) NULL,
        ${quoteId('phone')} VARCHAR(100) NULL,
        ${quoteId('email')} VARCHAR(255) NULL,
        ${quoteId('sortOrder')} INT NOT NULL DEFAULT 1,
        ${quoteId('isPrimary')} TINYINT(1) NOT NULL DEFAULT 0,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_supplier_contacts_supplier')} (${quoteId('supplierId')}, ${quoteId('sortOrder')})
      )
    `);
    await ensureTable(this.pool(), 'supplier_attachments', `
      CREATE TABLE IF NOT EXISTS ${quoteId('supplier_attachments')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('supplierId')} CHAR(36) NOT NULL,
        ${quoteId('fileName')} VARCHAR(255) NOT NULL,
        ${quoteId('fileType')} VARCHAR(120) NULL,
        ${quoteId('fileSize')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('dataUrl')} LONGTEXT NOT NULL,
        ${quoteId('uploadedAt')} VARCHAR(32) NOT NULL,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_supplier_attachments_supplier')} (${quoteId('supplierId')}, ${quoteId('uploadedAt')})
      )
    `);
    await ensureTable(this.pool(), 'contracting_entities', `
      CREATE TABLE IF NOT EXISTS ${quoteId('contracting_entities')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('entityCode')} VARCHAR(100) NOT NULL,
        ${quoteId('entityName')} VARCHAR(255) NOT NULL,
        ${quoteId('nameCn')} VARCHAR(255) NULL,
        ${quoteId('nameEn')} VARCHAR(255) NULL,
        ${quoteId('shortName')} VARCHAR(255) NULL,
        ${quoteId('taxNumber')} VARCHAR(100) NULL,
        ${quoteId('country')} VARCHAR(100) NULL,
        ${quoteId('city')} VARCHAR(100) NULL,
        ${quoteId('registeredAddress')} TEXT NULL,
        ${quoteId('address')} TEXT NULL,
        ${quoteId('remark')} TEXT NULL,
        ${quoteId('bankAccount')} VARCHAR(255) NULL,
        ${quoteId('contactName')} VARCHAR(255) NULL,
        ${quoteId('contactPhone')} VARCHAR(100) NULL,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        UNIQUE KEY ${quoteId('uniq_contracting_entities_code')} (${quoteId('entityCode')}),
        UNIQUE KEY ${quoteId('uniq_contracting_entities_name')} (${quoteId('entityName')})
      )
    `);
    await ensureColumn(this.pool(), 'contracting_entities', 'nameCn', 'VARCHAR(255) NULL AFTER `entityName`');
    await ensureColumn(this.pool(), 'contracting_entities', 'nameEn', 'VARCHAR(255) NULL AFTER `nameCn`');
    await ensureColumn(this.pool(), 'contracting_entities', 'shortName', 'VARCHAR(255) NULL AFTER `nameEn`');
    await ensureColumn(this.pool(), 'contracting_entities', 'country', 'VARCHAR(100) NULL AFTER `taxNumber`');
    await ensureColumn(this.pool(), 'contracting_entities', 'city', 'VARCHAR(100) NULL AFTER `country`');
    await ensureColumn(this.pool(), 'contracting_entities', 'registeredAddress', 'TEXT NULL AFTER `city`');
    await ensureColumn(this.pool(), 'contracting_entities', 'remark', 'TEXT NULL AFTER `registeredAddress`');
    await this.pool().query("UPDATE `contracting_entities` SET `nameCn` = `entityName` WHERE `nameCn` IS NULL OR `nameCn` = ''");
    await this.pool().query("UPDATE `contracting_entities` SET `shortName` = `entityName` WHERE `shortName` IS NULL OR `shortName` = ''");
    await dropIndex(this.pool(), 'contracting_entities', 'idx_contracting_entities_status');
    for (const column of ['entityType', 'supplyCategories', 'brands', 'cooperationStatus', 'website', 'status']) {
      await dropColumn(this.pool(), 'contracting_entities', column);
    }
    await ensureTable(this.pool(), 'contracting_entity_bank_accounts', `
      CREATE TABLE IF NOT EXISTS ${quoteId('contracting_entity_bank_accounts')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('entityId')} CHAR(36) NOT NULL,
        ${quoteId('accountName')} VARCHAR(255) NULL,
        ${quoteId('bankName')} VARCHAR(255) NULL,
        ${quoteId('bankAccount')} VARCHAR(255) NULL,
        ${quoteId('bankRoutingNumber')} VARCHAR(100) NULL,
        ${quoteId('swiftCode')} VARCHAR(100) NULL,
        ${quoteId('currency')} VARCHAR(50) NULL,
        ${quoteId('bankAddress')} TEXT NULL,
        ${quoteId('sortOrder')} INT NOT NULL DEFAULT 1,
        ${quoteId('isDefault')} TINYINT(1) NOT NULL DEFAULT 0,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_contracting_entity_bank_accounts_entity')} (${quoteId('entityId')}, ${quoteId('sortOrder')})
      )
    `);
    await ensureTable(this.pool(), 'contracting_entity_contacts', `
      CREATE TABLE IF NOT EXISTS ${quoteId('contracting_entity_contacts')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('entityId')} CHAR(36) NOT NULL,
        ${quoteId('name')} VARCHAR(255) NULL,
        ${quoteId('title')} VARCHAR(255) NULL,
        ${quoteId('phone')} VARCHAR(100) NULL,
        ${quoteId('email')} VARCHAR(255) NULL,
        ${quoteId('sortOrder')} INT NOT NULL DEFAULT 1,
        ${quoteId('isPrimary')} TINYINT(1) NOT NULL DEFAULT 0,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_contracting_entity_contacts_entity')} (${quoteId('entityId')}, ${quoteId('sortOrder')})
      )
    `);
    await ensureTable(this.pool(), 'contracting_entity_attachments', `
      CREATE TABLE IF NOT EXISTS ${quoteId('contracting_entity_attachments')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('entityId')} CHAR(36) NOT NULL,
        ${quoteId('fileName')} VARCHAR(255) NOT NULL,
        ${quoteId('fileType')} VARCHAR(120) NULL,
        ${quoteId('fileSize')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('dataUrl')} LONGTEXT NOT NULL,
        ${quoteId('uploadedAt')} VARCHAR(32) NOT NULL,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_contracting_entity_attachments_entity')} (${quoteId('entityId')}, ${quoteId('uploadedAt')})
      )
    `);
    await ensureColumn(this.pool(), 'quotation_items', 'ddpQuoteUnitUsd', 'DECIMAL(14,4) NULL AFTER `ddpUnitPriceUsd`');
    await ensureColumn(this.pool(), 'quotation_items', 'brand', 'VARCHAR(255) NULL AFTER `productName`');
    await ensureColumn(this.pool(), 'quotation_items', 'purchaseCurrency', "VARCHAR(10) NOT NULL DEFAULT 'CNY' AFTER `purchaseQty`");
    await ensureColumn(this.pool(), 'quotation_items', 'purchaseUnitPrice', 'DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER `purchaseCurrency`');
    await ensureColumn(this.pool(), 'quotation_items', 'purchaseTotalOriginal', 'DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER `purchaseUnitPrice`');
    await ensureColumn(this.pool(), 'quotation_items', 'purchaseTotalUsd', 'DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER `purchaseTotalOriginal`');
    await ensureColumn(this.pool(), 'quotation_items', 'firstMileFreightUsd', 'DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER `isCustomsClearance`');
    await ensureColumn(this.pool(), 'settlement_projects', 'projectNo', 'VARCHAR(100) NULL AFTER `id`');
    await ensureColumn(this.pool(), 'quotations', 'contractingEntityId', 'CHAR(36) NULL AFTER `customerName`');
    await ensureColumn(this.pool(), 'quotations', 'contractingEntityName', 'VARCHAR(255) NULL AFTER `contractingEntityId`');
    await ensureColumn(this.pool(), 'settlement_projects', 'contractingEntityId', 'CHAR(36) NULL AFTER `customerName`');
    await ensureColumn(this.pool(), 'settlement_projects', 'contractingEntityName', 'VARCHAR(255) NULL AFTER `contractingEntityId`');
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
    await ensureColumn(this.pool(), 'settlement_invoices', 'companyEntity', 'VARCHAR(255) NULL AFTER `accountPeriod`');
    await ensureColumn(this.pool(), 'settlement_invoices', 'accountingDate', 'VARCHAR(32) NULL AFTER `accountPeriod`');
    await ensureTable(this.pool(), 'settlement_invoices', `
      CREATE TABLE IF NOT EXISTS ${quoteId('settlement_invoices')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('projectId')} CHAR(36) NOT NULL,
        ${quoteId('type')} VARCHAR(20) NOT NULL DEFAULT 'cost',
        ${quoteId('accountPeriod')} VARCHAR(100) NULL,
        ${quoteId('companyEntity')} VARCHAR(255) NULL,
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
    await ensureTable(this.pool(), 'customer_pos', `
      CREATE TABLE IF NOT EXISTS ${quoteId('customer_pos')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('poNo')} VARCHAR(100) NOT NULL UNIQUE,
        ${quoteId('customerId')} CHAR(36) NOT NULL,
        ${quoteId('customerName')} VARCHAR(255) NOT NULL,
        ${quoteId('poDate')} VARCHAR(32) NOT NULL,
        ${quoteId('deliveryDate')} VARCHAR(32) NULL,
        ${quoteId('currency')} VARCHAR(10) NOT NULL DEFAULT 'USD',
        ${quoteId('status')} VARCHAR(20) NOT NULL DEFAULT 'draft',
        ${quoteId('remark')} TEXT NULL,
        ${quoteId('quotationId')} CHAR(36) NULL,
        ${quoteId('quotationNo')} VARCHAR(100) NULL,
        ${quoteId('createdBy')} VARCHAR(100) NULL,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_customer_pos_status')} (${quoteId('status')}),
        INDEX ${quoteId('idx_customer_pos_keyword')} (${quoteId('poNo')}, ${quoteId('customerName')})
      )
    `);
    await ensureTable(this.pool(), 'customer_po_items', `
      CREATE TABLE IF NOT EXISTS ${quoteId('customer_po_items')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('poId')} CHAR(36) NOT NULL,
        ${quoteId('lineNo')} INT NOT NULL DEFAULT 1,
        ${quoteId('customerSku')} VARCHAR(100) NULL,
        ${quoteId('customerProductName')} VARCHAR(255) NOT NULL,
        ${quoteId('customerSpec')} VARCHAR(255) NULL,
        ${quoteId('customerBrand')} VARCHAR(255) NULL,
        ${quoteId('unit')} VARCHAR(50) NULL,
        ${quoteId('quantity')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('targetUnitPrice')} DECIMAL(14,4) NOT NULL DEFAULT 0,
        ${quoteId('currency')} VARCHAR(10) NOT NULL DEFAULT 'USD',
        ${quoteId('imageUrl')} TEXT NULL,
        ${quoteId('remark')} TEXT NULL,
        ${quoteId('matchedProductId')} CHAR(36) NULL,
        ${quoteId('matchedProductCode')} VARCHAR(100) NULL,
        ${quoteId('matchedProductName')} VARCHAR(255) NULL,
        ${quoteId('matchStatus')} VARCHAR(20) NOT NULL DEFAULT 'unmatched',
        ${quoteId('matchMethod')} VARCHAR(50) NULL,
        ${quoteId('sourceType')} VARCHAR(20) NOT NULL DEFAULT 'temporary',
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_customer_po_items_po')} (${quoteId('poId')}, ${quoteId('lineNo')}),
        INDEX ${quoteId('idx_customer_po_items_match')} (${quoteId('matchedProductId')})
      )
    `);
    await ensureTable(this.pool(), 'customer_product_aliases', `
      CREATE TABLE IF NOT EXISTS ${quoteId('customer_product_aliases')} (
        ${quoteId('id')} CHAR(36) NOT NULL PRIMARY KEY,
        ${quoteId('customerId')} CHAR(36) NOT NULL,
        ${quoteId('customerName')} VARCHAR(255) NOT NULL,
        ${quoteId('customerSku')} VARCHAR(100) NULL,
        ${quoteId('customerProductName')} VARCHAR(255) NOT NULL,
        ${quoteId('customerSpec')} VARCHAR(255) NULL,
        ${quoteId('customerBrand')} VARCHAR(255) NULL,
        ${quoteId('productId')} CHAR(36) NOT NULL,
        ${quoteId('productCode')} VARCHAR(100) NOT NULL,
        ${quoteId('productName')} VARCHAR(255) NOT NULL,
        ${quoteId('createdAt')} VARCHAR(32) NOT NULL,
        ${quoteId('updatedAt')} VARCHAR(32) NOT NULL,
        INDEX ${quoteId('idx_customer_alias_lookup')} (${quoteId('customerId')}, ${quoteId('customerSku')}, ${quoteId('customerProductName')})
      )
    `);
    await ensureColumn(this.pool(), 'quotations', 'sourceType', "VARCHAR(30) NULL AFTER `remark`");
    await ensureColumn(this.pool(), 'quotations', 'sourcePoId', "CHAR(36) NULL AFTER `sourceType`");
    await ensureColumn(this.pool(), 'quotations', 'sourcePoNo', "VARCHAR(100) NULL AFTER `sourcePoId`");
    await ensureColumn(this.pool(), 'quotation_items', 'sourcePoItemId', "CHAR(36) NULL AFTER `enableNom`");
    await ensureColumn(this.pool(), 'quotation_items', 'sourcePoLineNo', "INT NOT NULL DEFAULT 0 AFTER `sourcePoItemId`");
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

async function dropColumn(pool: Pool, table: string, column: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (Number(rows[0]?.count || 0) === 0) return;
  await pool.query(`ALTER TABLE ${quoteId(table)} DROP COLUMN ${quoteId(column)}`);
}

async function dropIndex(pool: Pool, table: string, index: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index],
  );
  if (Number(rows[0]?.count || 0) === 0) return;
  await pool.query(`ALTER TABLE ${quoteId(table)} DROP INDEX ${quoteId(index)}`);
}

async function ensureTable(pool: Pool, table: string, createSql: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table],
  );
  if (Number(rows[0]?.count || 0) > 0) return;
  await pool.query(createSql);
}

function dbConnectionLimit(): number {
  return Math.max(1, Math.min(Number(process.env.DB_CONNECTION_LIMIT || 1), 2));
}

function tableFor(fileName: string): string {
  const table = TABLES[fileName];
  if (!table) throw new Error(`No MySQL table configured for ${fileName}`);
  return table;
}

function quoteId(identifier: string): string {
  return `\`${identifier.replaceAll('`', '``')}\``;
}

function isSafeColumn(column: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(column);
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
