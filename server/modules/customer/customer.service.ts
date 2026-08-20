import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { workbookBufferFromSheets, rowsFromExcelBuffer } from '../../common/excel-utils.js';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import type {
  CreateCustomerBankAccountDto,
  CreateCustomerContactDto,
  CreateCustomerDto,
  Customer,
  CustomerAttachment,
  CustomerBankAccount,
  CustomerBankCurrency,
  CustomerContact,
  CustomerDetail,
  PageResult,
  UpdateCustomerDto,
} from '../../../shared/api.interface.js';

const CUSTOMER_FILE = 'customers.xlsx';
const BANK_FILE = 'customer_bank_accounts.xlsx';
const CONTACT_FILE = 'customer_contacts.xlsx';
const ATTACHMENT_FILE = 'customer_attachments.xlsx';
const SUPPORTED_CURRENCIES = new Set<CustomerBankCurrency>(['CNY', 'USD', 'BRL', 'CLP', 'MXN', 'OTHER']);

@Injectable()
export class CustomerService {
  constructor(@Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService) {}

  async list(keyword = '', page = 1, pageSize = 10): Promise<PageResult<Customer>> {
    return this.storage.paginate<Customer>(CUSTOMER_FILE, page, pageSize, undefined, {
      search: {
        keyword,
        columns: ['customerCode', 'name', 'nameCn', 'nameEn', 'shortName', 'taxNumber', 'country', 'address', 'contactName', 'contactPhone', 'contactEmail'],
      },
    });
  }

  all(): Promise<Customer[]> {
    return this.storage.readTable<Customer>(CUSTOMER_FILE);
  }

  async findById(id: string): Promise<Customer | undefined> {
    return (await this.storage.query<Customer>(CUSTOMER_FILE, { id })).at(0);
  }

  async detail(id: string): Promise<CustomerDetail> {
    const customer = await this.findById(id);
    if (!customer) throw new NotFoundException('Customer not found');
    const [bankAccounts, contacts, attachmentRows] = await Promise.all([
      this.storage.query<CustomerBankAccount>(BANK_FILE, { customerId: id }),
      this.storage.query<CustomerContact>(CONTACT_FILE, { customerId: id }),
      this.storage.query<CustomerAttachment>(ATTACHMENT_FILE, { customerId: id }),
    ]);
    return {
      customer,
      bankAccounts: bankAccounts.sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder)),
      contacts: contacts.sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder)),
      attachments: attachmentRows
        .sort((left, right) => Date.parse(right.uploadedAt || '') - Date.parse(left.uploadedAt || ''))
        .map(({ dataUrl: _dataUrl, ...attachment }) => attachment),
    };
  }

  async create(input: CreateCustomerDto): Promise<CustomerDetail> {
    const normalized = await this.normalizeInput(input);
    const customer = await this.storage.insert<Customer>(CUSTOMER_FILE, normalized.customer);
    await this.replaceBanks(customer.id, normalized.bankAccounts);
    await this.replaceContacts(customer.id, normalized.contacts);
    return this.detail(customer.id);
  }

  async update(id: string, input: UpdateCustomerDto): Promise<CustomerDetail> {
    const current = await this.detail(id);
    const nextInput: CreateCustomerDto = {
      ...current.customer,
      ...input,
      bankAccounts: input.bankAccounts === undefined ? current.bankAccounts : input.bankAccounts,
      contacts: input.contacts === undefined ? current.contacts : input.contacts,
    };
    const normalized = await this.normalizeInput(nextInput, id);
    await this.storage.update<Customer>(CUSTOMER_FILE, id, normalized.customer);
    await this.syncDisplayName(id, normalized.customer.name);
    if (input.bankAccounts !== undefined) await this.replaceBanks(id, normalized.bankAccounts);
    if (input.contacts !== undefined) await this.replaceContacts(id, normalized.contacts);
    return this.detail(id);
  }

  async addAttachment(customerId: string, input: Pick<CustomerAttachment, 'fileName' | 'fileType' | 'fileSize' | 'dataUrl'>): Promise<CustomerDetail> {
    if (!await this.findById(customerId)) throw new NotFoundException('Customer not found');
    if (!input.fileName?.trim() || !input.dataUrl) throw new BadRequestException('Attachment file is required');
    await this.storage.insert<CustomerAttachment>(ATTACHMENT_FILE, {
      customerId,
      fileName: input.fileName.trim(),
      fileType: input.fileType || '',
      fileSize: Number(input.fileSize || 0),
      dataUrl: input.dataUrl,
      uploadedAt: new Date().toISOString(),
    });
    return this.detail(customerId);
  }

  async findAttachment(customerId: string, attachmentId: string): Promise<CustomerAttachment> {
    const attachment = (await this.storage.query<CustomerAttachment>(ATTACHMENT_FILE, { id: attachmentId })).at(0);
    if (!attachment || attachment.customerId !== customerId) throw new NotFoundException('Customer attachment not found');
    return attachment;
  }

  async deleteAttachment(customerId: string, attachmentId: string): Promise<CustomerDetail> {
    await this.findAttachment(customerId, attachmentId);
    await this.storage.delete(ATTACHMENT_FILE, attachmentId);
    return this.detail(customerId);
  }

  async remove(id: string): Promise<void> {
    if (!await this.findById(id)) throw new NotFoundException('Customer not found');
    for (const fileName of [BANK_FILE, CONTACT_FILE, ATTACHMENT_FILE]) {
      const rows = await this.storage.query<{ id: string; customerId: string }>(fileName, { customerId: id });
      for (const row of rows) await this.storage.delete(fileName, row.id);
    }
    await this.storage.delete(CUSTOMER_FILE, id);
  }

  async import(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    const rows = rowsFromExcelBuffer<Partial<CreateCustomerDto>>(buffer);
    const errors: string[] = [];
    let imported = 0;
    for (const [index, row] of rows.entries()) {
      try {
        await this.create(row as CreateCustomerDto);
        imported += 1;
      } catch (error) {
        errors.push(`Row ${index + 2}: ${(error as Error).message}`);
      }
    }
    return { imported, errors };
  }

  async export(): Promise<Buffer> {
    const rows = (await this.all()).map((customer) => ({
      CustomerCode: customer.customerCode || '',
      CustomerNameCn: customer.nameCn || customer.name,
      CustomerNameEn: customer.nameEn || '',
      CustomerShortName: customer.shortName || customer.name,
      CustomerName: customer.shortName || customer.name,
      TaxNumber: customer.taxNumber || '',
      Country: customer.country || '',
      Address: customer.address || '',
      PostalCode: customer.postalCode || '',
      ContactName: customer.contactName || '',
      ContactPhone: customer.contactPhone || '',
      ContactEmail: customer.contactEmail || '',
    }));
    return workbookBufferFromSheets({ Customers: rows });
  }

  private async normalizeInput(input: CreateCustomerDto, currentId = ''): Promise<{
    customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;
    bankAccounts: Array<Omit<CustomerBankAccount, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>;
    contacts: Array<Omit<CustomerContact, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>;
  }> {
    const nameCn = text(input.nameCn) || text(input.name);
    if (!nameCn) throw new BadRequestException('Customer name is required');
    const shortName = text(input.shortName) || text(input.name) || nameCn;
    const name = shortName;
    const customerCode = text(input.customerCode);
    if (customerCode) {
      const duplicate = (await this.all()).find((customer) => customer.id !== currentId && customer.customerCode?.toLowerCase() === customerCode.toLowerCase());
      if (duplicate) throw new BadRequestException('Customer code already exists');
    }
    const duplicateName = (await this.all()).find((customer) => customer.id !== currentId && (customer.nameCn || customer.name).trim().toLowerCase() === nameCn.toLowerCase());
    if (duplicateName) throw new BadRequestException('Customer name already exists');

    const contacts = this.normalizeContacts(input.contacts, input);
    const primaryContact = contacts.find((contact) => contact.isPrimary) || contacts[0];
    return {
      customer: {
        customerCode,
        name,
        nameCn,
        nameEn: text(input.nameEn),
        shortName,
        taxNumber: text(input.taxNumber),
        country: text(input.country),
        address: text(input.address),
        postalCode: text(input.postalCode),
        contactName: primaryContact?.name || text(input.contactName),
        contactPhone: primaryContact?.phone || text(input.contactPhone),
        contactEmail: primaryContact?.email || text(input.contactEmail),
      },
      bankAccounts: this.normalizeBanks(input.bankAccounts),
      contacts,
    };
  }

  private normalizeBanks(items?: Array<CreateCustomerBankAccountDto | CustomerBankAccount>) {
    const source = items || [];
    const normalized = source.flatMap((item, index) => {
      const accountName = text(item.accountName);
      const bankName = text(item.bankName);
      const bankAccount = text(item.bankAccount);
      const bankRoutingNumber = text(item.bankRoutingNumber);
      const swiftCode = text(item.swiftCode);
      const currencyValue = text(item.currency);
      const otherCurrencyValue = text(item.otherCurrency);
      const bankAddress = text(item.bankAddress);
      const hasDetails = [accountName, bankName, bankAccount, bankRoutingNumber, swiftCode, currencyValue, otherCurrencyValue, bankAddress].some(Boolean);
      if (!hasDetails) return [];
      if (!currencyValue) throw new BadRequestException(`Bank account ${index + 1} requires a currency`);
      const currency = SUPPORTED_CURRENCIES.has(currencyValue as CustomerBankCurrency) ? currencyValue as CustomerBankCurrency : 'OTHER';
      const otherCurrency = currency === 'OTHER' ? text(otherCurrencyValue || (currencyValue === 'OTHER' ? '' : currencyValue)) : '';
      if (currency === 'OTHER' && !otherCurrency) throw new BadRequestException(`Bank account ${index + 1} requires a currency code`);
      return [{
        accountName,
        bankName,
        bankAccount,
        bankRoutingNumber,
        swiftCode,
        currency,
        otherCurrency,
        bankAddress,
        isDefault: Boolean(item.isDefault),
      }];
    });
    const defaultIndex = normalized.findIndex((item) => item.isDefault);
    return normalized.map((item, index) => ({ ...item, sortOrder: index + 1, isDefault: index === (defaultIndex >= 0 ? defaultIndex : 0) }));
  }

  private normalizeContacts(items?: Array<CreateCustomerContactDto | CustomerContact>, fallback?: Pick<CreateCustomerDto, 'contactName' | 'contactPhone' | 'contactEmail'>) {
    const source = items?.length ? items : (text(fallback?.contactName) || text(fallback?.contactPhone) || text(fallback?.contactEmail)
      ? [{ name: fallback?.contactName, phone: fallback?.contactPhone, email: fallback?.contactEmail, isPrimary: true }]
      : []);
    const normalized = source.map((item, index) => ({
      name: text(item.name),
      phone: text(item.phone),
      email: text(item.email),
      sortOrder: index + 1,
      isPrimary: Boolean(item.isPrimary),
    }));
    const primaryIndex = normalized.findIndex((item) => item.isPrimary);
    return normalized.map((item, index) => ({ ...item, isPrimary: index === (primaryIndex >= 0 ? primaryIndex : 0) }));
  }

  private async replaceBanks(customerId: string, items: Array<Omit<CustomerBankAccount, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    for (const row of await this.storage.query<CustomerBankAccount>(BANK_FILE, { customerId })) await this.storage.delete(BANK_FILE, row.id);
    for (const item of items) await this.storage.insert<CustomerBankAccount>(BANK_FILE, { customerId, ...item });
  }

  private async replaceContacts(customerId: string, items: Array<Omit<CustomerContact, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    for (const row of await this.storage.query<CustomerContact>(CONTACT_FILE, { customerId })) await this.storage.delete(CONTACT_FILE, row.id);
    for (const item of items) await this.storage.insert<CustomerContact>(CONTACT_FILE, { customerId, ...item });
  }

  private async syncDisplayName(customerId: string, displayName: string): Promise<void> {
    const files: Array<[string, string]> = [['quotations.xlsx', 'customerId'], ['customer_pos.xlsx', 'customerId']];
    for (const [fileName, key] of files) {
      const rows = await this.storage.query<Record<string, unknown>>(fileName, { [key]: customerId });
      for (const row of rows) await this.storage.update<Record<string, unknown>>(fileName, String(row.id), { customerName: displayName });
    }
    const quotations = await this.storage.query<Record<string, unknown>>('quotations.xlsx', { customerId });
    for (const quotation of quotations) {
      const projects = await this.storage.query<Record<string, unknown>>('settlement_projects.xlsx', { quotationId: String(quotation.id) });
      for (const project of projects) await this.storage.update<Record<string, unknown>>('settlement_projects.xlsx', String(project.id), { customerName: displayName });
    }
  }
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}
