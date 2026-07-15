import 'reflect-metadata';
import 'dotenv/config';
import express, { json, urlencoded } from 'express';
import mysql from 'mysql2/promise';
import serverless from 'serverless-http';
import type { Handler } from 'serverless-http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../server/app.module.js';
import { calculateQuotation } from '../server/modules/quotation/quotation-calculator.js';
import { customerPoToQuotationDraft } from '../shared/customer-po.js';
import { formalQuotationInputFromSaved, writeFormalQuotationWorkbook } from '../shared/formal-quotation-export.js';

let cachedHandler: Handler | undefined;
let lightweightPool: mysql.Pool | undefined;
let customerPoSchemaReady: Promise<void> | undefined;

async function createHandler(): Promise<Handler> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bodyParser: false });
  app.use(json({ limit: process.env.JSON_BODY_LIMIT || '25mb' }));
  app.use(urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '25mb' }));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true });
  await app.init();
  return serverless(expressApp);
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const requestPath = getApiPath(request);
  if (requestPath === '/api/auth/login' && request.method === 'POST') {
    return loginHandler(request, response);
  }
  if (requestPath === '/api/health/db' && request.method === 'GET') {
    return dbHealthHandler(response);
  }
  if (request.method === 'GET' && await lightweightGetHandler(request, response)) {
    return;
  }
  if ((request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') && await lightweightWriteHandler(request, response)) {
    return;
  }
  if (request.method === 'DELETE' && await lightweightDeleteHandler(request, response)) {
    return;
  }
  cachedHandler ??= await createHandler();
  return cachedHandler(request, response);
}

async function lightweightWriteHandler(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = getRequestUrl(request);
  try {
    const quotationConfirmMatch = url.pathname.match(/^\/api\/quotations\/([^/]+)\/confirm$/);
    if (request.method === 'POST' && quotationConfirmMatch) {
      await sendJson(response, await confirmQuotation(quotationConfirmMatch[1]));
      return true;
    }
    if (url.pathname === '/api/quotations' && request.method === 'POST') {
      await sendJson(response, await saveQuotation(await readJsonBody(request)));
      return true;
    }
    if (url.pathname === '/api/customer-pos' && request.method === 'POST') {
      await sendJson(response, await saveCustomerPo(await readJsonBody(request)));
      return true;
    }
    const customerPoActionMatch = url.pathname.match(/^\/api\/customer-pos\/([^/]+)\/generate-quotation$/);
    if (customerPoActionMatch && request.method === 'POST') {
      await sendJson(response, await generateQuotationFromCustomerPo(customerPoActionMatch[1]));
      return true;
    }
    const customerPoUpdateMatch = url.pathname.match(/^\/api\/customer-pos\/([^/]+)$/);
    if (customerPoUpdateMatch && request.method === 'PUT') {
      await sendJson(response, await saveCustomerPo(await readJsonBody(request), customerPoUpdateMatch[1]));
      return true;
    }
    const quotationUpdateMatch = url.pathname.match(/^\/api\/quotations\/([^/]+)$/);
    if (quotationUpdateMatch && request.method === 'PUT') {
      await sendJson(response, await saveQuotation(await readJsonBody(request), quotationUpdateMatch[1]));
      return true;
    }
    const settlementActionMatch = url.pathname.match(/^\/api\/settlement-projects\/([^/]+)\/(order|expenses|sales|invoices|attachments|complete)$/);
    if (settlementActionMatch && request.method === 'POST') {
      const [, projectId, action] = settlementActionMatch;
      await sendJson(response, await handleSettlementPost(projectId, action, await readJsonBody(request)));
      return true;
    }
    const attachmentChunkMatch = url.pathname.match(/^\/api\/settlement-projects\/([^/]+)\/attachments\/([^/]+)\/chunk$/);
    if (attachmentChunkMatch && request.method === 'PUT') {
      const [, projectId, attachmentId] = attachmentChunkMatch;
      await sendJson(response, await appendAttachmentChunk(projectId, attachmentId, await readJsonBody(request)));
      return true;
    }
    const settlementChildMatch = url.pathname.match(/^\/api\/settlement-projects\/([^/]+)\/(items|expenses|sales|invoices|attachments)\/([^/]+)(?:\/order)?$/);
    if (settlementChildMatch && (request.method === 'PUT' || request.method === 'DELETE')) {
      const [, projectId, resource, childId] = settlementChildMatch;
      await sendJson(response, await handleSettlementChildWrite(projectId, resource, childId, request.method, await readJsonBody(request), url.pathname.endsWith('/order')));
      return true;
    }
    const simpleMatch = url.pathname.match(/^\/api\/([^/]+)(?:\/([^/]+))?$/);
    const tableByResource: Record<string, string> = {
      products: 'products',
      customers: 'customers',
      'tariff-rates': 'tariff_rates',
      'history-quotations': 'history_quotations',
    };
    if (simpleMatch) {
      const [, resource, id] = simpleMatch;
      const table = tableByResource[resource];
      if (table && request.method === 'POST' && !id) {
        await sendJson(response, await insertRecord(table, await readJsonBody(request)));
        return true;
      }
      if (table && request.method === 'PUT' && id) {
        await sendJson(response, await updateRecord(table, id, await readJsonBody(request)));
        return true;
      }
    }
  } catch (error) {
    await sendJson(response, { message: (error as Error).message }, 500);
    return true;
  }
  return false;
}

async function lightweightDeleteHandler(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = getRequestUrl(request);
  const match = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)$/);
  if (!match) return false;
  const [, resource, id] = match;
  const tableByResource: Record<string, string> = {
    products: 'products',
    customers: 'customers',
    'tariff-rates': 'tariff_rates',
    'history-quotations': 'history_quotations',
  };
  try {
    if (resource === 'quotations') {
      await executeInTransaction([
        ['DELETE FROM `quotation_items` WHERE `quotationId` = ?', [id]],
        ['DELETE FROM `quotations` WHERE `id` = ?', [id]],
      ]);
      await sendJson(response, {});
      return true;
    }
    if (resource === 'customer-pos') {
      await executeInTransaction([
        ['DELETE FROM `customer_po_items` WHERE `poId` = ?', [id]],
        ['DELETE FROM `customer_pos` WHERE `id` = ?', [id]],
      ]);
      await sendJson(response, {});
      return true;
    }
    if (resource === 'settlement-projects') {
      await executeInTransaction([
        ['DELETE FROM `settlement_items` WHERE `projectId` = ?', [id]],
        ['DELETE FROM `settlement_expenses` WHERE `projectId` = ?', [id]],
        ['DELETE FROM `settlement_sales` WHERE `projectId` = ?', [id]],
        ['DELETE FROM `settlement_invoices` WHERE `projectId` = ?', [id]],
        ['DELETE FROM `settlement_attachments` WHERE `projectId` = ?', [id]],
        ['DELETE FROM `settlement_projects` WHERE `id` = ?', [id]],
      ]);
      await sendJson(response, {});
      return true;
    }
    const table = tableByResource[resource];
    if (!table) return false;
    await executeRows(`DELETE FROM ${quoteId(table)} WHERE ${quoteId('id')} = ?`, [id]);
    await sendJson(response, {});
    return true;
  } catch (error) {
    await sendJson(response, { message: (error as Error).message }, 500);
    return true;
  }
}

async function lightweightGetHandler(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = getRequestUrl(request);
  const routes: Record<string, () => Promise<unknown>> = {
    '/api/products': () => listTable('products', url, ['productCode', 'name', 'category', 'brand']),
    '/api/customers': () => listTable('customers', url, ['name', 'contactName', 'contactPhone', 'address']),
    '/api/tariff-rates': () => listTable('tariff_rates', url, ['deviceType', 'hsCode']),
    '/api/history-quotations': () => listTable('history_quotations', url, ['customerName', 'productCode', 'productName', 'brand']),
    '/api/quotations': () => listQuotations(url),
    '/api/customer-pos': () => listCustomerPos(url),
    '/api/settlement-projects': () => listSettlementProjects(url),
    '/api/finance/invoices': () => listFinanceInvoices(url),
  };
  if (url.pathname === '/api/tariff-rates/by-hs-code') {
    await sendJson(response, (await queryRows('SELECT * FROM `tariff_rates` WHERE `hsCode` = ? LIMIT 1', [url.searchParams.get('hsCode') || ''])).at(0) || null);
    return true;
  }
  const quotationFormalExportMatch = url.pathname.match(/^\/api\/quotations\/([^/]+)\/export-formal$/);
  if (quotationFormalExportMatch) {
    try {
      await sendExcel(response, await exportFormalQuotation(quotationFormalExportMatch[1]), `formal-quotation-${quotationFormalExportMatch[1]}.xlsx`);
    } catch (error) {
      await sendJson(response, { message: (error as Error).message }, 500);
    }
    return true;
  }
  const quotationDetailMatch = url.pathname.match(/^\/api\/quotations\/([^/]+)$/);
  if (quotationDetailMatch) {
    try {
      await sendJson(response, await getQuotationDetail(quotationDetailMatch[1]));
    } catch (error) {
      await sendJson(response, { message: (error as Error).message }, 500);
    }
    return true;
  }
  const customerPoDetailMatch = url.pathname.match(/^\/api\/customer-pos\/([^/]+)$/);
  if (customerPoDetailMatch) {
    try {
      await sendJson(response, await getCustomerPoDetail(customerPoDetailMatch[1]));
    } catch (error) {
      await sendJson(response, { message: (error as Error).message }, 500);
    }
    return true;
  }
  const settlementDetailMatch = url.pathname.match(/^\/api\/settlement-projects\/([^/]+)$/);
  if (settlementDetailMatch) {
    try {
      await sendJson(response, await getSettlementProjectDetail(settlementDetailMatch[1]));
    } catch (error) {
      await sendJson(response, { message: (error as Error).message }, 500);
    }
    return true;
  }
  const attachmentDownloadMatch = url.pathname.match(/^\/api\/settlement-projects\/([^/]+)\/attachments\/([^/]+)\/download$/);
  if (attachmentDownloadMatch) {
    try {
      await sendAttachment(response, attachmentDownloadMatch[1], attachmentDownloadMatch[2]);
    } catch (error) {
      await sendJson(response, { message: (error as Error).message }, 500);
    }
    return true;
  }
  const action = routes[url.pathname];
  if (!action) return false;
  try {
    await sendJson(response, await action());
  } catch (error) {
    await sendJson(response, { message: (error as Error).message }, 500);
  }
  return true;
}

async function listTable(table: string, url: URL, keywordFields: string[]) {
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 10)));
  const keyword = (url.searchParams.get('keyword') || '').trim();
  const where = keyword
    ? `WHERE ${keywordFields.map((field) => `${quoteId(field)} LIKE ?`).join(' OR ')}`
    : '';
  const params = keyword ? keywordFields.map(() => `%${keyword}%`) : [];
  const countRows = await queryRows<{ total: number }>(`SELECT COUNT(*) AS total FROM ${quoteId(table)} ${where}`, params);
  const rows = await queryRows(
    `SELECT * FROM ${quoteId(table)} ${where} ORDER BY ${quoteId('createdAt')} DESC, ${quoteId('id')} ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { items: normalizeRows(table, rows), total: Number(countRows[0]?.total || 0), page, pageSize };
}

async function listQuotations(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 10)));
  const status = url.searchParams.get('status');
  const where = status && status !== 'all' ? 'WHERE `status` = ?' : '';
  const params = where ? [status] : [];
  const countRows = await queryRows<{ total: number }>(`SELECT COUNT(*) AS total FROM ${quoteId('quotations')} ${where}`, params);
  const rows = await queryRows(
    `SELECT * FROM ${quoteId('quotations')} ${where} ORDER BY ${quoteId('createdAt')} DESC, ${quoteId('updatedAt')} DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { items: rows, total: Number(countRows[0]?.total || 0), page, pageSize };
}

async function listCustomerPos(url: URL) {
  await ensureCustomerPoSchema();
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 10)));
  const keyword = (url.searchParams.get('keyword') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const filters: string[] = [];
  const joinedFilters: string[] = [];
  const params: DbParam[] = [];
  if (keyword) {
    const keywordFields = [
      'poNo',
      'customerName',
      'remark',
      'quotationNo',
    ];
    filters.push(`(${keywordFields.map((field) => `${quoteId(field)} LIKE ?`).join(' OR ')})`);
    joinedFilters.push(`(${keywordFields.map((field) => `p.${quoteId(field)} LIKE ?`).join(' OR ')})`);
    params.push(...Array.from({ length: 4 }, () => `%${keyword}%`));
  }
  if (status && status !== 'all') {
    filters.push(`${quoteId('status')} = ?`);
    joinedFilters.push(`p.${quoteId('status')} = ?`);
    params.push(status);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const joinedWhere = joinedFilters.length ? `WHERE ${joinedFilters.join(' AND ')}` : '';
  const countRows = await queryRows<{ total: number }>(`SELECT COUNT(*) AS total FROM ${quoteId('customer_pos')} ${where}`, params);
  const rows = await queryRows<Record<string, unknown>>(
    `SELECT p.*,
       COUNT(i.${quoteId('id')}) AS ${quoteId('itemCount')},
       COALESCE(SUM(i.${quoteId('quantity')}), 0) AS ${quoteId('totalQuantity')},
       COALESCE(SUM(i.${quoteId('quantity')} * i.${quoteId('targetUnitPrice')}), 0) AS ${quoteId('totalAmount')}
     FROM ${quoteId('customer_pos')} p
     LEFT JOIN ${quoteId('customer_po_items')} i ON i.${quoteId('poId')} = p.${quoteId('id')}
     ${joinedWhere}
     GROUP BY p.${quoteId('id')}
     ORDER BY p.${quoteId('createdAt')} DESC, p.${quoteId('id')} ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { items: normalizeRows('customer_pos', rows), total: Number(countRows[0]?.total || 0), page, pageSize };
}

async function getCustomerPoDetail(id: string) {
  await ensureCustomerPoSchema();
  const po = (await queryRows<Record<string, unknown>>(
    `SELECT * FROM ${quoteId('customer_pos')} WHERE ${quoteId('id')} = ? LIMIT 1`,
    [id],
  )).at(0);
  if (!po) throw new Error(`Customer PO ${id} not found`);
  const items = await queryRows<Record<string, unknown>>(
    `SELECT * FROM ${quoteId('customer_po_items')} WHERE ${quoteId('poId')} = ? ORDER BY ${quoteId('lineNo')} ASC, ${quoteId('createdAt')} ASC`,
    [id],
  );
  return {
    po: normalizeRows('customer_pos', [po])[0],
    items: normalizeRows('customer_po_items', items),
  };
}

async function getQuotationDetail(id: string) {
  const quotation = (await queryRows<Record<string, unknown>>(
    `SELECT * FROM ${quoteId('quotations')} WHERE ${quoteId('id')} = ? LIMIT 1`,
    [id],
  )).at(0);
  if (!quotation) throw new Error(`Quotation ${id} not found`);
  const items = await queryRows<Record<string, unknown>>(
    `SELECT * FROM ${quoteId('quotation_items')} WHERE ${quoteId('quotationId')} = ? ORDER BY ${quoteId('createdAt')} ASC, ${quoteId('id')} ASC`,
    [id],
  );
  return {
    quotation: normalizeRows('quotations', [quotation])[0],
    items: items.map((item) => normalizeQuotationItem(item, quotation)),
  };
}

async function exportFormalQuotation(id: string) {
  const detail = await getQuotationDetail(id);
  const products = await queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('products')}`);
  const customer = detail.quotation.customerId
    ? (await queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('customers')} WHERE ${quoteId('id')} = ? LIMIT 1`, [detail.quotation.customerId])).at(0)
    : undefined;
  return writeFormalQuotationWorkbook(
    formalQuotationInputFromSaved(detail.quotation as never, detail.items as never, products as never, String(customer?.contactName || '')),
    'buffer',
  ) as Buffer;
}

async function listSettlementProjects(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 10)));
  const keyword = (url.searchParams.get('keyword') || '').trim();
  const where = keyword ? 'WHERE `quotationNo` LIKE ? OR `customerName` LIKE ? OR `remark` LIKE ?' : '';
  const params = keyword ? [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`] : [];
  const countRows = await queryRows<{ total: number }>(`SELECT COUNT(*) AS total FROM ${quoteId('settlement_projects')} ${where}`, params);
  const rows = await queryRows(
    `SELECT * FROM ${quoteId('settlement_projects')} ${where} ORDER BY ${quoteId('createdAt')} DESC, ${quoteId('id')} ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { items: normalizeRows('settlement_projects', rows), total: Number(countRows[0]?.total || 0), page, pageSize };
}

async function getSettlementProjectDetail(id: string) {
  const project = (await queryRows<Record<string, unknown>>(
    `SELECT * FROM ${quoteId('settlement_projects')} WHERE ${quoteId('id')} = ? LIMIT 1`,
    [id],
  )).at(0);
  if (!project) throw new Error(`Settlement project ${id} not found`);
  const [items, expenses, sales, invoices, attachments] = await Promise.all([
    queryRows<Record<string, unknown>>(
      `SELECT si.*
       FROM ${quoteId('settlement_items')} si
       LEFT JOIN ${quoteId('quotation_items')} qi ON qi.${quoteId('id')} = si.${quoteId('quotationItemId')}
       WHERE si.${quoteId('projectId')} = ?
       ORDER BY qi.${quoteId('createdAt')} ASC, qi.${quoteId('id')} ASC, si.${quoteId('createdAt')} ASC, si.${quoteId('id')} ASC`,
      [id],
    ),
    queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('settlement_expenses')} WHERE ${quoteId('projectId')} = ? ORDER BY ${quoteId('createdAt')} ASC, ${quoteId('id')} ASC`, [id]),
    queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('settlement_sales')} WHERE ${quoteId('projectId')} = ? ORDER BY ${quoteId('createdAt')} ASC, ${quoteId('id')} ASC`, [id]),
    queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('settlement_invoices')} WHERE ${quoteId('projectId')} = ? ORDER BY ${quoteId('createdAt')} ASC, ${quoteId('id')} ASC`, [id]),
    queryRows<Record<string, unknown>>(
      `SELECT ${quoteId('id')}, ${quoteId('projectId')}, ${quoteId('fileName')}, ${quoteId('fileType')}, ${quoteId('fileSize')}, ${quoteId('description')}, ${quoteId('uploadedAt')}, ${quoteId('createdAt')}, ${quoteId('updatedAt')}
       FROM ${quoteId('settlement_attachments')} WHERE ${quoteId('projectId')} = ? ORDER BY ${quoteId('createdAt')} ASC, ${quoteId('id')} ASC`,
      [id],
    ),
  ]);
  const normalizedItems = normalizeSettlementItems(items);
  return {
    project: normalizeRows('settlement_projects', [project])[0],
    items: normalizedItems,
    unpurchasedItems: normalizedItems.filter((item) => !item.ordered),
    purchasedItems: normalizedItems.filter((item) => item.ordered),
    expenses: normalizeSettlementMoneyRows(expenses, ['amount', 'taxRate', 'costUsd']),
    sales: normalizeSettlementMoneyRows(sales, ['amount', 'taxRate', 'receivedRevenueUsd']),
    invoices: normalizeFinanceInvoiceRows(invoices),
    attachments: normalizeAttachmentRows(attachments),
  };
}

async function listFinanceInvoices(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 10)));
  const keyword = (url.searchParams.get('keyword') || '').trim();
  const type = (url.searchParams.get('type') || '').trim();
  const accountPeriodStart = (url.searchParams.get('accountPeriodStart') || '').trim();
  const accountPeriodEnd = (url.searchParams.get('accountPeriodEnd') || '').trim();
  const where: string[] = [];
  const params: DbParam[] = [];
  if (type) {
    where.push('i.`type` = ?');
    params.push(type);
  }
  if (accountPeriodStart) {
    where.push('LEFT(COALESCE(i.`accountPeriod`, \'\'), 10) >= ?');
    params.push(accountPeriodStart);
  }
  if (accountPeriodEnd) {
    where.push('LEFT(COALESCE(i.`accountPeriod`, \'\'), 10) <= ?');
    params.push(accountPeriodEnd);
  }
  if (keyword) {
    where.push(`(
      p.\`quotationNo\` LIKE ?
      OR p.\`customerName\` LIKE ?
      OR p.\`remark\` LIKE ?
      OR i.\`invoiceEntity\` LIKE ?
      OR i.\`invoiceNo\` LIKE ?
      OR i.\`accountPeriod\` LIKE ?
    )`);
    params.push(...Array(6).fill(`%${keyword}%`) as string[]);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const selectSql = `
    SELECT i.*, p.\`quotationId\`, p.\`quotationNo\`, p.\`customerName\`, p.\`remark\` AS \`projectName\`, COALESCE(p.\`status\`, 'open') AS \`projectStatus\`
    FROM ${quoteId('settlement_invoices')} i
    LEFT JOIN ${quoteId('settlement_projects')} p ON p.\`id\` = i.\`projectId\`
    ${whereSql}
  `;
  const countRows = await queryRows<{ total: number }>(`SELECT COUNT(*) AS total FROM (${selectSql}) invoice_rows`, params);
  const rows = await queryRows<Record<string, unknown>>(
    `${selectSql} ORDER BY i.\`createdAt\` DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { items: normalizeFinanceInvoiceRows(rows), total: Number(countRows[0]?.total || 0), page, pageSize };
}

async function queryRows<T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await lightweightDb().query(sql, params);
  return rows as T[];
}

type DbParam = string | number | boolean | null | Date | Buffer;

async function executeRows(sql: string, params: DbParam[] = []) {
  await lightweightDb().execute(sql, params);
}

async function executeInTransaction(statements: Array<[string, DbParam[]]>) {
  const connection = await lightweightDb().getConnection();
  try {
    await connection.beginTransaction();
    for (const [sql, params] of statements) {
      await connection.execute(sql, params);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

async function insertRecord(table: string, payload: Record<string, unknown>) {
  const now = new Date().toISOString();
  const record = { id: randomUUID(), ...payload, createdAt: now, updatedAt: now };
  await insertRow(table, record);
  return normalizeRows(table, [record])[0];
}

async function updateRecord(table: string, id: string, payload: Record<string, unknown>) {
  const patch = { ...payload, updatedAt: new Date().toISOString() };
  const entries = Object.entries(patch).filter(([key, value]) => key !== 'id' && value !== undefined);
  if (entries.length) {
    await executeRows(
      `UPDATE ${quoteId(table)} SET ${entries.map(([key]) => `${quoteId(key)} = ?`).join(', ')} WHERE ${quoteId('id')} = ?`,
      [...entries.map(([, value]) => toDbValue(value)), id],
    );
  }
  const updated = (await queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId(table)} WHERE ${quoteId('id')} = ? LIMIT 1`, [id])).at(0);
  if (!updated) throw new Error(`Record ${id} not found`);
  return normalizeRows(table, [updated])[0];
}

async function insertRow(table: string, record: Record<string, unknown>, connection?: mysql.PoolConnection) {
  const entries = Object.entries(record).filter(([, value]) => value !== undefined);
  const sql = `INSERT INTO ${quoteId(table)} (${entries.map(([key]) => quoteId(key)).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`;
  const params = entries.map(([, value]) => toDbValue(value));
  if (connection) {
    await connection.execute(sql, params);
    return;
  }
  await executeRows(sql, params);
}

function toDbValue(value: unknown): DbParam {
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string' || value === null) return value;
  if (value === undefined) return null;
  return JSON.stringify(value);
}

async function saveQuotation(payload: Record<string, unknown>, id?: string) {
  const dto = payload as never;
  const customer = payload.customerId
    ? (await queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('customers')} WHERE ${quoteId('id')} = ? LIMIT 1`, [payload.customerId])).at(0)
    : undefined;
  if (!customer) throw new Error('Please select an archived customer');
  const [products, tariffs] = await Promise.all([
    queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('products')}`),
    queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('tariff_rates')}`),
  ]);
  const existing = id ? await getQuotationDetail(id) : undefined;
  if (existing?.quotation.status === 'completed') throw new Error('Completed quotations cannot be edited');
  const calculated = calculateQuotation(dto, normalizeRows('products', products) as never, normalizeRows('tariff_rates', tariffs) as never);
  const now = new Date().toISOString();
  const quotationId = id || randomUUID();
  const quotationNo = existing?.quotation.quotationNo || await nextQuotationNo();
  const quotation = {
    id: quotationId,
    ...calculated.quotation,
    customerId: customer.id,
    customerName: customer.name,
    quotationNo,
    sourceType: payload.sourceType || '',
    sourcePoId: payload.sourcePoId || '',
    sourcePoNo: payload.sourcePoNo || '',
    createdAt: existing?.quotation.createdAt || now,
    updatedAt: now,
  };
  const payloadItems = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : [];
  const items = calculated.items.map((item, index) => ({
    id: randomUUID(),
    quotationId,
    ...item,
    sourcePoItemId: payloadItems[index]?.sourcePoItemId || '',
    sourcePoLineNo: Number(payloadItems[index]?.sourcePoLineNo || 0),
    createdAt: now,
    updatedAt: now,
  }));
  const connection = await lightweightDb().getConnection();
  try {
    await connection.beginTransaction();
    if (id) {
      await connection.execute(`DELETE FROM ${quoteId('quotation_items')} WHERE ${quoteId('quotationId')} = ?`, [id]);
      const entries = Object.entries(quotation).filter(([, value]) => value !== undefined);
      await connection.execute(
        `UPDATE ${quoteId('quotations')} SET ${entries.filter(([key]) => key !== 'id').map(([key]) => `${quoteId(key)} = ?`).join(', ')} WHERE ${quoteId('id')} = ?`,
        [...entries.filter(([key]) => key !== 'id').map(([, value]) => toDbValue(value)), id],
      );
    } else {
      await insertRow('quotations', quotation, connection);
    }
    for (const item of items) await insertRow('quotation_items', item, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  if (quotation.status === 'completed') await syncCompletedQuotation(quotation, items);
  return getQuotationDetail(quotationId);
}

async function saveCustomerPo(payload: Record<string, unknown>, id?: string) {
  await ensureCustomerPoSchema();
  const customer = payload.customerId
    ? (await queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('customers')} WHERE ${quoteId('id')} = ? LIMIT 1`, [payload.customerId])).at(0)
    : undefined;
  if (!customer) throw new Error('请先选择系统客户');
  const rawItems = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : [];
  if (!rawItems.length) throw new Error('客户 PO 至少需要一条产品明细');
  const now = new Date().toISOString();
  const poId = id || randomUUID();
  const existing = id ? await getCustomerPoDetail(id) : undefined;
  const items = await Promise.all(rawItems.map((item, index) => normalizeCustomerPoItemForSave(poId, item, index, now)));
  const nextStatus = existing?.po.status === 'quoted'
    ? 'quoted'
    : items.every((item) => item.matchedProductId) ? 'matched' : 'draft';
  const po = {
    id: poId,
    poNo: String(payload.poNo || '').trim() || await nextCustomerPoNo(),
    customerId: customer.id,
    customerName: customer.name,
    poDate: payload.poDate || now.slice(0, 10),
    deliveryDate: payload.deliveryDate || '',
    currency: payload.currency || 'USD',
    status: nextStatus,
    remark: payload.remark || '',
    quotationId: existing?.po.quotationId || '',
    quotationNo: existing?.po.quotationNo || '',
    createdBy: payload.createdBy || existing?.po.createdBy || '',
    createdAt: existing?.po.createdAt || now,
    updatedAt: now,
  };
  const connection = await lightweightDb().getConnection();
  try {
    await connection.beginTransaction();
    if (id) {
      await connection.execute(`DELETE FROM ${quoteId('customer_po_items')} WHERE ${quoteId('poId')} = ?`, [id]);
      const entries = Object.entries(po).filter(([, value]) => value !== undefined);
      await connection.execute(
        `UPDATE ${quoteId('customer_pos')} SET ${entries.filter(([key]) => key !== 'id').map(([key]) => `${quoteId(key)} = ?`).join(', ')} WHERE ${quoteId('id')} = ?`,
        [...entries.filter(([key]) => key !== 'id').map(([, value]) => toDbValue(value)), id],
      );
    } else {
      await insertRow('customer_pos', po, connection);
    }
    for (const item of items) await insertRow('customer_po_items', item, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getCustomerPoDetail(poId);
}

async function normalizeCustomerPoItemForSave(poId: string, item: Record<string, unknown>, index: number, now: string) {
  const matchedProductId = String(item.matchedProductId || '');
  const matchedProduct = matchedProductId
    ? (await queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('products')} WHERE ${quoteId('id')} = ? LIMIT 1`, [matchedProductId])).at(0)
    : undefined;
  const matchedProductCode = matchedProduct ? matchedProduct.productCode : '';
  const matchedProductName = matchedProduct ? matchedProduct.name : '';
  return {
    id: item.id || randomUUID(),
    poId,
    lineNo: Number(item.lineNo || index + 1),
    customerSku: item.customerSku || '',
    customerProductName: String(item.customerProductName || matchedProduct?.name || '').trim(),
    customerSpec: item.customerSpec || '',
    customerBrand: item.customerBrand || '',
    unit: item.unit || matchedProduct?.unit || 'pcs',
    quantity: Number(item.quantity || 0),
    targetUnitPrice: Number(item.targetUnitPrice || 0),
    currency: item.currency || 'USD',
    imageUrl: item.imageUrl || matchedProduct?.imageUrl || '',
    remark: item.remark || '',
    matchedProductId,
    matchedProductCode,
    matchedProductName,
    matchStatus: matchedProductId ? 'matched' : item.matchStatus || 'unmatched',
    matchMethod: matchedProductId ? item.matchMethod || 'manual' : item.matchMethod || '',
    sourceType: matchedProductId ? 'system' : item.sourceType || 'temporary',
    createdAt: item.createdAt || now,
    updatedAt: now,
  };
}

async function generateQuotationFromCustomerPo(id: string) {
  const detail = await getCustomerPoDetail(id);
  const draft = customerPoToQuotationDraft(detail.po as never, detail.items as never);
  const created = await saveQuotation(draft as never);
  const quotationId = String(created.quotation.id || '');
  const quotationNo = String(created.quotation.quotationNo || '');
  await executeRows(
    `UPDATE ${quoteId('customer_pos')} SET ${quoteId('status')} = ?, ${quoteId('quotationId')} = ?, ${quoteId('quotationNo')} = ?, ${quoteId('updatedAt')} = ? WHERE ${quoteId('id')} = ?`,
    ['quoted', quotationId, quotationNo, new Date().toISOString(), id],
  );
  return { po: (await getCustomerPoDetail(id)).po, quotation: created.quotation, items: created.items };
}

async function nextCustomerPoNo() {
  const prefix = `PO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
  const rows = await queryRows<{ count: number }>(
    `SELECT COUNT(*) AS count FROM ${quoteId('customer_pos')} WHERE ${quoteId('poNo')} LIKE ?`,
    [`${prefix}%`],
  );
  return `${prefix}-${String(Number(rows[0]?.count || 0) + 1).padStart(3, '0')}`;
}

async function confirmQuotation(id: string) {
  const detail = await getQuotationDetail(id);
  if (detail.quotation.status !== 'completed') {
    await executeRows(`UPDATE ${quoteId('quotations')} SET ${quoteId('status')} = ?, ${quoteId('updatedAt')} = ? WHERE ${quoteId('id')} = ?`, ['completed', new Date().toISOString(), id]);
  }
  const updated = await getQuotationDetail(id);
  await syncCompletedQuotation(updated.quotation as Record<string, unknown>, updated.items as Record<string, unknown>[]);
  return updated;
}

async function nextQuotationNo() {
  const prefix = `QTN-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
  const rows = await queryRows<{ quotationNo: string }>(
    `SELECT ${quoteId('quotationNo')} FROM ${quoteId('quotations')} WHERE ${quoteId('quotationNo')} LIKE ?`,
    [`${prefix}%`],
  );
  const maxSequence = rows.reduce((max, row) => Math.max(max, Number(String(row.quotationNo || '').slice(prefix.length + 1)) || 0), 0);
  return `${prefix}-${String(maxSequence + 1).padStart(3, '0')}`;
}

async function syncCompletedQuotation(quotation: Record<string, unknown>, items: Record<string, unknown>[]) {
  if (quotation.status !== 'completed') return;
  const now = new Date().toISOString();
  const existingProject = (await queryRows<Record<string, unknown>>(
    `SELECT * FROM ${quoteId('settlement_projects')} WHERE ${quoteId('quotationId')} = ? LIMIT 1`,
    [quotation.id],
  )).at(0);
  const project = existingProject || {
    id: randomUUID(),
    quotationId: quotation.id,
    quotationNo: quotation.quotationNo,
    customerName: quotation.customerName || '',
    remark: quotation.remark || '',
    exchangeRateUsd: Number(quotation.exchangeRateUsd || 0),
    exchangeRateMxn: Number(quotation.exchangeRateMxn || 0),
    quotedPurchaseCostUsd: sumValues(items, 'ddpTotalUsd'),
    purchasedCostUsd: 0,
    quotedSalesRevenueUsd: sumValues(items, 'revenueUsd'),
    receivedRevenueUsd: 0,
    grossProfitUsd: 0,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
  if (!existingProject) await insertRow('settlement_projects', project);
  for (const item of items) {
    await ensureSettlementItem(project.id as string, item, now);
    await insertHistoryQuotation(quotation, item, now);
  }
  await recalculateSettlementProject(project.id as string);
}

async function ensureSettlementItem(projectId: string, item: Record<string, unknown>, now: string) {
  const existing = (await queryRows<Record<string, unknown>>(
    `SELECT ${quoteId('id')} FROM ${quoteId('settlement_items')} WHERE ${quoteId('projectId')} = ? AND ${quoteId('quotationItemId')} = ? LIMIT 1`,
    [projectId, item.id],
  )).at(0);
  if (existing) return;
  await insertRow('settlement_items', {
    id: randomUUID(),
    projectId,
    quotationItemId: item.id,
    productId: item.productId,
    productCode: item.productCode,
    productName: item.productName,
    brand: item.brand || '',
    plannedQty: Math.trunc(Number(item.purchaseQty || 0)),
    purchaseQty: Math.trunc(Number(item.purchaseQty || 0)),
    purchaseUnitPrice: Number(item.purchaseUnitPrice || 0),
    currency: item.purchaseCurrency || 'CNY',
    priceType: 'tax_excluded',
    taxRate: 13,
    quotedWarehouseCostUsd: Number(item.ddpTotalUsd || 0),
    quotedSalesRevenueUsd: Number(item.revenueUsd || 0),
    purchasedCostUsd: 0,
    receivedRevenueUsd: 0,
    invoiceNo: '',
    ordered: false,
    createdAt: now,
    updatedAt: now,
  });
}

async function insertHistoryQuotation(quotation: Record<string, unknown>, item: Record<string, unknown>, now: string) {
  await insertRow('history_quotations', {
    id: randomUUID(),
    quotationDate: now,
    customerName: quotation.customerName || 'Unknown customer',
    productCode: item.productCode || '',
    productName: item.productName || '',
    spec: '',
    brand: item.brand || '',
    transportType: item.transportType || 'none',
    customerPriceUsd: historyCustomerQuoteUnitUsd(item),
    createdAt: now,
    updatedAt: now,
  });
}

async function recalculateSettlementProject(projectId: string) {
  const [project] = await queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('settlement_projects')} WHERE ${quoteId('id')} = ? LIMIT 1`, [projectId]);
  if (!project) return;
  const [itemTotals, expenseTotals, saleTotals] = await Promise.all([
    queryRows<{ quotedPurchaseCostUsd: number; purchasedCostUsd: number; quotedSalesRevenueUsd: number }>(
      `SELECT
        COALESCE(SUM(${quoteId('quotedWarehouseCostUsd')}), 0) AS quotedPurchaseCostUsd,
        COALESCE(SUM(CASE WHEN ${quoteId('ordered')} = 1 THEN ${quoteId('purchasedCostUsd')} ELSE 0 END), 0) AS purchasedCostUsd,
        COALESCE(SUM(${quoteId('quotedSalesRevenueUsd')}), 0) AS quotedSalesRevenueUsd
       FROM ${quoteId('settlement_items')} WHERE ${quoteId('projectId')} = ?`,
      [projectId],
    ),
    queryRows<{ costUsd: number }>(
      `SELECT COALESCE(SUM(${quoteId('costUsd')}), 0) AS costUsd FROM ${quoteId('settlement_expenses')} WHERE ${quoteId('projectId')} = ?`,
      [projectId],
    ),
    queryRows<{ receivedRevenueUsd: number }>(
      `SELECT COALESCE(SUM(${quoteId('receivedRevenueUsd')}), 0) AS receivedRevenueUsd FROM ${quoteId('settlement_sales')} WHERE ${quoteId('projectId')} = ?`,
      [projectId],
    ),
  ]);
  const quotedPurchaseCostUsd = Number(itemTotals[0]?.quotedPurchaseCostUsd || 0);
  const purchasedCostUsd = Number(itemTotals[0]?.purchasedCostUsd || 0) + Number(expenseTotals[0]?.costUsd || 0);
  const quotedSalesRevenueUsd = Number(itemTotals[0]?.quotedSalesRevenueUsd || 0);
  const receivedRevenueUsd = Number(saleTotals[0]?.receivedRevenueUsd || 0);
  await executeRows(
    `UPDATE ${quoteId('settlement_projects')} SET ${quoteId('quotedPurchaseCostUsd')} = ?, ${quoteId('purchasedCostUsd')} = ?, ${quoteId('quotedSalesRevenueUsd')} = ?, ${quoteId('receivedRevenueUsd')} = ?, ${quoteId('grossProfitUsd')} = ?, ${quoteId('updatedAt')} = ? WHERE ${quoteId('id')} = ?`,
    [
      round(quotedPurchaseCostUsd),
      round(purchasedCostUsd),
      round(quotedSalesRevenueUsd),
      round(receivedRevenueUsd),
      round(receivedRevenueUsd - purchasedCostUsd),
      new Date().toISOString(),
      projectId,
    ],
  );
}

async function handleSettlementPost(projectId: string, action: string, body: Record<string, unknown>) {
  if (action === 'complete') {
    await executeRows(`UPDATE ${quoteId('settlement_projects')} SET ${quoteId('status')} = ?, ${quoteId('updatedAt')} = ? WHERE ${quoteId('id')} = ?`, ['completed', new Date().toISOString(), projectId]);
    return getSettlementProjectDetail(projectId);
  }
  if (action === 'order') {
    const project = await requireSettlementProject(projectId);
    const orderItems = Array.isArray(body.items) ? body.items as Record<string, unknown>[] : [];
    for (const orderItem of orderItems) {
      const itemId = String(orderItem.itemId || '');
      const existingItem = await requireSettlementItem(projectId, itemId);
      if (toBoolean(existingItem.ordered)) continue;
      const purchasedCostUsd = calculateTaxExcludedAmountUsd({
        amount: Math.trunc(Number(orderItem.purchaseQty || 0)) * Number(orderItem.purchaseUnitPrice || 0),
        currency: String(orderItem.currency || 'CNY'),
        priceType: String(orderItem.priceType || 'tax_excluded'),
        taxRate: Number(orderItem.taxRate || 0),
      }, project);
      await updateSettlementItem(projectId, itemId, {
        purchaseQty: Math.trunc(Number(orderItem.purchaseQty || 0)),
        purchaseUnitPrice: Number(orderItem.purchaseUnitPrice || 0),
        currency: orderItem.currency || 'CNY',
        priceType: orderItem.priceType || 'tax_excluded',
        taxRate: Number(orderItem.taxRate || 0),
        purchasedCostUsd,
        receivedRevenueUsd: 0,
        invoiceNo: orderItem.invoiceNo || '',
        ordered: true,
        orderedAt: new Date().toISOString(),
      });
    }
    await recalculateSettlementProject(projectId);
    return getSettlementProjectDetail(projectId);
  }
  if (action === 'expenses') {
    const project = await requireSettlementProject(projectId);
    await insertRecord('settlement_expenses', {
      projectId,
      type: body.type || 'other',
      description: body.description || '',
      amount: Number(body.amount || 0),
      currency: body.currency || 'CNY',
      priceType: body.priceType || 'tax_excluded',
      taxRate: Number(body.taxRate || 0),
      costUsd: calculateTaxExcludedAmountUsd(body, project),
      invoiceNo: body.invoiceNo || '',
    });
    await recalculateSettlementProject(projectId);
    return getSettlementProjectDetail(projectId);
  }
  if (action === 'sales') {
    const project = await requireSettlementProject(projectId);
    await insertRecord('settlement_sales', {
      projectId,
      description: body.description || '',
      amount: Number(body.amount || 0),
      currency: body.currency || 'CNY',
      priceType: body.priceType || 'tax_excluded',
      taxRate: Number(body.taxRate || 0),
      receivedRevenueUsd: calculateTaxExcludedAmountUsd(body, project),
      invoiceNo: body.invoiceNo || '',
      receivedAt: body.receivedAt || new Date().toISOString(),
    });
    await recalculateSettlementProject(projectId);
    return getSettlementProjectDetail(projectId);
  }
  if (action === 'invoices') {
    await insertRecord('settlement_invoices', invoicePatch(projectId, body));
    return getSettlementProjectDetail(projectId);
  }
  if (action === 'attachments') {
    await requireSettlementProject(projectId);
    const dataUrl = String(body.dataUrl || '');
    const initialDataUrl = dataUrl.startsWith('data:')
      ? dataUrl
      : `data:${String(body.fileType || 'application/octet-stream')};base64,`;
    const attachment = await insertRecord('settlement_attachments', {
      projectId,
      fileName: body.fileName || 'attachment',
      fileType: body.fileType || '',
      fileSize: Number(body.fileSize || 0),
      dataUrl: initialDataUrl,
      description: body.description || '',
      uploadedAt: new Date().toISOString(),
    });
    return body.dataUrl ? getSettlementProjectDetail(projectId) : { attachment };
  }
  throw new Error(`Unsupported settlement action ${action}`);
}

async function handleSettlementChildWrite(projectId: string, resource: string, childId: string, method: string, body: Record<string, unknown>, orderSuffix: boolean) {
  if (resource === 'items' && method === 'DELETE' && orderSuffix) {
    await updateSettlementItem(projectId, childId, { purchasedCostUsd: 0, receivedRevenueUsd: 0, ordered: false, orderedAt: '' });
    await recalculateSettlementProject(projectId);
    return getSettlementProjectDetail(projectId);
  }
  if (resource === 'items' && method === 'PUT') {
    const project = await requireSettlementProject(projectId);
    await updateSettlementItem(projectId, childId, {
      purchaseQty: Math.trunc(Number(body.purchaseQty || 0)),
      purchaseUnitPrice: Number(body.purchaseUnitPrice || 0),
      currency: body.currency || 'CNY',
      priceType: body.priceType || 'tax_excluded',
      taxRate: Number(body.taxRate || 0),
      purchasedCostUsd: calculateTaxExcludedAmountUsd({
        amount: Math.trunc(Number(body.purchaseQty || 0)) * Number(body.purchaseUnitPrice || 0),
        currency: String(body.currency || 'CNY'),
        priceType: String(body.priceType || 'tax_excluded'),
        taxRate: Number(body.taxRate || 0),
      }, project),
      invoiceNo: body.invoiceNo || '',
    });
    await recalculateSettlementProject(projectId);
    return getSettlementProjectDetail(projectId);
  }
  const tableByResource: Record<string, string> = {
    expenses: 'settlement_expenses',
    sales: 'settlement_sales',
    invoices: 'settlement_invoices',
    attachments: 'settlement_attachments',
  };
  const table = tableByResource[resource];
  if (!table) throw new Error(`Unsupported settlement resource ${resource}`);
  if (method === 'DELETE') {
    await executeRows(`DELETE FROM ${quoteId(table)} WHERE ${quoteId('id')} = ? AND ${quoteId('projectId')} = ?`, [childId, projectId]);
  } else if (resource === 'expenses') {
    const project = await requireSettlementProject(projectId);
    await updateRecord(table, childId, { ...body, costUsd: calculateTaxExcludedAmountUsd(body, project) });
  } else if (resource === 'sales') {
    const project = await requireSettlementProject(projectId);
    await updateRecord(table, childId, { ...body, receivedRevenueUsd: calculateTaxExcludedAmountUsd(body, project), receivedAt: body.receivedAt || new Date().toISOString() });
  } else if (resource === 'invoices') {
    await updateRecord(table, childId, invoicePatch(projectId, body));
  }
  await recalculateSettlementProject(projectId);
  return getSettlementProjectDetail(projectId);
}

async function appendAttachmentChunk(projectId: string, attachmentId: string, body: Record<string, unknown>) {
  const chunk = String(body.chunk || '');
  if (!chunk) throw new Error('Attachment chunk is required');
  const result = await lightweightDb().execute(
    `UPDATE ${quoteId('settlement_attachments')} SET ${quoteId('dataUrl')} = CONCAT(${quoteId('dataUrl')}, ?), ${quoteId('updatedAt')} = ? WHERE ${quoteId('id')} = ? AND ${quoteId('projectId')} = ?`,
    [chunk, new Date().toISOString(), attachmentId, projectId],
  );
  const header = result[0] as mysql.ResultSetHeader;
  if (!header.affectedRows) throw new Error(`Attachment ${attachmentId} not found`);
  return { ok: true };
}

async function requireSettlementProject(projectId: string) {
  const project = (await queryRows<Record<string, unknown>>(`SELECT * FROM ${quoteId('settlement_projects')} WHERE ${quoteId('id')} = ? LIMIT 1`, [projectId])).at(0);
  if (!project) throw new Error(`Settlement project ${projectId} not found`);
  return project;
}

async function requireSettlementItem(projectId: string, itemId: string) {
  const item = (await queryRows<Record<string, unknown>>(
    `SELECT * FROM ${quoteId('settlement_items')} WHERE ${quoteId('id')} = ? AND ${quoteId('projectId')} = ? LIMIT 1`,
    [itemId, projectId],
  )).at(0);
  if (!item) throw new Error(`Settlement item ${itemId} not found`);
  return { ...item, ordered: toBoolean(item.ordered) };
}

async function updateSettlementItem(projectId: string, itemId: string, payload: Record<string, unknown>) {
  const patch = { ...payload, updatedAt: new Date().toISOString() };
  const entries = Object.entries(patch).filter(([key, value]) => key !== 'id' && key !== 'projectId' && value !== undefined);
  if (!entries.length) return requireSettlementItem(projectId, itemId);
  await executeRows(
    `UPDATE ${quoteId('settlement_items')} SET ${entries.map(([key]) => `${quoteId(key)} = ?`).join(', ')} WHERE ${quoteId('id')} = ? AND ${quoteId('projectId')} = ?`,
    [...entries.map(([, value]) => toDbValue(value)), itemId, projectId],
  );
  return requireSettlementItem(projectId, itemId);
}

function invoicePatch(projectId: string, body: Record<string, unknown>) {
  const invoiceTotal = Number(body.invoiceTotal || 0);
  const taxRate = Number(body.taxRate || 0);
  const exchangeRate = Number(body.exchangeRate || 0);
  const invoiceTaxExcludedTotal = taxRate === -100 ? 0 : safeDivide(invoiceTotal, 1 + taxRate / 100);
  const invoiceTaxAmount = invoiceTaxExcludedTotal * taxRate / 100;
  const unsignedUsdAmount = exchangeRate ? safeDivide(invoiceTaxExcludedTotal, exchangeRate) : 0;
  return {
    projectId,
    type: body.type || 'cost',
    accountPeriod: body.accountPeriod || '',
    invoiceEntity: body.invoiceEntity || '',
    invoiceDate: body.invoiceDate || '',
    invoiceNo: body.invoiceNo || '',
    invoiceTotal,
    invoiceTaxExcludedTotal: round(invoiceTaxExcludedTotal),
    taxRate,
    invoiceTaxAmount: round(invoiceTaxAmount),
    currency: body.currency || 'CNY',
    exchangeRate,
    usdAmount: round(body.type === 'cost' ? -Math.abs(unsignedUsdAmount) : Math.abs(unsignedUsdAmount)),
    isPaid: Boolean(body.isPaid),
  };
}

function calculateTaxExcludedAmountUsd(body: Record<string, unknown>, project: Record<string, unknown>) {
  const amount = Number(body.amount || 0);
  const taxRate = Number(body.taxRate || 0);
  const taxExcluded = body.priceType === 'tax_included' ? safeDivide(amount, 1 + taxRate / 100) : amount;
  const currency = String(body.currency || 'CNY');
  if (currency === 'USD') return round(taxExcluded);
  if (currency === 'MXN') return round(taxExcluded * Number(project.exchangeRateMxn || 0));
  return round(safeDivide(taxExcluded, Number(project.exchangeRateUsd || 0)));
}

async function ensureCustomerPoSchema() {
  if (process.env.DB_AUTO_MIGRATE === 'false') return;
  customerPoSchemaReady ??= applyCustomerPoSchema();
  return customerPoSchemaReady;
}

async function applyCustomerPoSchema() {
  const pool = lightweightDb();
  await ensureLightweightTable(pool, 'customer_pos', `
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
  await ensureLightweightTable(pool, 'customer_po_items', `
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
  await ensureLightweightTable(pool, 'customer_product_aliases', `
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
  await ensureLightweightColumn(pool, 'quotations', 'sourceType', "VARCHAR(30) NULL AFTER `remark`");
  await ensureLightweightColumn(pool, 'quotations', 'sourcePoId', "CHAR(36) NULL AFTER `sourceType`");
  await ensureLightweightColumn(pool, 'quotations', 'sourcePoNo', "VARCHAR(100) NULL AFTER `sourcePoId`");
  await ensureLightweightColumn(pool, 'quotation_items', 'sourcePoItemId', "CHAR(36) NULL AFTER `enableNom`");
  await ensureLightweightColumn(pool, 'quotation_items', 'sourcePoLineNo', "INT NOT NULL DEFAULT 0 AFTER `sourcePoItemId`");
}

async function ensureLightweightTable(pool: mysql.Pool, table: string, createSql: string) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table],
  );
  if (Number(rows[0]?.count || 0) > 0) return;
  await pool.query(createSql);
}

async function ensureLightweightColumn(pool: mysql.Pool, table: string, column: string, definition: string) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column],
  );
  if (Number(rows[0]?.count || 0) > 0) return;
  await pool.query(`ALTER TABLE ${quoteId(table)} ADD COLUMN ${quoteId(column)} ${definition}`);
}

function sumValues(rows: Record<string, unknown>[], key: string) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function lightweightDb(): mysql.Pool {
  lightweightPool ??= mysql.createPool({
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
  return lightweightPool;
}

function dbConnectionLimit() {
  return Math.max(1, Math.min(Number(process.env.DB_CONNECTION_LIMIT || 1), 2));
}

function getRequestUrl(request: IncomingMessage) {
  const rawUrl = request.url || '/';
  const url = new URL(rawUrl, 'https://quotation.local');
  const pathname = getApiPath(request, url);
  return new URL(`${pathname}${url.search}`, 'https://quotation.local');
}

function getApiPath(request: IncomingMessage, parsedUrl?: URL) {
  const url = parsedUrl ?? new URL(request.url || '/', 'https://quotation.local');
  const pathParam = url.searchParams.get('path') || url.searchParams.get('0');
  if (pathParam) return withApiPrefix(pathParam);
  const routeMatches = request.headers['x-now-route-matches'];
  const routeMatchPath = Array.isArray(routeMatches) ? routeMatches[0] : routeMatches;
  if (routeMatchPath) {
    const match = routeMatchPath.match(/(?:^|[&?])path=([^&]+)/);
    if (match) return withApiPrefix(decodeURIComponent(match[1]));
  }
  return withApiPrefix(decodeURIComponent(url.pathname));
}

function withApiPrefix(pathname: string) {
  const cleanPath = pathname.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
  if (!cleanPath || cleanPath === 'api/[...path]' || cleanPath === 'api/%5B...path%5D') return '/api';
  return cleanPath.startsWith('api/') ? `/${cleanPath}` : `/api/${cleanPath}`;
}

async function sendJson(response: ServerResponse, body: unknown, statusCode = 200) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

async function sendExcel(response: ServerResponse, body: Buffer, fileName: string) {
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  response.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  response.end(body);
}

async function sendAttachment(response: ServerResponse, projectId: string, attachmentId: string) {
  const attachment = (await queryRows<Record<string, unknown>>(
    `SELECT * FROM ${quoteId('settlement_attachments')} WHERE ${quoteId('id')} = ? AND ${quoteId('projectId')} = ? LIMIT 1`,
    [attachmentId, projectId],
  )).at(0);
  if (!attachment) throw new Error(`Attachment ${attachmentId} not found`);
  const dataUrl = String(attachment.dataUrl || '');
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) throw new Error('Attachment data is invalid');
  const contentType = match[1] || String(attachment.fileType || 'application/octet-stream');
  const body = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
  response.statusCode = 200;
  response.setHeader('Content-Type', contentType);
  response.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(String(attachment.fileName || 'attachment'))}"`);
  response.end(body);
}

async function dbHealthHandler(response: ServerResponse) {
  try {
    const startedAt = Date.now();
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'quotation',
      connectTimeout: 8000,
      ssl: process.env.DB_SSL === 'true' ? {} : undefined,
    });
    const [rows] = await connection.query('SELECT COUNT(*) AS products FROM products');
    await connection.end();
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ ok: true, elapsedMs: Date.now() - startedAt, rows }));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ ok: false, message: (error as Error).message }));
  }
}

function loginHandler(request: IncomingMessage, response: ServerResponse) {
  const chunks: Buffer[] = [];
  request.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  request.on('end', () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { username?: string; password?: string };
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'admin';
      if (body.username !== username || body.password !== password) {
        response.statusCode = 401;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify({ message: '用户名或密码错误' }));
        return;
      }
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ username, token: 'local-admin-session' }));
    } catch {
      response.statusCode = 400;
      response.end();
    }
  });
}

function quoteId(identifier: string): string {
  return `\`${identifier.replaceAll('`', '``')}\``;
}

function normalizeRows(table: string, rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    const normalized = { ...row };
    for (const key of [
      'length',
      'width',
      'height',
      'grossWeight',
      'suggestedPrice',
      'taxRate',
      'exchangeRateUsd',
      'exchangeRateMxn',
      'quotedPurchaseCostUsd',
      'purchasedCostUsd',
      'quotedSalesRevenueUsd',
      'receivedRevenueUsd',
      'grossProfitUsd',
    ]) {
      if (key in normalized) normalized[key] = Number(normalized[key] || 0);
    }
    const booleanFields: Record<string, string[]> = {
      products: ['isMagnetic', 'isElectric', 'needNom'],
      tariff_rates: ['needNom'],
    };
    for (const key of booleanFields[table] ?? []) {
      if (key in normalized) normalized[key] = Boolean(normalized[key]);
    }
    return normalized;
  });
}

function normalizeQuotationItem(item: Record<string, unknown>, quotation: Record<string, unknown>) {
  const normalized = { ...item };
  const numericKeys = [
    'purchaseQty',
    'purchaseUnitPrice',
    'purchaseTotalOriginal',
    'purchaseTotalUsd',
    'purchasePriceCny',
    'totalTaxIncludedCny',
    'totalExclTaxCny',
    'vatInputCny',
    'firstMileFreightUsd',
    'firstMileFreightCny',
    'cifCny',
    'cifUsd',
    'igiTaxRate',
    'tariffUsd',
    'capitalCostUsd',
    'customsFeeUsd',
    'nomFeeUsd',
    'publicFeeAllocationUsd',
    'ddpTotalUsd',
    'ddpUnitPriceUsd',
    'ddpQuoteUnitUsd',
    'revenueUsd',
    'operatingProfitUsd',
    'grossMarginRate',
    'badDebtProvisionUsd',
    'markupRate',
    'historicalDdpQuoteUsd',
  ];
  for (const key of numericKeys) {
    if (key in normalized && normalized[key] !== null && normalized[key] !== undefined) {
      normalized[key] = Number(normalized[key] || 0);
    }
  }
  for (const key of ['isCustomsClearance', 'enableNom']) {
    if (key in normalized) normalized[key] = Boolean(normalized[key]);
  }
  const purchaseQty = Number(normalized.purchaseQty || 0);
  const exchangeRateUsd = Number(quotation.exchangeRateUsd || 0);
  const exchangeRateMxn = Number(quotation.exchangeRateMxn || 0);
  const purchaseCurrency = String(normalized.purchaseCurrency || 'CNY');
  const purchaseUnitPrice = Number(normalized.purchaseUnitPrice || 0)
    || safeDivide(Number(normalized.totalExclTaxCny || 0), purchaseQty)
    || safeDivide(Number(normalized.purchasePriceCny || 0), 1.13);
  const purchaseTotalOriginal = Number(normalized.purchaseTotalOriginal || 0) || purchaseQty * purchaseUnitPrice;
  const purchaseTotalUsd = Number(normalized.purchaseTotalUsd || 0)
    || convertPurchaseTotalToUsd(purchaseTotalOriginal, purchaseCurrency, exchangeRateUsd, exchangeRateMxn);
  const firstMileFreightUsd = Number(normalized.firstMileFreightUsd || 0)
    || safeDivide(Number(normalized.firstMileFreightCny || 0), exchangeRateUsd);
  return {
    ...normalized,
    purchaseCurrency,
    purchaseUnitPrice,
    purchaseTotalOriginal,
    purchaseTotalUsd,
    firstMileFreightUsd,
    cifUsd: Number(normalized.cifUsd || 0) || purchaseTotalUsd + firstMileFreightUsd,
  };
}

function normalizeFinanceInvoiceRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    const normalized = { ...row };
    for (const key of [
      'invoiceTotal',
      'invoiceTaxExcludedTotal',
      'taxRate',
      'invoiceTaxAmount',
      'exchangeRate',
      'usdAmount',
    ]) {
      normalized[key] = Number(normalized[key] || 0);
    }
    normalized.isPaid = Boolean(normalized.isPaid);
    normalized.projectName = normalized.projectName || '';
    normalized.projectStatus = normalized.projectStatus || 'open';
    normalized.quotationNo = normalized.quotationNo || '';
    normalized.customerName = normalized.customerName || '';
    return normalized;
  });
}

function normalizeSettlementItems(rows: Record<string, unknown>[]) {
  return normalizeSettlementMoneyRows(rows, [
    'plannedQty',
    'purchaseQty',
    'purchaseUnitPrice',
    'taxRate',
    'quotedWarehouseCostUsd',
    'quotedSalesRevenueUsd',
    'purchasedCostUsd',
    'receivedRevenueUsd',
  ]).map((row) => ({ ...row, ordered: toBoolean(row.ordered) }));
}

function normalizeSettlementMoneyRows(rows: Record<string, unknown>[], numericKeys: string[]) {
  return rows.map((row) => {
    const normalized = { ...row };
    for (const key of numericKeys) normalized[key] = Number(normalized[key] || 0);
    if ('isPaid' in normalized) normalized.isPaid = Boolean(normalized.isPaid);
    return normalized;
  });
}

function normalizeAttachmentRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => ({
    ...row,
    fileSize: Number(row.fileSize || 0),
    dataUrl: `/api/settlement-projects/${row.projectId}/attachments/${row.id}/download`,
  }));
}

function convertPurchaseTotalToUsd(value: number, currency: string, exchangeRateUsd: number, exchangeRateMxn: number) {
  if (currency === 'USD') return value;
  if (currency === 'MXN') return value * exchangeRateMxn;
  return safeDivide(value, exchangeRateUsd);
}

function safeDivide(value: number, divisor: number) {
  return divisor ? value / divisor : 0;
}

function historyCustomerQuoteUnitUsd(item: Record<string, unknown>) {
  if (item.ddpQuoteUnitUsd !== undefined && item.ddpQuoteUnitUsd !== null) return Number(item.ddpQuoteUnitUsd || 0);
  return safeDivide(Number(item.revenueUsd || 0), Number(item.purchaseQty || 0));
}

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === '1';
}
