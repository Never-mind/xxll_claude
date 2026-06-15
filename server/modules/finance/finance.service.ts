import { Inject, Injectable } from '@nestjs/common';
import { workbookBufferFromSheets } from '../../common/excel-utils.js';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import type { FinanceInvoiceRow, PageResult, SettlementInvoice, SettlementProject } from '../../../shared/api.interface.js';

const PROJECT_FILE = 'settlement_projects.xlsx';
const INVOICE_FILE = 'settlement_invoices.xlsx';

@Injectable()
export class FinanceService {
  constructor(@Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService) {}

  async invoices(page = 1, pageSize = 10, keyword = '', type = '', accountPeriodStart = '', accountPeriodEnd = ''): Promise<PageResult<FinanceInvoiceRow>> {
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
      发票明细: rows.map((row) => ({
        报价单号: row.quotationNo,
        客户: row.customerName,
        项目名称: row.projectName,
        项目状态: row.projectStatus === 'completed' ? '已完成' : '进行中',
        类型: invoiceTypeLabel(row.type),
        账期: row.accountPeriod || '',
        发票主体: row.invoiceEntity || '',
        发票日期: row.invoiceDate || '',
        发票号: row.invoiceNo || '',
        发票总额: row.invoiceTotal,
        发票不含税总额: row.invoiceTaxExcludedTotal,
        '税率(%)': row.taxRate,
        发票税金: row.invoiceTaxAmount,
        发票币种: row.currency,
        发票汇率: row.exchangeRate,
        美金金额: row.usdAmount,
        是否支付: row.isPaid ? '是' : '否',
      })),
    });
  }

  private async filteredInvoices(keyword = '', type = '', accountPeriodStart = '', accountPeriodEnd = ''): Promise<FinanceInvoiceRow[]> {
    const [projects, invoices] = await Promise.all([
      this.storage.readTable<SettlementProject>(PROJECT_FILE),
      this.storage.readTable<SettlementInvoice>(INVOICE_FILE),
    ]);
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const normalizedKeyword = keyword.trim().toLowerCase();
    const rows = invoices
      .map((invoice) => {
        const project = projectById.get(invoice.projectId);
        return {
          ...invoice,
          quotationNo: project?.quotationNo || '',
          customerName: project?.customerName || '',
          projectName: project?.remark || '',
          projectStatus: project?.status || 'open',
        } satisfies FinanceInvoiceRow;
      })
      .filter((row) => !type || row.type === type)
      .filter((row) => inAccountPeriodRange(row.accountPeriod || '', accountPeriodStart, accountPeriodEnd))
      .filter((row) => !normalizedKeyword || [
        row.quotationNo,
        row.customerName,
        row.projectName,
        row.invoiceEntity,
        row.invoiceNo,
        row.accountPeriod,
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedKeyword)))
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
    return rows;
  }
}

function inAccountPeriodRange(value: string, start: string, end: string): boolean {
  if (!value) return !start && !end;
  const normalized = value.slice(0, 10);
  return (!start || normalized >= start) && (!end || normalized <= end);
}

function invoiceTypeLabel(type: string) {
  return type === 'income' ? '收入' : '成本';
}
