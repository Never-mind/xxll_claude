import { Inject, Injectable } from '@nestjs/common';
import { workbookBufferFromSheets } from '../../common/excel-utils.js';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { read, utils } from 'xlsx';
import type { PageResult, Product } from '../../../shared/api.interface.js';

type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
const FILE = 'products.xlsx';

@Injectable()
export class ProductService {
  constructor(@Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService) {}

  async list(keyword = '', page = 1, pageSize = 10): Promise<PageResult<Product>> {
    const all = await this.storage.readTable<Product>(FILE);
    const normalized = keyword.trim().toLowerCase();
    const filtered = normalized
      ? all.filter((item) =>
          [item.productCode, item.name, item.category].some((value) => String(value ?? '').toLowerCase().includes(normalized)),
        )
      : all;
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));
    const safePage = Math.max(1, Number(page) || 1);
    return {
      items: filtered.slice((safePage - 1) * safePageSize, safePage * safePageSize),
      total: filtered.length,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async all(): Promise<Product[]> {
    return this.storage.readTable<Product>(FILE);
  }

  async findById(id: string): Promise<Product | undefined> {
    return (await this.storage.query<Product>(FILE, { id })).at(0);
  }

  async findByCode(productCode: string): Promise<Product | undefined> {
    return (await this.storage.query<Product>(FILE, { productCode })).at(0);
  }

  async create(input: ProductInput): Promise<Product> {
    const exists = await this.findByCode(input.productCode);
    if (exists) throw new Error(`Product code ${input.productCode} already exists`);
    return this.storage.insert<Product>(FILE, this.normalize(input));
  }

  async update(id: string, input: Partial<ProductInput>): Promise<Product> {
    return this.storage.update<Product>(FILE, id, this.normalize(input));
  }

  async remove(id: string): Promise<void> {
    await this.storage.delete(FILE, id);
  }

  async import(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    const rows = rowsFromProductExcel(buffer);
    const errors: string[] = [];
    let imported = 0;
    for (const [index, row] of rows.entries()) {
      try {
        const input = withProductDefaults(row, index);
        const existing = await this.findByCode(input.productCode);
        if (existing) {
          await this.update(existing.id, input);
        } else {
          await this.create(input);
        }
        imported += 1;
      } catch (error) {
        errors.push(`Row ${index + 2}: ${(error as Error).message}`);
      }
    }
    return { imported, errors };
  }

  async export(): Promise<Buffer> {
    const rows = (await this.all()).map((product) => ({
      图片: product.imageUrl || '',
      产品编码: product.productCode,
      产品名称: product.name,
      规格: product.spec || '',
      品牌: product.brand || '',
      品类: product.category || '',
      单位: product.unit,
      '尺寸(cm)': `${product.length || 0}×${product.width || 0}×${product.height || 0}`,
      '毛重(kg)': product.grossWeight,
      中国HS编码: product.hsCodeCn || '',
      墨西哥HS编码: product.hsCodeMx || '',
      '墨西哥关税(%)': '',
      建议进价: product.suggestedPrice,
      联系方式: contactText(product),
      特性: featureText(product),
    }));
    return workbookBufferFromSheets({ 产品管理: rows });
  }

  private normalize<T extends Partial<ProductInput>>(input: T): T {
    return {
      ...input,
      unit: input.unit || '个',
      length: Number(input.length ?? 0),
      width: Number(input.width ?? 0),
      height: Number(input.height ?? 0),
      grossWeight: Number(input.grossWeight ?? 0),
      suggestedPrice: Number(input.suggestedPrice ?? 0),
      isMagnetic: Boolean(input.isMagnetic),
      isElectric: Boolean(input.isElectric),
      needNom: Boolean(input.needNom),
    };
  }
}

function rowsFromProductExcel(buffer: Buffer): Partial<ProductInput>[] {
  const workbook = read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const [header = [], ...rows] = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  return rows
    .filter((row) => row.some((cell) => String(cell ?? '').trim()))
    .map((row) => {
      const dimensionsCell = pick(row, header, ['尺寸(cm)', '尺寸', 'dimensions'], 7);
      const hasCombinedDimensions = /[x×*]/i.test(text(dimensionsCell));
      const dimensions = parseDimensions(dimensionsCell);
      const grossWeightIndex = hasCombinedDimensions ? 8 : 10;
      const hsCodeCnIndex = hasCombinedDimensions ? 9 : 11;
      const hsCodeMxIndex = hasCombinedDimensions ? 10 : 12;
      const suggestedPriceIndex = hasCombinedDimensions ? 12 : 14;
      const featuresIndex = hasCombinedDimensions ? 13 : 15;
      const features = text(pick(row, header, ['特性', 'features'], featuresIndex));
      return {
        imageUrl: text(pick(row, header, ['图片', '图片URL', 'imageUrl'], 0)),
        productCode: text(pick(row, header, ['产品编码', '产品编号', '编码', 'productCode'], 1)),
        name: text(pick(row, header, ['产品名称', '名称', 'name'], 2)),
        spec: text(pick(row, header, ['规格', 'spec'], 3)),
        brand: text(pick(row, header, ['品牌', 'brand'], 4)),
        category: text(pick(row, header, ['品类', 'category'], 5)),
        unit: text(pick(row, header, ['单位', 'unit'], 6)) || '个',
        length: numberOr(pick(row, header, ['长(cm)', '长', 'length'], hasCombinedDimensions ? -1 : 7), dimensions.length),
        width: numberOr(pick(row, header, ['宽(cm)', '宽', 'width'], hasCombinedDimensions ? -1 : 8), dimensions.width),
        height: numberOr(pick(row, header, ['高(cm)', '高', 'height'], hasCombinedDimensions ? -1 : 9), dimensions.height),
        grossWeight: numberOr(pick(row, header, ['毛重(kg)', '毛重', '重量', 'grossWeight'], grossWeightIndex), 0),
        hsCodeCn: text(pick(row, header, ['中国HS编码', '中国HS', '国内HS编码', 'hsCodeCn'], hsCodeCnIndex)),
      hsCodeMx: text(pick(row, header, ['墨西哥HS编码', '墨西哥HS', 'HS编码', 'hsCodeMx'], hsCodeMxIndex)),
      suggestedPrice: numberOr(pick(row, header, ['建议进价', '建议进价(CNY)', '进价', '采购价', 'suggestedPrice'], suggestedPriceIndex), 0),
        contactName1: text(pick(row, header, ['联系人姓名1', '联系人1', 'contactName1'], -1)),
        contactPhone1: text(pick(row, header, ['联系方式1', '联系电话1', '电话1', 'contactPhone1'], -1)),
        contactName2: text(pick(row, header, ['联系人姓名2', '联系人2', 'contactName2'], -1)),
        contactPhone2: text(pick(row, header, ['联系方式2', '联系电话2', '电话2', 'contactPhone2'], -1)),
      isMagnetic: hasFeature(features, pick(row, header, ['带磁', '是否带磁', 'isMagnetic'], -1), '带磁'),
        isElectric: hasFeature(features, pick(row, header, ['带电', '是否带电', 'isElectric'], -1), '带电'),
        needNom: hasFeature(features, pick(row, header, ['需要NOM', '是否需要NOM', 'NOM认证', 'needNom'], -1), 'NOM'),
      };
    });
}

function withProductDefaults(row: Partial<ProductInput>, index: number): ProductInput {
  const productCode = text(row.productCode) || `IMPORT-${Date.now()}-${index + 1}`;
  return {
    imageUrl: text(row.imageUrl),
    productCode,
    name: text(row.name) || productCode,
    spec: text(row.spec),
    brand: text(row.brand),
    category: text(row.category),
    unit: text(row.unit) || '个',
    length: Number(row.length ?? 0),
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    grossWeight: Number(row.grossWeight ?? 0),
    hsCodeCn: text(row.hsCodeCn),
    hsCodeMx: text(row.hsCodeMx),
    suggestedPrice: Number(row.suggestedPrice ?? 0),
    contactName1: text(row.contactName1),
    contactPhone1: text(row.contactPhone1),
    contactName2: text(row.contactName2),
    contactPhone2: text(row.contactPhone2),
    isMagnetic: Boolean(row.isMagnetic),
    isElectric: Boolean(row.isElectric),
    needNom: Boolean(row.needNom),
  };
}

function parseDimensions(value: unknown): { length: number; width: number; height: number } {
  const [length = 0, width = 0, height = 0] = String(value ?? '')
    .split(/[x×*]/i)
    .map((part) => Number(part.trim() || 0));
  return { length, width, height };
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function pick(row: unknown[], header: unknown[], names: string[], fallbackIndex: number): unknown {
  const normalizedNames = names.map(normalizeHeader);
  const index = header.findIndex((cell) => normalizedNames.includes(normalizeHeader(cell)));
  if (index >= 0) return row[index];
  return fallbackIndex >= 0 ? row[fallbackIndex] : undefined;
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasFeature(features: string, value: unknown, keyword: string): boolean {
  if (features.includes(keyword)) return true;
  const normalized = text(value).toLowerCase();
  return ['true', '1', 'yes', 'y', '是', '需要'].includes(normalized);
}

function normalizeHeader(value: unknown): string {
  return text(value)
    .replace(/[（）]/g, (match) => match === '（' ? '(' : ')')
    .replace(/[\s_\-\/]/g, '')
    .toLowerCase();
}

function contactText(product: Pick<Product, 'contactName1' | 'contactPhone1' | 'contactName2' | 'contactPhone2'>): string {
  return [
    [product.contactName1, product.contactPhone1],
    [product.contactName2, product.contactPhone2],
  ]
    .filter(([name, phone]) => name || phone)
    .map(([name, phone]) => `${name || ''}${name && phone ? '：' : ''}${phone || ''}`)
    .join('\n');
}

function featureText(product: Pick<Product, 'isMagnetic' | 'isElectric' | 'needNom'>): string {
  return [
    product.isMagnetic ? '带磁' : '',
    product.isElectric ? '带电' : '',
    product.needNom ? 'NOM认证' : '',
  ].filter(Boolean).join('、');
}
