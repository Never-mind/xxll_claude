import { Inject, Injectable } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import type { FinanceInvoiceRow, PageResult, SettlementInvoice, SettlementProject } from '../../../shared/api.interface.js';

const PROJECT_FILE = 'settlement_projects.xlsx';
const INVOICE_FILE = 'settlement_invoices.xlsx';

@Injectable()
export class FinanceService {
  constructor(@Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService) {}

  async invoices(page = 1, pageSize = 10, keyword = '', type = ''): Promise<PageResult<FinanceInvoiceRow>> {
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
      .filter((row) => !normalizedKeyword || [
        row.quotationNo,
        row.customerName,
        row.projectName,
        row.invoiceEntity,
        row.invoiceNo,
        row.accountPeriod,
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedKeyword)))
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));
    return {
      items: rows.slice((safePage - 1) * safePageSize, safePage * safePageSize),
      total: rows.length,
      page: safePage,
      pageSize: safePageSize,
    };
  }
}
