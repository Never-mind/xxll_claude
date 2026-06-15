import { read, utils } from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { SettlementInvoice, SettlementProject } from '../../../shared/api.interface.js';
import { FinanceService } from './finance.service.js';

const projects: SettlementProject[] = [
  {
    id: 'project-1',
    quotationId: 'quotation-1',
    quotationNo: 'Q-001',
    customerName: '客户A',
    remark: '项目A',
    status: 'open',
    purchaseCostUsd: 0,
    purchasedCostUsd: 0,
    salesRevenueUsd: 0,
    receivedRevenueUsd: 0,
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
  },
];

const invoices: SettlementInvoice[] = [
  invoice('invoice-1', '2026-06-01', 'income'),
  invoice('invoice-2', '2026-07-01', 'cost'),
];

describe('FinanceService invoices', () => {
  it('filters invoices by account period range', async () => {
    const service = new FinanceService(storageMock());

    const result = await service.invoices(1, 10, '', '', '2026-06-15', '2026-07-31');

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe('invoice-2');
  });

  it('exports the filtered invoice rows', async () => {
    const service = new FinanceService(storageMock());

    const buffer = await service.exportInvoices('', 'income', '2026-06-01', '2026-06-30');
    const workbook = read(buffer, { type: 'buffer' });
    const rows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets['发票明细']);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.账期).toBe('2026-06-01');
    expect(rows[0]?.是否支付).toBe('否');
  });
});

function storageMock() {
  return {
    readTable: async (file: string) => file === 'settlement_projects.xlsx' ? projects : invoices,
  } as never;
}

function invoice(id: string, accountPeriod: string, type: 'income' | 'cost'): SettlementInvoice {
  return {
    id,
    projectId: 'project-1',
    type,
    accountPeriod,
    invoiceEntity: '主体',
    invoiceDate: accountPeriod,
    invoiceNo: id,
    invoiceTotal: 100,
    invoiceTaxExcludedTotal: 100,
    taxRate: 0,
    invoiceTaxAmount: 0,
    currency: 'USD',
    exchangeRate: 1,
    usdAmount: type === 'cost' ? -100 : 100,
    isPaid: false,
    createdAt: accountPeriod,
    updatedAt: accountPeriod,
  };
}
