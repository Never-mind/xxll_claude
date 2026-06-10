import { Inject, Injectable } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { CustomerService } from '../customer/customer.service.js';
import { workbookBufferFromSheets } from '../../common/excel-utils.js';
import { HistoryQuotationService } from '../history-quotation/history-quotation.service.js';
import { ProductService } from '../product/product.service.js';
import { SettlementProjectService } from '../settlement-project/settlement-project.service.js';
import { TariffRateService } from '../tariff-rate/tariff-rate.service.js';
import type { CreateQuotationDto, PageResult, Quotation, QuotationDetail, QuotationItem } from '../../../shared/api.interface.js';
import { formalQuotationInputFromSaved, writeFormalQuotationWorkbook } from '../../../shared/formal-quotation-export.js';
import { calculateQuotation } from './quotation-calculator.js';

const QUOTATION_FILE = 'quotations.xlsx';
const ITEM_FILE = 'quotation_items.xlsx';

@Injectable()
export class QuotationService {
  constructor(
    @Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService,
    @Inject(ProductService) private readonly products: ProductService,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(TariffRateService) private readonly tariffs: TariffRateService,
    @Inject(HistoryQuotationService) private readonly history: HistoryQuotationService,
    @Inject(SettlementProjectService) private readonly settlements: SettlementProjectService,
  ) {}

  async list(page = 1, pageSize = 10, status?: string): Promise<PageResult<Quotation>> {
    const all = await this.storage.readTable<Quotation>(QUOTATION_FILE);
    const filtered = (status && status !== 'all' ? all.filter((item) => item.status === status) : all)
      .sort((left, right) => Date.parse(right.createdAt || right.updatedAt || '') - Date.parse(left.createdAt || left.updatedAt || ''));
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));
    const safePage = Math.max(1, Number(page) || 1);
    return {
      items: filtered.slice((safePage - 1) * safePageSize, safePage * safePageSize),
      total: filtered.length,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async detail(id: string): Promise<QuotationDetail> {
    const quotation = (await this.storage.query<Quotation>(QUOTATION_FILE, { id })).at(0);
    if (!quotation) throw new Error(`Quotation ${id} not found`);
    const items = await this.storage.query<QuotationItem>(ITEM_FILE, { quotationId: id });
    return { quotation, items: await this.withHistoricalDdpQuotes(quotation, items) };
  }

  async items(id: string, page = 1, pageSize = 10): Promise<PageResult<QuotationItem>> {
    return this.storage.paginate<QuotationItem>(ITEM_FILE, page, pageSize, { quotationId: id });
  }

  async itemsForEdit(id: string): Promise<QuotationItem[]> {
    return this.storage.query<QuotationItem>(ITEM_FILE, { quotationId: id });
  }

  async create(dto: CreateQuotationDto): Promise<QuotationDetail> {
    const customer = dto.customerId ? await this.customers.findById(dto.customerId) : undefined;
    if (!customer) throw new Error('Please select an archived customer');
    const calculated = calculateQuotation(dto, await this.products.all(), await this.tariffs.all());
    const quotation = await this.storage.insert<Quotation>(QUOTATION_FILE, {
      ...calculated.quotation,
      customerId: customer.id,
      customerName: customer.name,
      quotationNo: await this.nextQuotationNo(),
    });
    const items: QuotationItem[] = [];
    for (const item of calculated.items) {
      items.push(await this.storage.insert<QuotationItem>(ITEM_FILE, { ...item, quotationId: quotation.id }));
    }
    if (quotation.status === 'completed') {
      await this.syncHistory(quotation, items);
      await this.settlements.ensureForQuotation(quotation, items);
    }
    return { quotation, items };
  }

  async update(id: string, dto: CreateQuotationDto): Promise<QuotationDetail> {
    const existing = await this.detail(id);
    if (existing.quotation.status === 'completed') throw new Error('Completed quotations cannot be edited');
    const customer = dto.customerId ? await this.customers.findById(dto.customerId) : undefined;
    if (!customer) throw new Error('Please select an archived customer');
    const calculated = calculateQuotation(dto, await this.products.all(), await this.tariffs.all());
    const quotation = await this.storage.update<Quotation>(QUOTATION_FILE, id, {
      ...calculated.quotation,
      customerId: customer.id,
      customerName: customer.name,
      quotationNo: existing.quotation.quotationNo,
    });
    for (const item of existing.items) await this.storage.delete(ITEM_FILE, item.id);
    const items: QuotationItem[] = [];
    for (const item of calculated.items) {
      items.push(await this.storage.insert<QuotationItem>(ITEM_FILE, { ...item, quotationId: quotation.id }));
    }
    if (quotation.status === 'completed') {
      await this.syncHistory(quotation, items);
      await this.settlements.ensureForQuotation(quotation, items);
    }
    return { quotation, items };
  }

  async remove(id: string): Promise<void> {
    for (const item of await this.storage.query<QuotationItem>(ITEM_FILE, { quotationId: id })) {
      await this.storage.delete(ITEM_FILE, item.id);
    }
    await this.storage.delete(QUOTATION_FILE, id);
  }

  async export(id: string): Promise<Buffer> {
    const detail = await this.detail(id);
    return workbookBufferFromSheets({
      报价参数: quotationParamRows(detail.quotation),
      报价明细: quotationItemRows(detail.items, detail.quotation.exchangeRateUsd),
    });
  }

  async exportList(status?: string): Promise<Buffer> {
    const rows = await this.list(1, 50, status);
    return workbookBufferFromSheets({ 报价列表: rows.items.map(quotationListRow) });
  }

  async exportFormalQuotation(id: string): Promise<Buffer> {
    const detail = await this.detail(id);
    const products = await this.products.all();
    const customer = detail.quotation.customerId ? await this.customers.findById(detail.quotation.customerId) : undefined;
    return writeFormalQuotationWorkbook(
      formalQuotationInputFromSaved(detail.quotation, detail.items, products, customer?.contactName),
      'buffer',
    ) as Buffer;
  }

  private async nextQuotationNo(): Promise<string> {
    const prefix = `QTN-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
    const rows = await this.storage.readTable<Quotation>(QUOTATION_FILE);
    const count = rows.filter((row) => row.quotationNo?.startsWith(prefix)).length + 1;
    return `${prefix}-${String(count).padStart(3, '0')}`;
  }

  private async syncHistory(quotation: Quotation, items: QuotationItem[]): Promise<void> {
    const products = await this.products.all();
    for (const item of items) {
      const product = products.find((candidate) => candidate.id === item.productId);
      await this.history.create({
        quotationDate: new Date().toISOString(),
        customerName: quotation.customerName || '未知客户',
        productCode: item.productCode,
        productName: item.productName,
        spec: product?.spec,
        brand: product?.brand,
        transportType: item.transportType,
        customerPriceUsd: item.revenueUsd,
      });
    }
  }

  private async withHistoricalDdpQuotes(quotation: Quotation, items: QuotationItem[]): Promise<QuotationItem[]> {
    const customerName = (quotation.customerName || '').trim();
    if (!customerName || !items.length) return items.map((item) => ({ ...item, historicalDdpQuoteUsd: null }));
    const quotationTime = Date.parse(quotation.createdAt || quotation.updatedAt || '');
    const history = (await this.history.all())
      .filter((row) => {
        const sameCustomer = row.customerName?.trim() === customerName;
        const beforeCurrent = Number.isFinite(quotationTime)
          ? Date.parse(row.quotationDate || row.createdAt || '') < quotationTime
          : true;
        return sameCustomer && beforeCurrent;
      })
      .sort((left, right) => Date.parse(right.quotationDate || right.createdAt || '') - Date.parse(left.quotationDate || left.createdAt || ''));

    return items.map((item) => {
      const matched = history.find((row) =>
        row.productCode === item.productCode || row.productName === item.productName,
      );
      return {
        ...item,
        historicalDdpQuoteUsd: matched ? Number(matched.customerPriceUsd || 0) : null,
      };
    });
  }
}

function quotationListRow(quotation: Quotation) {
  return {
    报价单号: quotation.quotationNo,
    客户: quotation.customerName || '',
    项目名称: quotation.remark || '',
    状态: quotation.status,
    'CIF(USD)': quotation.totalCifUsd,
    '到仓总价（USD）': quotation.totalDdpUsd,
    '收入(USD)': quotation.totalRevenueUsd,
    '利润(USD)': quotation.totalProfitUsd,
    毛利率: `${Number(quotation.grossMarginRate || 0).toFixed(2)}%`,
    创建时间: quotation.createdAt,
  };
}

function quotationParamRows(quotation: Quotation) {
  const fields: Array<[keyof Quotation, string]> = [
    ['exchangeRateUsd', 'USD汇率'],
    ['exchangeRateMxn', '比索兑美元汇率'],
    ['capitalCostRate', '资金成本率(%)'],
    ['accountPeriod', '账期(月)'],
    ['badDebtRate', '坏账率(%)'],
    ['customsFeeRate', '清关手续费率(%)'],
    ['vatOverseas', '海外增值税率(%)'],
    ['markupRate', '加价率(%)'],
    ['seaFreightRate', '海运费（CNY/方）'],
    ['airFreightRate', '空运费（CNY/kg）'],
    ['nomFee', 'NOM费(USD)'],
    ['customsMiscFee', '清关杂费'],
    ['lastMileFee', '尾程费'],
    ['storageOperationFee', '仓储操作费'],
    ['implementationFee', '实施费'],
    ['publicFeeTotal', '公共费用总计'],
    ['customerName', '客户名称'],
    ['remark', '项目名称'],
  ];
  return fields.map(([key, label]) => ({ 参数名: label, 值: quotation[key] ?? '' }));
}

function quotationItemRows(items: QuotationItem[], exchangeRateUsd: number) {
  return items.map((item) => ({
    产品编码: item.productCode,
    产品名称: item.productName,
    数量: Math.trunc(Number(item.purchaseQty || 0)),
    '采购单价(CNY)': item.purchasePriceCny,
    '不含税采购单价(CNY)': safeDivide(item.totalExclTaxCny, item.purchaseQty),
    '采购总价(CNY)': item.totalTaxIncludedCny,
    '不含税采购总价(CNY)': item.totalExclTaxCny,
    运输方式: item.transportType,
    清关: item.isCustomsClearance ? '是' : '否',
    NOM认证: item.enableNom ? '是' : '否',
    '头程运费（USD）': safeDivide(item.firstMileFreightCny, exchangeRateUsd),
    'CIF(USD)': item.cifUsd,
    '关税税率(%)': item.igiTaxRate,
    '关税金额(USD)': item.tariffUsd,
    '资金成本(USD)': item.capitalCostUsd,
    '清关手续费(USD)': item.customsFeeUsd,
    'NOM认证费(USD)': item.nomFeeUsd,
    '到仓总价（USD）': item.ddpTotalUsd,
    '到仓单价(USD)': item.ddpUnitPriceUsd,
    '加成比例(%)': item.markupRate,
    '历史DDP不含税报价（USD）': item.historicalDdpQuoteUsd == null ? '无历史报价' : item.historicalDdpQuoteUsd,
    'DDP不含税单价(USD)': item.ddpQuoteUnitUsd ?? safeDivide(item.revenueUsd, item.purchaseQty),
    'DDP不含税总价(USD)': item.revenueUsd,
    '利润(USD)': item.operatingProfitUsd,
    毛利率: `${Number(item.grossMarginRate || 0).toFixed(2)}%`,
  }));
}

function safeDivide(value: number, divisor: number) {
  return divisor ? value / divisor : 0;
}
