import { Inject, Injectable } from '@nestjs/common';
import { workbookBufferFromSheets } from '../../common/excel-utils.js';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import type { FinanceInvoiceRow, PageResult, SettlementInvoice, SettlementProject } from '../../../shared/api.interface.js';

const PROJECT_FILE = 'settlement_projects.xlsx';
const INVOICE_FILE = 'settlement_invoices.xlsx';
const CUSTOMER_FILE = 'customers.xlsx';
const ENTITY_FILE = 'contracting_entities.xlsx';

@Injectable()
export class FinanceService {
  constructor(@Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService) {}

  async invoices(page = 1, pageSize = 10, keyword = '', type = '', accountPeriodStart = '', accountPeriodEnd = ''): Promise<PageResult<FinanceInvoiceRow>> {
    const query = invoiceQuery(keyword, type, accountPeriodStart, accountPeriodEnd);
    const paginateCustom = (this.storage as DatabaseStorageService & {
      paginateCustom?: DatabaseStorageService['paginateCustom'];
    }).paginateCustom;
    if (paginateCustom) return paginateCustom.call(this.storage, page, pageSize, query) as Promise<PageResult<FinanceInvoiceRow>>;
    const rows = await this.filteredInvoices(keyword, type, accountPeriodStart, accountPeriodEnd);
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));
    return {
      items: rows.slice((safePage - 1) * safePageSize, safePage * safePageSize),
      total: rows.length,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async exportInvoices(keyword = '', type = '', accountPeriodStart = '', accountPeriodEnd = ''): Promise<Buffer> {
    const rows = await this.filteredInvoices(keyword, type, accountPeriodStart, accountPeriodEnd);
    return workbookBufferFromSheets({
      '发票明细': rows.map((row) => ({
        '项目单号': row.projectNo,
        '承接单位': row.contractingEntityName || '未设置',
        '客户': row.customerName,
        '项目名称': row.projectName,
        '项目状态': row.projectStatus === 'completed' ? '已完成' : '进行中',
        '类型': invoiceTypeLabel(row.type),
        '账期': row.accountPeriod || '',
        '财务记账日期': row.accountingDate || '',
        '公司主体': row.companyEntity || '',
        '发票主体': row.invoiceEntity || '',
        '发票日期': row.invoiceDate || '',
        '发票号': row.invoiceNo || '',
        '发票总额': row.invoiceTotal,
        '发票不含税总额': row.invoiceTaxExcludedTotal,
        '税率(%)': row.taxRate,
        '发票税金': row.invoiceTaxAmount,
        '发票币种': row.currency,
        '发票汇率': row.exchangeRate,
        '美金金额': row.usdAmount,
        '是否支付': row.isPaid ? '是' : '否',
      })),
    });
  }

  private async filteredInvoices(keyword = '', type = '', accountPeriodStart = '', accountPeriodEnd = ''): Promise<FinanceInvoiceRow[]> {
    const [projects, invoices, customers, entities] = await Promise.all([
      this.storage.readTable<SettlementProject>(PROJECT_FILE),
      this.storage.readTable<SettlementInvoice>(INVOICE_FILE),
      this.storage.readTable<{ id: string; name?: string; shortName?: string }>(CUSTOMER_FILE),
      this.storage.readTable<{ id: string; entityName?: string; shortName?: string }>(ENTITY_FILE),
    ]);
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const customerByName = new Map(customers.map((customer) => [customer.name || '', customer.shortName || customer.name || '']));
    const entityById = new Map(entities.map((entity) => [entity.id, entity.shortName || entity.entityName || '']));
    const normalizedKeyword = keyword.trim().toLowerCase();
    return invoices
      .map((invoice) => {
        const project = projectById.get(invoice.projectId);
        return {
          ...invoice,
          quotationId: project?.quotationId || '',
          projectId: project?.id || invoice.projectId,
          projectNo: project?.projectNo || '',
          quotationNo: project?.quotationNo || '',
          contractingEntityId: project?.contractingEntityId || '',
          contractingEntityName: project?.contractingEntityName || '',
          contractingEntityShortName: entityById.get(project?.contractingEntityId || '') || project?.contractingEntityName || '',
          customerName: project?.customerName || '',
          customerShortName: customerByName.get(project?.customerName || '') || project?.customerName || '',
          projectName: project?.remark || '',
          projectStatus: project?.status || 'open',
        } satisfies FinanceInvoiceRow;
      })
      .filter((row) => !type || row.type === type)
      .filter((row) => inAccountPeriodRange(row.accountPeriod || '', accountPeriodStart, accountPeriodEnd))
      .filter((row) => !normalizedKeyword || [
        row.quotationNo,
        row.contractingEntityName,
        row.customerName,
        row.projectName,
        row.companyEntity,
        row.invoiceEntity,
        row.invoiceNo,
        row.accountPeriod,
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedKeyword)))
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  }
}

function invoiceQuery(keyword = '', type = '', accountPeriodStart = '', accountPeriodEnd = '') {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (type) {
    conditions.push('i.`type` = ?');
    params.push(type);
  }
  if (accountPeriodStart || accountPeriodEnd) {
    conditions.push("COALESCE(i.`accountPeriod`, '') <> ''");
    if (accountPeriodStart) {
      conditions.push('LEFT(i.`accountPeriod`, 10) >= ?');
      params.push(accountPeriodStart);
    }
    if (accountPeriodEnd) {
      conditions.push('LEFT(i.`accountPeriod`, 10) <= ?');
      params.push(accountPeriodEnd);
    }
  }
  const normalizedKeyword = keyword.trim();
  if (normalizedKeyword) {
    const columns = [
      'p.`projectNo`',
      'p.`quotationNo`',
      'p.`contractingEntityName`',
      'p.`customerName`',
      'p.`remark`',
      'i.`companyEntity`',
      'i.`invoiceEntity`',
      'i.`invoiceNo`',
      'i.`accountPeriod`',
    ];
    conditions.push(`(${columns.map((column) => `${column} LIKE ?`).join(' OR ')})`);
    params.push(...columns.map(() => `%${normalizedKeyword}%`));
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const from = 'FROM `settlement_invoices` i LEFT JOIN `settlement_projects` p ON p.`id` = i.`projectId` LEFT JOIN `customers` c ON c.`name` = p.`customerName` LEFT JOIN `contracting_entities` e ON e.`id` = p.`contractingEntityId`';
  return {
    countSql: `SELECT COUNT(*) AS total ${from} ${where}`,
    countParams: params,
    itemsSql: [
      "SELECT i.*, COALESCE(p.`id`, '') AS projectId, COALESCE(p.`projectNo`, '') AS projectNo, COALESCE(p.`quotationId`, '') AS quotationId, COALESCE(p.`quotationNo`, '') AS quotationNo, COALESCE(p.`customerName`, '') AS customerName, COALESCE(c.`shortName`, p.`customerName`, '') AS customerShortName, COALESCE(p.`remark`, '') AS projectName, COALESCE(p.`contractingEntityId`, '') AS contractingEntityId, COALESCE(p.`contractingEntityName`, '') AS contractingEntityName, COALESCE(e.`shortName`, p.`contractingEntityName`, '') AS contractingEntityShortName, COALESCE(p.`status`, 'open') AS projectStatus",
      from,
      where,
      'ORDER BY i.`createdAt` DESC, i.`id` DESC',
    ].filter(Boolean).join(' '),
    itemsParams: params,
    mapRow: (row: Record<string, unknown>) => ({
      ...row,
      isPaid: Boolean(row.isPaid),
      projectStatus: row.projectStatus === 'completed' ? 'completed' : 'open',
    }) as FinanceInvoiceRow,
  };
}

function inAccountPeriodRange(value: string, start: string, end: string): boolean {
  if (!value) return !start && !end;
  const normalized = value.slice(0, 10);
  return (!start || normalized >= start) && (!end || normalized <= end);
}

function invoiceTypeLabel(type: string) {
  return type === 'income' ? 'income' : 'cost';
}
