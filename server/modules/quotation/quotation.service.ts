import { Inject, Injectable } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { CustomerService } from '../customer/customer.service.js';
import { workbookBufferFromSheets } from '../../common/excel-utils.js';
import { HistoryQuotationService } from '../history-quotation/history-quotation.service.js';
import { ProductService } from '../product/product.service.js';
import { TariffRateService } from '../tariff-rate/tariff-rate.service.js';
import type { CreateQuotationDto, PageResult, Quotation, QuotationDetail, QuotationItem } from '../../../shared/api.interface.js';
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
  ) {}

  async list(page = 1, pageSize = 10, status?: string): Promise<PageResult<Quotation>> {
    const all = await this.storage.readTable<Quotation>(QUOTATION_FILE);
    const filtered = status && status !== 'all' ? all.filter((item) => item.status === status) : all;
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
    return { quotation, items };
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
    if (quotation.status === 'completed') await this.syncHistory(quotation, items);
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
    if (quotation.status === 'completed') await this.syncHistory(quotation, items);
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
      报价参数: Object.entries(detail.quotation).map(([参数名, 值]) => ({ 参数名, 值 })),
      报价明细: detail.items,
    });
  }

  async exportList(status?: string): Promise<Buffer> {
    const rows = await this.list(1, 50, status);
    return workbookBufferFromSheets({ quotations: rows.items });
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
}
