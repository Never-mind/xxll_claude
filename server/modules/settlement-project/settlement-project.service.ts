import { Inject, Injectable } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { workbookBufferFromSheets } from '../../common/excel-utils.js';
import type {
  CreateSettlementExpenseDto,
  CreateSettlementAttachmentDto,
  CreateSettlementInvoiceDto,
  CreateSettlementSaleDto,
  PageResult,
  Quotation,
  QuotationItem,
  SettlementAttachment,
  SettlementExpense,
  SettlementInvoice,
  SettlementItem,
  SettlementOrderDto,
  SettlementOrderItemDto,
  SettlementProject,
  SettlementProjectDetail,
  SettlementSale,
  UpdateSettlementItemDto,
  UpdateSettlementExpenseDto,
  UpdateSettlementInvoiceDto,
  UpdateSettlementSaleDto,
} from '../../../shared/api.interface.js';

const PROJECT_FILE = 'settlement_projects.xlsx';
const ITEM_FILE = 'settlement_items.xlsx';
const EXPENSE_FILE = 'settlement_expenses.xlsx';
const SALE_FILE = 'settlement_sales.xlsx';
const INVOICE_FILE = 'settlement_invoices.xlsx';
const ATTACHMENT_FILE = 'settlement_attachments.xlsx';
const QUOTATION_FILE = 'quotations.xlsx';

@Injectable()
export class SettlementProjectService {
  constructor(@Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService) {}

  async list(page = 1, pageSize = 10, keyword = ''): Promise<PageResult<SettlementProject>> {
    await this.recalculateAllProjects();
    const rows = await this.enrichedProjects();
    const normalizedKeyword = keyword.trim().toLowerCase();
    const filtered = normalizedKeyword
      ? rows.filter((row) =>
          [row.quotationNo, row.customerName].some((value) => String(value ?? '').toLowerCase().includes(normalizedKeyword)),
        )
      : rows;
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));
    return {
      items: filtered.slice((safePage - 1) * safePageSize, safePage * safePageSize),
      total: filtered.length,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async detail(id: string): Promise<SettlementProjectDetail> {
    await this.recalculate(id);
    const project = (await this.enrichedProjects()).find((item) => item.id === id);
    if (!project) throw new Error(`Settlement project ${id} not found`);
    const items = await this.storage.query<SettlementItem>(ITEM_FILE, { projectId: id });
    const expenses = await this.storage.query<SettlementExpense>(EXPENSE_FILE, { projectId: id });
    const sales = await this.storage.query<SettlementSale>(SALE_FILE, { projectId: id });
    const invoices = await this.storage.query<SettlementInvoice>(INVOICE_FILE, { projectId: id });
    const attachments = await this.storage.query<SettlementAttachment>(ATTACHMENT_FILE, { projectId: id });
    return {
      project,
      items,
      unpurchasedItems: items.filter((item) => !item.ordered),
      purchasedItems: items.filter((item) => item.ordered),
      expenses,
      sales,
      invoices,
      attachments,
    };
  }

  async ensureForQuotation(quotation: Quotation, quotationItems: QuotationItem[]): Promise<SettlementProject> {
    if (quotation.status !== 'completed') throw new Error('Only completed quotations can create settlement projects');
    const existing = (await this.storage.query<SettlementProject>(PROJECT_FILE, { quotationId: quotation.id })).at(0);
    if (existing) {
      await this.ensureMissingItems(existing, quotationItems);
      return this.recalculate(existing.id);
    }

    const project = await this.storage.insert<SettlementProject>(PROJECT_FILE, {
      quotationId: quotation.id,
      quotationNo: quotation.quotationNo,
      customerName: quotation.customerName,
      remark: quotation.remark,
      exchangeRateUsd: quotation.exchangeRateUsd,
      exchangeRateMxn: quotation.exchangeRateMxn,
      quotedPurchaseCostUsd: sum(quotationItems, (item) => item.ddpTotalUsd),
      purchasedCostUsd: 0,
      quotedSalesRevenueUsd: sum(quotationItems, (item) => item.revenueUsd),
      receivedRevenueUsd: 0,
      grossProfitUsd: 0,
      status: 'open',
    });

    for (const item of quotationItems) {
      await this.createItem(project.id, item);
    }
    return this.recalculate(project.id);
  }

  async orderItems(projectId: string, dto: SettlementOrderDto): Promise<SettlementProjectDetail> {
    const detail = await this.detail(projectId);
    const byId = new Map(detail.items.map((item) => [item.id, item]));
    for (const orderItem of dto.items) {
      const existing = byId.get(orderItem.itemId);
      if (!existing || existing.ordered) continue;
      const purchasedCostUsd = this.calculatePurchasedCost(orderItem, detail.project);
      await this.storage.update<SettlementItem>(ITEM_FILE, existing.id, {
        purchaseQty: Math.trunc(Number(orderItem.purchaseQty || 0)),
        purchaseUnitPrice: Number(orderItem.purchaseUnitPrice || 0),
        currency: orderItem.currency,
        priceType: orderItem.priceType,
        taxRate: Number(orderItem.taxRate || 0),
        purchasedCostUsd,
        receivedRevenueUsd: 0,
        invoiceNo: orderItem.invoiceNo || '',
        ordered: true,
        orderedAt: new Date().toISOString(),
      });
    }
    await this.recalculate(projectId);
    return this.detail(projectId);
  }

  async returnPurchasedItem(projectId: string, itemId: string): Promise<SettlementProjectDetail> {
    const detail = await this.detail(projectId);
    const existing = detail.items.find((item) => item.id === itemId);
    if (!existing) throw new Error(`Settlement item ${itemId} not found`);
    await this.storage.update<SettlementItem>(ITEM_FILE, itemId, {
      purchasedCostUsd: 0,
      receivedRevenueUsd: 0,
      ordered: false,
      orderedAt: '',
    });
    await this.recalculate(projectId);
    return this.detail(projectId);
  }

  async updatePurchasedItem(projectId: string, itemId: string, dto: UpdateSettlementItemDto): Promise<SettlementProjectDetail> {
    const detail = await this.detail(projectId);
    const existing = detail.items.find((item) => item.id === itemId);
    if (!existing || !existing.ordered) throw new Error(`Settlement item ${itemId} not found`);
    await this.storage.update<SettlementItem>(ITEM_FILE, itemId, {
      purchaseQty: Math.trunc(Number(dto.purchaseQty || 0)),
      purchaseUnitPrice: Number(dto.purchaseUnitPrice || 0),
      currency: dto.currency,
      priceType: dto.priceType,
      taxRate: Number(dto.taxRate || 0),
      purchasedCostUsd: this.calculatePurchasedCost(dto, detail.project),
      invoiceNo: dto.invoiceNo || '',
    });
    await this.recalculate(projectId);
    return this.detail(projectId);
  }

  async addExpense(projectId: string, dto: CreateSettlementExpenseDto): Promise<SettlementProjectDetail> {
    const project = (await this.storage.query<SettlementProject>(PROJECT_FILE, { id: projectId })).at(0);
    if (!project) throw new Error(`Settlement project ${projectId} not found`);
    await this.storage.insert<SettlementExpense>(EXPENSE_FILE, {
      projectId,
      type: dto.type,
      description: dto.description || '',
      amount: Number(dto.amount || 0),
      currency: dto.currency,
      priceType: dto.priceType,
      taxRate: Number(dto.taxRate || 0),
      costUsd: this.calculateTaxExcludedAmountUsd(dto, project),
      invoiceNo: dto.invoiceNo || '',
    });
    await this.recalculate(projectId);
    return this.detail(projectId);
  }

  async updateExpense(projectId: string, expenseId: string, dto: UpdateSettlementExpenseDto): Promise<SettlementProjectDetail> {
    const project = (await this.storage.query<SettlementProject>(PROJECT_FILE, { id: projectId })).at(0);
    if (!project) throw new Error(`Settlement project ${projectId} not found`);
    await this.assertProjectRecord(EXPENSE_FILE, expenseId, projectId, 'Settlement expense');
    await this.storage.update<SettlementExpense>(EXPENSE_FILE, expenseId, {
      type: dto.type,
      description: dto.description || '',
      amount: Number(dto.amount || 0),
      currency: dto.currency,
      priceType: dto.priceType,
      taxRate: Number(dto.taxRate || 0),
      costUsd: this.calculateTaxExcludedAmountUsd(dto, project),
      invoiceNo: dto.invoiceNo || '',
    });
    await this.recalculate(projectId);
    return this.detail(projectId);
  }

  async deleteExpense(projectId: string, expenseId: string): Promise<SettlementProjectDetail> {
    await this.assertProjectRecord(EXPENSE_FILE, expenseId, projectId, 'Settlement expense');
    await this.storage.delete(EXPENSE_FILE, expenseId);
    await this.recalculate(projectId);
    return this.detail(projectId);
  }

  async addSale(projectId: string, dto: CreateSettlementSaleDto): Promise<SettlementProjectDetail> {
    const project = (await this.storage.query<SettlementProject>(PROJECT_FILE, { id: projectId })).at(0);
    if (!project) throw new Error(`Settlement project ${projectId} not found`);
    await this.storage.insert<SettlementSale>(SALE_FILE, {
      projectId,
      description: dto.description || '',
      amount: Number(dto.amount || 0),
      currency: dto.currency,
      priceType: dto.priceType,
      taxRate: Number(dto.taxRate || 0),
      receivedRevenueUsd: this.calculateTaxExcludedAmountUsd(dto, project),
      invoiceNo: dto.invoiceNo || '',
      receivedAt: dto.receivedAt || new Date().toISOString(),
    });
    await this.recalculate(projectId);
    return this.detail(projectId);
  }

  async updateSale(projectId: string, saleId: string, dto: UpdateSettlementSaleDto): Promise<SettlementProjectDetail> {
    const project = (await this.storage.query<SettlementProject>(PROJECT_FILE, { id: projectId })).at(0);
    if (!project) throw new Error(`Settlement project ${projectId} not found`);
    await this.assertProjectRecord(SALE_FILE, saleId, projectId, 'Settlement sale');
    await this.storage.update<SettlementSale>(SALE_FILE, saleId, {
      description: dto.description || '',
      amount: Number(dto.amount || 0),
      currency: dto.currency,
      priceType: dto.priceType,
      taxRate: Number(dto.taxRate || 0),
      receivedRevenueUsd: this.calculateTaxExcludedAmountUsd(dto, project),
      invoiceNo: dto.invoiceNo || '',
      receivedAt: dto.receivedAt || new Date().toISOString(),
    });
    await this.recalculate(projectId);
    return this.detail(projectId);
  }

  async deleteSale(projectId: string, saleId: string): Promise<SettlementProjectDetail> {
    await this.assertProjectRecord(SALE_FILE, saleId, projectId, 'Settlement sale');
    await this.storage.delete(SALE_FILE, saleId);
    await this.recalculate(projectId);
    return this.detail(projectId);
  }

  async addInvoice(projectId: string, dto: CreateSettlementInvoiceDto): Promise<SettlementProjectDetail> {
    const project = (await this.storage.query<SettlementProject>(PROJECT_FILE, { id: projectId })).at(0);
    if (!project) throw new Error(`Settlement project ${projectId} not found`);
    await this.storage.insert<SettlementInvoice>(INVOICE_FILE, this.invoicePatch(projectId, dto));
    return this.detail(projectId);
  }

  async updateInvoice(projectId: string, invoiceId: string, dto: UpdateSettlementInvoiceDto): Promise<SettlementProjectDetail> {
    await this.assertProjectRecord(INVOICE_FILE, invoiceId, projectId, 'Settlement invoice');
    await this.storage.update<SettlementInvoice>(INVOICE_FILE, invoiceId, this.invoicePatch(projectId, dto));
    return this.detail(projectId);
  }

  async deleteInvoice(projectId: string, invoiceId: string): Promise<SettlementProjectDetail> {
    await this.assertProjectRecord(INVOICE_FILE, invoiceId, projectId, 'Settlement invoice');
    await this.storage.delete(INVOICE_FILE, invoiceId);
    return this.detail(projectId);
  }

  async addAttachment(projectId: string, dto: CreateSettlementAttachmentDto): Promise<SettlementProjectDetail> {
    const project = (await this.storage.query<SettlementProject>(PROJECT_FILE, { id: projectId })).at(0);
    if (!project) throw new Error(`Settlement project ${projectId} not found`);
    await this.storage.insert<SettlementAttachment>(ATTACHMENT_FILE, {
      projectId,
      fileName: dto.fileName,
      fileType: dto.fileType || '',
      fileSize: Number(dto.fileSize || 0),
      dataUrl: dto.dataUrl,
      description: dto.description || '',
      uploadedAt: new Date().toISOString(),
    });
    return this.detail(projectId);
  }

  async complete(projectId: string): Promise<SettlementProjectDetail> {
    await this.storage.update<SettlementProject>(PROJECT_FILE, projectId, { status: 'completed' });
    return this.detail(projectId);
  }

  async remove(projectId: string): Promise<void> {
    await this.deleteProjectChildren(projectId);
    await this.storage.delete(PROJECT_FILE, projectId);
  }

  async exportList(): Promise<Buffer> {
    const rows = await this.enrichedProjects();
    return workbookBufferFromSheets({ 项目结算: rows.map(settlementProjectListRow) });
  }

  async export(id: string): Promise<Buffer> {
    const detail = await this.detail(id);
    return workbookBufferFromSheets({
      项目结算详情: [settlementProjectListRow(detail.project)],
      未采购商品: detail.unpurchasedItems.map((item) => settlementItemRow(item, detail.project)),
      已采购商品: detail.purchasedItems.map((item) => settlementItemRow(item, detail.project)),
      其他成本费用: detail.expenses.map((expense) => settlementExpenseRow(expense, detail.project)),
      销售收入明细: detail.sales.map((sale) => settlementSaleRow(sale, detail.project)),
      发票管理: detail.invoices.map(settlementInvoiceRow),
      附件管理: detail.attachments.map(settlementAttachmentRow),
    });
  }

  private async ensureMissingItems(project: SettlementProject, quotationItems: QuotationItem[]): Promise<void> {
    const existingItems = await this.storage.query<SettlementItem>(ITEM_FILE, { projectId: project.id });
    const existingQuotationItemIds = new Set(existingItems.map((item) => item.quotationItemId));
    for (const item of quotationItems) {
      if (!existingQuotationItemIds.has(item.id)) await this.createItem(project.id, item);
    }
  }

  private async deleteProjectChildren(projectId: string): Promise<void> {
    const [items, expenses, sales, invoices, attachments] = await Promise.all([
      this.storage.query<SettlementItem>(ITEM_FILE, { projectId }),
      this.storage.query<SettlementExpense>(EXPENSE_FILE, { projectId }),
      this.storage.query<SettlementSale>(SALE_FILE, { projectId }),
      this.storage.query<SettlementInvoice>(INVOICE_FILE, { projectId }),
      this.storage.query<SettlementAttachment>(ATTACHMENT_FILE, { projectId }),
    ]);
    for (const item of items) await this.storage.delete(ITEM_FILE, item.id);
    for (const expense of expenses) await this.storage.delete(EXPENSE_FILE, expense.id);
    for (const sale of sales) await this.storage.delete(SALE_FILE, sale.id);
    for (const invoice of invoices) await this.storage.delete(INVOICE_FILE, invoice.id);
    for (const attachment of attachments) await this.storage.delete(ATTACHMENT_FILE, attachment.id);
  }

  private async assertProjectRecord<T extends { projectId: string }>(
    fileName: string,
    id: string,
    projectId: string,
    label: string,
  ): Promise<T> {
    const record = (await this.storage.query<T>(fileName, { id } as unknown as Partial<T>)).at(0);
    if (!record || record.projectId !== projectId) throw new Error(`${label} ${id} not found`);
    return record;
  }

  private async enrichedProjects(): Promise<SettlementProject[]> {
    const [projects, quotations] = await Promise.all([
      this.storage.readTable<SettlementProject>(PROJECT_FILE),
      this.storage.readTable<Quotation>(QUOTATION_FILE),
    ]);
    return projects.map((project) => ({
      ...project,
      remark: project.remark || quotations.find((quotation) => quotation.id === project.quotationId)?.remark || '',
    }));
  }

  private async recalculateAllProjects(): Promise<void> {
    const projects = await this.storage.readTable<SettlementProject>(PROJECT_FILE);
    for (const project of projects) {
      await this.recalculate(project.id);
    }
  }

  private async createItem(projectId: string, item: QuotationItem): Promise<SettlementItem> {
    return this.storage.insert<SettlementItem>(ITEM_FILE, {
      projectId,
      quotationItemId: item.id,
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      brand: item.brand || '',
      plannedQty: item.purchaseQty,
      purchaseQty: item.purchaseQty,
      purchaseUnitPrice: item.purchasePriceCny,
      currency: 'CNY',
      priceType: 'tax_included',
      taxRate: 13,
      quotedWarehouseCostUsd: item.ddpTotalUsd,
      quotedSalesRevenueUsd: item.revenueUsd,
      purchasedCostUsd: 0,
      receivedRevenueUsd: 0,
      invoiceNo: '',
      ordered: false,
    });
  }

  private invoicePatch(projectId: string, dto: CreateSettlementInvoiceDto): Omit<SettlementInvoice, 'id' | 'createdAt' | 'updatedAt'> {
    const invoiceTotal = Number(dto.invoiceTotal || 0);
    const taxRate = Number(dto.taxRate || 0);
    const exchangeRate = Number(dto.exchangeRate || 0);
    const invoiceTaxExcludedTotal = taxRate === -100 ? 0 : safeDivide(invoiceTotal, 1 + taxRate / 100);
    const invoiceTaxAmount = invoiceTaxExcludedTotal * (taxRate / 100);
    const unsignedUsdAmount = exchangeRate ? safeDivide(invoiceTaxExcludedTotal, exchangeRate) : 0;
    return {
      projectId,
      type: dto.type,
      accountPeriod: dto.accountPeriod || '',
      invoiceEntity: dto.invoiceEntity || '',
      invoiceDate: dto.invoiceDate || '',
      invoiceNo: dto.invoiceNo || '',
      invoiceTotal,
      invoiceTaxExcludedTotal: round(invoiceTaxExcludedTotal),
      taxRate,
      invoiceTaxAmount: round(invoiceTaxAmount),
      currency: dto.currency,
      exchangeRate,
      usdAmount: round(dto.type === 'cost' ? -Math.abs(unsignedUsdAmount) : Math.abs(unsignedUsdAmount)),
    };
  }

  private async recalculate(projectId: string): Promise<SettlementProject> {
    const project = (await this.storage.query<SettlementProject>(PROJECT_FILE, { id: projectId })).at(0);
    if (!project) throw new Error(`Settlement project ${projectId} not found`);
    const items = await this.storage.query<SettlementItem>(ITEM_FILE, { projectId });
    const expenses = await this.storage.query<SettlementExpense>(EXPENSE_FILE, { projectId });
    const sales = await this.storage.query<SettlementSale>(SALE_FILE, { projectId });
    const purchasedCostUsd = sum(items.filter((item) => item.ordered), (item) => this.calculatePurchasedCost(item, project))
      + sum(expenses, (item) => this.calculateTaxExcludedAmountUsd(item, project));
    const receivedRevenueUsd = sum(sales, (item) => this.calculateTaxExcludedAmountUsd(item, project));
    return this.storage.update<SettlementProject>(PROJECT_FILE, projectId, {
      quotedPurchaseCostUsd: sum(items, (item) => item.quotedWarehouseCostUsd),
      purchasedCostUsd,
      quotedSalesRevenueUsd: sum(items, (item) => item.quotedSalesRevenueUsd),
      receivedRevenueUsd,
      grossProfitUsd: receivedRevenueUsd - purchasedCostUsd,
      status: project.status || 'open',
    });
  }

  private calculatePurchasedCost(
    item: Pick<SettlementOrderItemDto, 'purchaseQty' | 'purchaseUnitPrice' | 'currency' | 'priceType' | 'taxRate'>,
    project: SettlementProject,
  ): number {
    return this.calculateTaxExcludedAmountUsd({
      amount: Math.trunc(Number(item.purchaseQty || 0)) * Number(item.purchaseUnitPrice || 0),
      currency: item.currency,
      priceType: item.priceType,
      taxRate: item.taxRate,
    }, project);
  }

  private calculateTaxExcludedAmountUsd(item: { amount: number; currency: string; priceType: string; taxRate: number }, project: SettlementProject): number {
    const taxRate = Number(item.taxRate || 0);
    const taxExcludedTotal = item.priceType === 'tax_included'
      ? safeDivide(Number(item.amount || 0), 1 + taxRate / 100)
      : Number(item.amount || 0);
    return round(convertToUsd(taxExcludedTotal, item.currency, project));
  }
}

function convertToUsd(amount: number, currency: string, project: SettlementProject): number {
  if (currency === 'USD') return amount;
  if (currency === 'MXN') return amount * Number(project.exchangeRateMxn || 0);
  return safeDivide(amount, project.exchangeRateUsd);
}

function settlementProjectListRow(project: SettlementProject) {
  return {
    报价单号: project.quotationNo,
    客户: project.customerName || '',
    项目名称: project.remark || '',
    '采购成本(USD)': project.quotedPurchaseCostUsd,
    '已采购成本(USD)': project.purchasedCostUsd,
    '销售收入(USD)': project.quotedSalesRevenueUsd,
    '已销售收入(USD)': project.receivedRevenueUsd,
    '项目毛利(USD)': project.grossProfitUsd,
    状态: project.status === 'completed' ? '已完成' : '进行中',
  };
}

function settlementItemRow(item: SettlementItem, project: SettlementProject) {
  const amounts = settlementAmounts(
    Math.trunc(Number(item.purchaseQty || 0)) * Number(item.purchaseUnitPrice || 0),
    item.currency,
    item.priceType,
    item.taxRate,
    project,
  );
  return {
    产品编码: item.productCode,
    产品名称: item.productName,
    品牌: item.brand || '',
    报价数量: Math.trunc(Number(item.plannedQty || 0)),
    采购数量: Math.trunc(Number(item.purchaseQty || 0)),
    采购单价: item.purchaseUnitPrice,
    采购总价: Math.trunc(Number(item.purchaseQty || 0)) * Number(item.purchaseUnitPrice || 0),
    币种: item.currency,
    价格方式: priceTypeLabel(item.priceType),
    '税率(%)': item.taxRate,
    '不含税采购金额（USD）': amounts.taxExcludedUsd,
    '含税采购金额（USD）': amounts.taxIncludedUsd,
    发票号: item.invoiceNo || '',
  };
}

function settlementExpenseRow(expense: SettlementExpense, project: SettlementProject) {
  const amounts = settlementAmounts(expense.amount, expense.currency, expense.priceType, expense.taxRate, project);
  return {
    费用类型: expenseLabel(expense.type),
    说明: expense.description || '',
    金额: expense.amount,
    币种: expense.currency,
    价格方式: priceTypeLabel(expense.priceType),
    '税率(%)': expense.taxRate,
    '不含税成本（USD）': amounts.taxExcludedUsd,
    '含税成本（USD）': amounts.taxIncludedUsd,
    发票号: expense.invoiceNo || '',
  };
}

function settlementSaleRow(sale: SettlementSale, project: SettlementProject) {
  const amounts = settlementAmounts(sale.amount, sale.currency, sale.priceType, sale.taxRate, project);
  return {
    收入说明: sale.description || '',
    金额: sale.amount,
    币种: sale.currency,
    价格方式: priceTypeLabel(sale.priceType),
    '税率(%)': sale.taxRate,
    '不含税销售收入（USD）': amounts.taxExcludedUsd,
    '含税销售收入（USD）': amounts.taxIncludedUsd,
    发票号: sale.invoiceNo || '',
    收款日期: sale.receivedAt || '',
  };
}

function settlementInvoiceRow(invoice: SettlementInvoice) {
  return {
    类型: invoice.type === 'income' ? '收入' : '成本',
    账期: invoice.accountPeriod || '',
    发票主体: invoice.invoiceEntity || '',
    发票日期: invoice.invoiceDate || '',
    发票号: invoice.invoiceNo || '',
    发票总额: invoice.invoiceTotal,
    发票不含税总额: invoice.invoiceTaxExcludedTotal,
    '税率(%)': invoice.taxRate,
    发票税金: invoice.invoiceTaxAmount,
    发票币种: invoice.currency,
    发票汇率: invoice.exchangeRate,
    美金金额: invoice.usdAmount,
  };
}

function settlementAttachmentRow(attachment: SettlementAttachment) {
  return {
    文件名: attachment.fileName,
    类型: attachment.fileType || '',
    大小: attachment.fileSize,
    说明: attachment.description || '',
    上传时间: attachment.uploadedAt,
  };
}

function settlementAmounts(amount: number, currency: string, priceType: string, taxRate: number, project: SettlementProject) {
  const rate = Number(taxRate || 0) / 100;
  const taxExcluded = priceType === 'tax_included' ? safeDivide(Number(amount || 0), 1 + rate) : Number(amount || 0);
  const taxIncluded = priceType === 'tax_included' ? Number(amount || 0) : Number(amount || 0) * (1 + rate);
  return {
    taxExcludedUsd: round(convertToUsd(taxExcluded, currency, project)),
    taxIncludedUsd: round(convertToUsd(taxIncluded, currency, project)),
  };
}

function priceTypeLabel(value: string) {
  return value === 'tax_excluded' ? '不含税价' : '含税价';
}

function expenseLabel(type: string) {
  const labels: Record<string, string> = {
    first_mile_freight: '头程运费',
    customs_fee: '清关费',
    labor_fee: '人力费',
    equipment_service_fee: '设备服务费',
    other: '其他',
  };
  return labels[type] || type;
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return round(items.reduce((total, item) => total + Number(pick(item) || 0), 0));
}

function safeDivide(value: number, divisor: number): number {
  return divisor ? value / divisor : 0;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
