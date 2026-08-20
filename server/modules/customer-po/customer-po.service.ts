import { Inject, Injectable } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { CustomerService } from '../customer/customer.service.js';
import { ProductService } from '../product/product.service.js';
import { QuotationService } from '../quotation/quotation.service.js';
import { customerPoToQuotationDraft } from '../../../shared/customer-po.js';
import type {
  CreateCustomerPoDto,
  CreateCustomerPoItemDto,
  CustomerPo,
  CustomerPoDetail,
  CustomerPoItem,
  CustomerPoStatus,
  PageResult,
} from '../../../shared/api.interface.js';

const PO_FILE = 'customer_pos.xlsx';
const ITEM_FILE = 'customer_po_items.xlsx';

@Injectable()
export class CustomerPoService {
  constructor(
    @Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(ProductService) private readonly products: ProductService,
    @Inject(QuotationService) private readonly quotations: QuotationService,
  ) {}

  async list(keyword = '', status = 'all', page = 1, pageSize = 10): Promise<PageResult<CustomerPo>> {
    const pageResult = await this.storage.paginate<CustomerPo>(
      PO_FILE,
      page,
      pageSize,
      status && status !== 'all' ? { status: status as CustomerPo['status'] } : undefined,
      {
        search: { keyword, columns: ['poNo', 'customerName', 'remark', 'quotationNo'] },
        orderBy: [{ column: 'createdAt', direction: 'DESC' }, { column: 'id', direction: 'DESC' }],
      },
    );
    const totals = await Promise.all(pageResult.items.map(async (po) => {
      const items = await this.storage.query<CustomerPoItem>(ITEM_FILE, { poId: po.id });
      return [po.id, customerPoTotals(items).get(po.id)] as const;
    }));
    const totalsByPoId = new Map(totals);
    return {
      ...pageResult,
      items: pageResult.items.map((po) => ({ ...po, ...totalsByPoId.get(po.id) })),
    };
  }

  async detail(id: string): Promise<CustomerPoDetail> {
    const po = (await this.storage.query<CustomerPo>(PO_FILE, { id })).at(0);
    if (!po) throw new Error(`Customer PO ${id} not found`);
    const items = (await this.storage.query<CustomerPoItem>(ITEM_FILE, { poId: id }))
      .sort((left, right) => Number(left.lineNo || 0) - Number(right.lineNo || 0));
    return { po, items };
  }

  async save(input: CreateCustomerPoDto, id?: string): Promise<CustomerPoDetail> {
    const customer = await this.customers.findById(input.customerId);
    if (!customer) throw new Error('请先选择系统客户');
    if (!input.items?.length) throw new Error('客户 PO 至少需要一条产品明细');
    const existing = id ? await this.detail(id) : undefined;
    const normalizedItems = await Promise.all(input.items.map((item, index) => this.normalizeItem('', item, index)));
    const nextStatus: CustomerPoStatus = existing?.po.status === 'quoted'
      ? 'quoted'
      : normalizedItems.every((item) => item.matchedProductId) ? 'matched' : 'draft';
    const poInput = {
      poNo: input.poNo?.trim() || await this.nextPoNo(),
      customerId: customer.id,
      customerName: customer.shortName || customer.name,
      poDate: input.poDate || new Date().toISOString().slice(0, 10),
      deliveryDate: input.deliveryDate || '',
      currency: input.currency || 'USD',
      status: nextStatus,
      remark: input.remark || '',
      quotationId: existing?.po.quotationId || '',
      quotationNo: existing?.po.quotationNo || '',
      createdBy: input.createdBy || existing?.po.createdBy || '',
    };
    const po = id
      ? await this.storage.update<CustomerPo>(PO_FILE, id, poInput)
      : await this.storage.insert<CustomerPo>(PO_FILE, poInput);
    if (existing) {
      for (const item of existing.items) await this.storage.delete(ITEM_FILE, item.id);
    }
    for (const item of normalizedItems) {
      await this.storage.insert<CustomerPoItem>(ITEM_FILE, { ...item, poId: po.id });
    }
    return this.detail(po.id);
  }

  async remove(id: string): Promise<void> {
    const detail = await this.detail(id);
    for (const item of detail.items) {
      await this.storage.delete(ITEM_FILE, item.id);
    }
    await this.storage.delete(PO_FILE, id);
  }

  async generateQuotation(id: string) {
    const detail = await this.detail(id);
    const draft = customerPoToQuotationDraft(detail.po, detail.items);
    const created = await this.quotations.create(draft);
    const po = await this.storage.update<CustomerPo>(PO_FILE, id, {
      status: 'quoted',
      quotationId: created.quotation.id,
      quotationNo: created.quotation.quotationNo,
    });
    return { po, quotation: created.quotation, items: created.items };
  }

  private async normalizeItem(poId: string, input: CreateCustomerPoItemDto, index: number): Promise<Omit<CustomerPoItem, 'id' | 'createdAt' | 'updatedAt'>> {
    const product = input.matchedProductId ? await this.products.findById(input.matchedProductId) : undefined;
    return {
      poId,
      lineNo: Number(input.lineNo || index + 1),
      customerSku: input.customerSku || '',
      customerProductName: (input.customerProductName || product?.name || '').trim(),
      customerSpec: input.customerSpec || '',
      customerBrand: input.customerBrand || '',
      unit: input.unit || product?.unit || 'pcs',
      quantity: Number(input.quantity || 0),
      targetUnitPrice: Number(input.targetUnitPrice || 0),
      currency: input.currency || 'USD',
      imageUrl: input.imageUrl || product?.imageUrl || '',
      remark: input.remark || '',
      matchedProductId: product?.id || '',
      matchedProductCode: product?.productCode || '',
      matchedProductName: product?.name || '',
      matchStatus: product ? 'matched' : input.matchStatus || 'unmatched',
      matchMethod: product ? input.matchMethod || 'manual' : input.matchMethod || '',
      sourceType: product ? 'system' : input.sourceType || 'temporary',
    };
  }

  private async nextPoNo(): Promise<string> {
    const prefix = `PO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
    const count = (await this.storage.readTable<CustomerPo>(PO_FILE)).filter((po) => po.poNo.startsWith(prefix)).length + 1;
    return `${prefix}-${String(count).padStart(3, '0')}`;
  }
}

function customerPoTotals(items: CustomerPoItem[]) {
  const totals = new Map<string, Pick<CustomerPo, 'itemCount' | 'totalQuantity' | 'totalAmount'>>();
  for (const item of items) {
    const current = totals.get(item.poId) || { itemCount: 0, totalQuantity: 0, totalAmount: 0 };
    current.itemCount = Number(current.itemCount || 0) + 1;
    current.totalQuantity = Number(current.totalQuantity || 0) + Number(item.quantity || 0);
    current.totalAmount = Number(current.totalAmount || 0) + Number(item.quantity || 0) * Number(item.targetUnitPrice || 0);
    totals.set(item.poId, current);
  }
  return totals;
}
