import { describe, expect, it } from 'vitest';
import type { CreateSettlementInvoiceDto } from '../../../shared/api.interface.js';
import { __testOnlyInvoicePatch } from './settlement-project.service.js';

const baseInvoice: CreateSettlementInvoiceDto = {
  type: 'cost',
  accountPeriod: '2026-06',
  invoiceEntity: '供应商A',
  invoiceDate: '2026-06-12',
  invoiceNo: 'INV-001',
  invoiceTotal: 113,
  invoiceTaxExcludedTotal: 0,
  taxRate: 13,
  invoiceTaxAmount: 0,
  currency: 'CNY',
  exchangeRate: 7,
};

describe('settlement invoice patch', () => {
  it('defaults saved invoices to unpaid', () => {
    const result = __testOnlyInvoicePatch('project-1', baseInvoice);

    expect(result.isPaid).toBe(false);
  });

  it('preserves paid status when updating an invoice', () => {
    const result = __testOnlyInvoicePatch('project-1', { ...baseInvoice, isPaid: true });

    expect(result.isPaid).toBe(true);
  });
});
