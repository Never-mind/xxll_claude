import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { workbookBufferFromSheets, rowsFromExcelBuffer } from '../../common/excel-utils.js';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import type {
  CreateSupplierBankAccountDto,
  CreateSupplierContactDto,
  CreateSupplierDto,
  PageResult,
  Supplier,
  SupplierAttachment,
  SupplierBankAccount,
  SupplierContact,
  SupplierCooperationStatus,
  SupplierDetail,
  SupplierType,
  UpdateSupplierDto,
} from '../../../shared/api.interface.js';

const SUPPLIER_FILE = 'suppliers.xlsx';
const BANK_FILE = 'supplier_bank_accounts.xlsx';
const CONTACT_FILE = 'supplier_contacts.xlsx';
const ATTACHMENT_FILE = 'supplier_attachments.xlsx';
const SUPPLIER_TYPES = new Set<SupplierType>(['manufacturer', 'agent', 'integrator', 'third_party']);
const COOPERATION_STATUSES = new Set<SupplierCooperationStatus>(['normal', 'suspended', 'terminated', 'not_cooperated']);

type SupplierRow = Omit<Supplier, 'supplyCategories' | 'brands'> & {
  supplyCategories?: string;
  brands?: string;
};

@Injectable()
export class SupplierService {
  constructor(@Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService) {}

  async list(keyword = '', status = '', supplierType = '', page = 1, pageSize = 10): Promise<PageResult<Supplier>> {
    const result = await this.storage.paginate<SupplierRow>(
      SUPPLIER_FILE,
      page,
      pageSize,
      {
        cooperationStatus: status ? status as SupplierCooperationStatus : undefined,
        supplierType: supplierType ? supplierType as SupplierType : undefined,
      },
      {
        search: {
          keyword,
          columns: ['supplierCode', 'nameCn', 'nameEn', 'shortName', 'country', 'city', 'contactName', 'contactPhone', 'supplyCategories', 'brands'],
        },
      },
    );
    return {
      ...result,
      items: result.items.map(toSupplier),
    };
  }

  async all(): Promise<Supplier[]> {
    return (await this.storage.readTable<SupplierRow>(SUPPLIER_FILE)).map(toSupplier);
  }

  async findById(id: string): Promise<Supplier | undefined> {
    const row = (await this.storage.query<SupplierRow>(SUPPLIER_FILE, { id })).at(0);
    return row ? toSupplier(row) : undefined;
  }

  async detail(id: string): Promise<SupplierDetail> {
    const supplier = await this.findById(id);
    if (!supplier) throw new NotFoundException('Supplier not found');
    const [bankAccounts, contacts, attachmentRows] = await Promise.all([
      this.storage.query<SupplierBankAccount>(BANK_FILE, { supplierId: id }),
      this.storage.query<SupplierContact>(CONTACT_FILE, { supplierId: id }),
      this.storage.query<SupplierAttachment>(ATTACHMENT_FILE, { supplierId: id }),
    ]);
    return {
      supplier,
      bankAccounts: bankAccounts.sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder)),
      contacts: contacts.sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder)),
      attachments: attachmentRows
        .sort((left, right) => Date.parse(right.uploadedAt || '') - Date.parse(left.uploadedAt || ''))
        .map(({ dataUrl: _dataUrl, ...attachment }) => attachment),
    };
  }

  async create(input: CreateSupplierDto): Promise<SupplierDetail> {
    const normalized = await this.normalizeInput(input);
    const supplier = await this.storage.insert<SupplierRow>(SUPPLIER_FILE, normalized.supplier);
    await this.replaceBanks(supplier.id, normalized.bankAccounts);
    await this.replaceContacts(supplier.id, normalized.contacts);
    return this.detail(supplier.id);
  }

  async update(id: string, input: UpdateSupplierDto): Promise<SupplierDetail> {
    const current = await this.detail(id);
    const nextInput: CreateSupplierDto = {
      ...current.supplier,
      ...input,
      bankAccounts: input.bankAccounts === undefined ? current.bankAccounts : input.bankAccounts,
      contacts: input.contacts === undefined ? current.contacts : input.contacts,
    };
    const normalized = await this.normalizeInput(nextInput, id);
    await this.storage.update<SupplierRow>(SUPPLIER_FILE, id, normalized.supplier);
    if (input.bankAccounts !== undefined) await this.replaceBanks(id, normalized.bankAccounts);
    if (input.contacts !== undefined) await this.replaceContacts(id, normalized.contacts);
    return this.detail(id);
  }

  async addAttachment(supplierId: string, input: Pick<SupplierAttachment, 'fileName' | 'fileType' | 'fileSize' | 'dataUrl'>): Promise<SupplierDetail> {
    if (!await this.findById(supplierId)) throw new NotFoundException('Supplier not found');
    if (!input.fileName?.trim() || !input.dataUrl) throw new BadRequestException('Attachment file is required');
    await this.storage.insert<SupplierAttachment>(ATTACHMENT_FILE, {
      supplierId,
      fileName: input.fileName.trim(),
      fileType: input.fileType || '',
      fileSize: Number(input.fileSize || 0),
      dataUrl: input.dataUrl,
      uploadedAt: new Date().toISOString(),
    });
    return this.detail(supplierId);
  }

  async findAttachment(supplierId: string, attachmentId: string): Promise<SupplierAttachment> {
    const attachment = (await this.storage.query<SupplierAttachment>(ATTACHMENT_FILE, { id: attachmentId })).at(0);
    if (!attachment || attachment.supplierId !== supplierId) throw new NotFoundException('Supplier attachment not found');
    return attachment;
  }

  async deleteAttachment(supplierId: string, attachmentId: string): Promise<SupplierDetail> {
    await this.findAttachment(supplierId, attachmentId);
    await this.storage.delete(ATTACHMENT_FILE, attachmentId);
    return this.detail(supplierId);
  }

  async remove(id: string): Promise<void> {
    if (!await this.findById(id)) throw new NotFoundException('Supplier not found');
    for (const fileName of [BANK_FILE, CONTACT_FILE, ATTACHMENT_FILE]) {
      const rows = await this.storage.query<{ id: string; supplierId: string }>(fileName, { supplierId: id });
      for (const row of rows) await this.storage.delete(fileName, row.id);
    }
    await this.storage.delete(SUPPLIER_FILE, id);
  }

  async import(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    const rows = rowsFromExcelBuffer<Record<string, unknown>>(buffer);
    const errors: string[] = [];
    let imported = 0;
    for (const [index, row] of rows.entries()) {
      try {
        await this.create(importSupplierRow(row));
        imported += 1;
      } catch (error) {
        errors.push(`Row ${index + 2}: ${(error as Error).message}`);
      }
    }
    return { imported, errors };
  }

  async export(): Promise<Buffer> {
    const rows = (await this.all()).map((supplier) => ({
      SupplierCode: supplier.supplierCode,
      SupplierNameCn: supplier.nameCn,
      SupplierNameEn: supplier.nameEn || '',
      ShortName: supplier.shortName || '',
      Country: supplier.country || '',
      City: supplier.city || '',
      RegisteredAddress: supplier.registeredAddress || '',
      TaxNumber: supplier.taxNumber || '',
      SupplierType: supplier.supplierType,
      SupplyCategories: supplier.supplyCategories.join(', '),
      Brands: supplier.brands.join(', '),
      CooperationStatus: supplier.cooperationStatus,
      Website: supplier.website || '',
      Remark: supplier.remark || '',
      ContactName: supplier.contactName || '',
      ContactPhone: supplier.contactPhone || '',
      ContactEmail: supplier.contactEmail || '',
    }));
    return workbookBufferFromSheets({ Suppliers: rows });
  }

  private async normalizeInput(input: CreateSupplierDto, currentId = ''): Promise<{
    supplier: Omit<SupplierRow, 'id' | 'createdAt' | 'updatedAt'>;
    bankAccounts: Array<Omit<SupplierBankAccount, 'id' | 'supplierId' | 'createdAt' | 'updatedAt'>>;
    contacts: Array<Omit<SupplierContact, 'id' | 'supplierId' | 'createdAt' | 'updatedAt'>>;
  }> {
    const nameCn = text(input.nameCn);
    if (!nameCn) throw new BadRequestException('Supplier name is required');
    const suppliedCode = text(input.supplierCode);
    const supplierCode = suppliedCode || await this.nextSupplierCode();
    const all = await this.all();
    if (all.some((supplier) => supplier.id !== currentId && supplier.supplierCode.toLowerCase() === supplierCode.toLowerCase())) {
      throw new BadRequestException('Supplier code already exists');
    }
    if (all.some((supplier) => supplier.id !== currentId && supplier.nameCn.trim().toLowerCase() === nameCn.toLowerCase())) {
      throw new BadRequestException('Supplier name already exists');
    }
    const supplierType = SUPPLIER_TYPES.has(input.supplierType as SupplierType) ? input.supplierType as SupplierType : 'third_party';
    const cooperationStatus = COOPERATION_STATUSES.has(input.cooperationStatus as SupplierCooperationStatus)
      ? input.cooperationStatus as SupplierCooperationStatus
      : 'not_cooperated';
    const contacts = this.normalizeContacts(input.contacts, input);
    const primaryContact = contacts.find((contact) => contact.isPrimary) || contacts[0];
    return {
      supplier: {
        supplierCode,
        nameCn,
        nameEn: text(input.nameEn),
        shortName: text(input.shortName),
        country: text(input.country),
        city: text(input.city),
        registeredAddress: text(input.registeredAddress),
        taxNumber: text(input.taxNumber),
        supplierType,
        supplyCategories: JSON.stringify(normalizeStringList(input.supplyCategories)),
        brands: JSON.stringify(normalizeStringList(input.brands)),
        cooperationStatus,
        website: text(input.website),
        remark: text(input.remark),
        contactName: primaryContact?.name || text(input.contactName),
        contactPhone: primaryContact?.phone || text(input.contactPhone),
        contactEmail: primaryContact?.email || text(input.contactEmail),
      },
      bankAccounts: this.normalizeBanks(input.bankAccounts),
      contacts,
    };
  }

  private normalizeBanks(items?: Array<CreateSupplierBankAccountDto | SupplierBankAccount>) {
    const normalized = (items || []).flatMap((item, index) => {
      const accountName = text(item.accountName);
      const bankName = text(item.bankName);
      const bankAccount = text(item.bankAccount);
      const bankRoutingNumber = text(item.bankRoutingNumber);
      const swiftCode = text(item.swiftCode);
      const currency = text(item.currency);
      const bankAddress = text(item.bankAddress);
      const hasDetails = [accountName, bankName, bankAccount, bankRoutingNumber, swiftCode, currency, bankAddress].some(Boolean);
      if (!hasDetails) return [];
      if (!currency) throw new BadRequestException(`Bank account ${index + 1} requires a currency`);
      return [{ accountName, bankName, bankAccount, bankRoutingNumber, swiftCode, currency, bankAddress, isDefault: Boolean(item.isDefault) }];
    });
    const defaultIndex = normalized.findIndex((item) => item.isDefault);
    return normalized.map((item, index) => ({ ...item, sortOrder: index + 1, isDefault: index === (defaultIndex >= 0 ? defaultIndex : 0) }));
  }

  private normalizeContacts(items?: Array<CreateSupplierContactDto | SupplierContact>, fallback?: Pick<CreateSupplierDto, 'contactName' | 'contactPhone' | 'contactEmail'>) {
    const source = items?.length ? items : (text(fallback?.contactName) || text(fallback?.contactPhone) || text(fallback?.contactEmail)
      ? [{ name: fallback?.contactName, phone: fallback?.contactPhone, email: fallback?.contactEmail, isPrimary: true }]
      : []);
    const normalized = source.map((item) => ({
      name: text(item.name),
      title: text(item.title),
      phone: text(item.phone),
      email: text(item.email),
      isPrimary: Boolean(item.isPrimary),
    })).filter((item) => item.name || item.title || item.phone || item.email);
    const primaryIndex = normalized.findIndex((item) => item.isPrimary);
    return normalized.map((item, index) => ({ ...item, sortOrder: index + 1, isPrimary: index === (primaryIndex >= 0 ? primaryIndex : 0) }));
  }

  private async replaceBanks(supplierId: string, items: Array<Omit<SupplierBankAccount, 'id' | 'supplierId' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    for (const row of await this.storage.query<SupplierBankAccount>(BANK_FILE, { supplierId })) await this.storage.delete(BANK_FILE, row.id);
    for (const item of items) await this.storage.insert<SupplierBankAccount>(BANK_FILE, { supplierId, ...item });
  }

  private async replaceContacts(supplierId: string, items: Array<Omit<SupplierContact, 'id' | 'supplierId' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    for (const row of await this.storage.query<SupplierContact>(CONTACT_FILE, { supplierId })) await this.storage.delete(CONTACT_FILE, row.id);
    for (const item of items) await this.storage.insert<SupplierContact>(CONTACT_FILE, { supplierId, ...item });
  }

  private async nextSupplierCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SUP-${year}-`;
    const serial = (await this.all()).reduce((maximum, supplier) => {
      if (!supplier.supplierCode.startsWith(prefix)) return maximum;
      const value = Number(supplier.supplierCode.slice(prefix.length));
      return Number.isFinite(value) ? Math.max(maximum, value) : maximum;
    }, 0);
    return `${prefix}${String(serial + 1).padStart(3, '0')}`;
  }
}

function toSupplier(row: SupplierRow): Supplier {
  return { ...row, supplyCategories: parseStringList(row.supplyCategories), brands: parseStringList(row.brands) };
}

function normalizeStringList(value: unknown): string[] {
  const source = Array.isArray(value) ? value : parseStringList(value);
  return [...new Set(source.map((item) => text(item)).filter(Boolean))];
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean);
  const source = text(value);
  if (!source) return [];
  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) return parsed.map((item) => text(item)).filter(Boolean);
  } catch {
    // Excel imports may provide a comma-separated value instead of JSON.
  }
  return source.split(/[，,;；\n]/).map((item) => text(item)).filter(Boolean);
}

function importSupplierRow(row: Record<string, unknown>): CreateSupplierDto {
  const value = (...keys: string[]) => keys.map((key) => row[key]).find((item) => item !== undefined && item !== '');
  return {
    supplierCode: text(value('supplierCode', 'SupplierCode', '供应商编码')),
    nameCn: text(value('nameCn', 'SupplierNameCn', '供应商全称（中文）')),
    nameEn: text(value('nameEn', 'SupplierNameEn', '供应商全称（英文）')),
    shortName: text(value('shortName', 'ShortName', '供应商简称')),
    country: text(value('country', 'Country', '所在国家/地区')),
    city: text(value('city', 'City', '城市')),
    registeredAddress: text(value('registeredAddress', 'RegisteredAddress', '注册地址')),
    taxNumber: text(value('taxNumber', 'TaxNumber', '税号')),
    supplierType: text(value('supplierType', 'SupplierType', '供应商类型')) as SupplierType,
    supplyCategories: normalizeStringList(value('supplyCategories', 'SupplyCategories', '主要供应品类')),
    brands: normalizeStringList(value('brands', 'Brands', '合作品牌')),
    cooperationStatus: text(value('cooperationStatus', 'CooperationStatus', '合作状态')) as SupplierCooperationStatus,
    website: text(value('website', 'Website', '官网')),
    remark: text(value('remark', 'Remark', '备注')),
    contactName: text(value('contactName', 'ContactName', '联系人')),
    contactPhone: text(value('contactPhone', 'ContactPhone', '联系方式')),
    contactEmail: text(value('contactEmail', 'ContactEmail', '联系邮箱')),
  };
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}
