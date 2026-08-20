import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import type {
  ContractingEntity,
  ContractingEntityAttachment,
  ContractingEntityBankAccount,
  ContractingEntityContact,
  ContractingEntityDetail,
  CreateContractingEntityDto,
  PageResult,
  UpdateContractingEntityDto,
} from '../../../shared/api.interface.js';

const FILE = 'contracting_entities.xlsx';
const BANK_FILE = 'contracting_entity_bank_accounts.xlsx';
const CONTACT_FILE = 'contracting_entity_contacts.xlsx';
const ATTACHMENT_FILE = 'contracting_entity_attachments.xlsx';
type EntityRow = ContractingEntity;

@Injectable()
export class ContractingEntityService {
  constructor(@Inject(DatabaseStorageService) private readonly storage: DatabaseStorageService) {}

  async list(keyword = '', page = 1, pageSize = 10): Promise<PageResult<ContractingEntity>> {
    const result = await this.storage.paginate<EntityRow>(FILE, page, pageSize, undefined, {
      search: { keyword, columns: ['entityCode', 'entityName', 'nameCn', 'nameEn', 'shortName', 'taxNumber', 'country', 'city', 'contactName', 'contactPhone'] },
      orderBy: [{ column: 'createdAt', direction: 'DESC' }, { column: 'id', direction: 'DESC' }],
    });
    return result;
  }

  async all(): Promise<ContractingEntity[]> {
    return this.storage.readTable<EntityRow>(FILE);
  }

  async findById(id: string): Promise<ContractingEntity | undefined> {
    return (await this.storage.query<EntityRow>(FILE, { id })).at(0);
  }

  async detail(id: string): Promise<ContractingEntityDetail> {
    const entity = await this.findById(id);
    if (!entity) throw new NotFoundException('Contracting entity not found');
    const [bankAccounts, contacts, attachmentRows] = await Promise.all([
      this.storage.query<ContractingEntityBankAccount>(BANK_FILE, { entityId: id }),
      this.storage.query<ContractingEntityContact>(CONTACT_FILE, { entityId: id }),
      this.storage.query<ContractingEntityAttachment>(ATTACHMENT_FILE, { entityId: id }),
    ]);
    return {
      entity,
      bankAccounts: bankAccounts.sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder)),
      contacts: contacts.sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder)),
      attachments: attachmentRows
        .sort((left, right) => Date.parse(right.uploadedAt || '') - Date.parse(left.uploadedAt || ''))
        .map(({ dataUrl: _dataUrl, ...attachment }) => attachment),
    };
  }

  async create(input: CreateContractingEntityDto): Promise<ContractingEntityDetail> {
    const normalized = await this.normalize(input);
    const entity = await this.storage.insert<EntityRow>(FILE, normalized.entity);
    await this.replaceBanks(entity.id, normalized.bankAccounts);
    await this.replaceContacts(entity.id, normalized.contacts);
    return this.detail(entity.id);
  }

  async update(id: string, input: UpdateContractingEntityDto): Promise<ContractingEntityDetail> {
    const current = await this.detail(id);
    const normalized = await this.normalize({
      ...current.entity,
      ...input,
      bankAccounts: input.bankAccounts === undefined ? current.bankAccounts : input.bankAccounts,
      contacts: input.contacts === undefined ? current.contacts : input.contacts,
    }, id);
    await this.storage.update<EntityRow>(FILE, id, normalized.entity);
    if (input.bankAccounts !== undefined) await this.replaceBanks(id, normalized.bankAccounts);
    if (input.contacts !== undefined) await this.replaceContacts(id, normalized.contacts);
    await this.syncDisplayName(id, normalized.entity.entityName);
    return this.detail(id);
  }

  async addAttachment(entityId: string, input: Pick<ContractingEntityAttachment, 'fileName' | 'fileType' | 'fileSize' | 'dataUrl'>): Promise<ContractingEntityDetail> {
    if (!await this.findById(entityId)) throw new NotFoundException('Contracting entity not found');
    if (!input.fileName?.trim() || !input.dataUrl) throw new BadRequestException('Attachment file is required');
    await this.storage.insert<ContractingEntityAttachment>(ATTACHMENT_FILE, {
      entityId,
      fileName: input.fileName.trim(),
      fileType: input.fileType || '',
      fileSize: Number(input.fileSize || 0),
      dataUrl: input.dataUrl,
      uploadedAt: new Date().toISOString(),
    });
    return this.detail(entityId);
  }

  async findAttachment(entityId: string, attachmentId: string): Promise<ContractingEntityAttachment> {
    const attachment = (await this.storage.query<ContractingEntityAttachment>(ATTACHMENT_FILE, { id: attachmentId })).at(0);
    if (!attachment || attachment.entityId !== entityId) throw new NotFoundException('Contracting entity attachment not found');
    return attachment;
  }

  async deleteAttachment(entityId: string, attachmentId: string): Promise<ContractingEntityDetail> {
    await this.findAttachment(entityId, attachmentId);
    await this.storage.delete(ATTACHMENT_FILE, attachmentId);
    return this.detail(entityId);
  }

  async remove(id: string): Promise<void> {
    if (!await this.findById(id)) throw new NotFoundException('Contracting entity not found');
    for (const fileName of [BANK_FILE, CONTACT_FILE, ATTACHMENT_FILE]) {
      const rows = await this.storage.query<Record<string, unknown>>(fileName, { entityId: id });
      for (const row of rows) await this.storage.delete(fileName, String(row.id));
    }
    await this.storage.delete(FILE, id);
  }

  private async normalize(input: CreateContractingEntityDto, currentId = ''): Promise<{
    entity: Omit<EntityRow, 'id' | 'createdAt' | 'updatedAt'>;
    bankAccounts: Array<Omit<ContractingEntityBankAccount, 'id' | 'entityId' | 'createdAt' | 'updatedAt'>>;
    contacts: Array<Omit<ContractingEntityContact, 'id' | 'entityId' | 'createdAt' | 'updatedAt'>>;
  }> {
    const nameCn = text(input.nameCn) || text(input.entityName);
    if (!nameCn) throw new BadRequestException('Entity name is required');
    const shortName = text(input.shortName) || text(input.entityName) || nameCn;
    const entityCode = text(input.entityCode) || await this.nextCode();
    const rows = await this.all();
    if (rows.some((row) => row.id !== currentId && row.entityCode.toLowerCase() === entityCode.toLowerCase())) throw new BadRequestException('Entity code already exists');
    if (rows.some((row) => row.id !== currentId && (row.nameCn || row.entityName).toLowerCase() === nameCn.toLowerCase())) throw new BadRequestException('Entity name already exists');
    const contacts = this.normalizeContacts(input.contacts, input);
    const primaryContact = contacts.find((contact) => contact.isPrimary) || contacts[0];
    return {
      entity: {
        entityCode,
        entityName: shortName,
        nameCn,
        nameEn: text(input.nameEn),
        shortName,
        taxNumber: text(input.taxNumber),
        country: text(input.country),
        city: text(input.city),
        registeredAddress: text(input.registeredAddress) || text(input.address),
        address: text(input.registeredAddress) || text(input.address),
        remark: text(input.remark),
        bankAccount: text(input.bankAccount),
        contactName: primaryContact?.name || text(input.contactName),
        contactPhone: primaryContact?.phone || text(input.contactPhone),
      },
      bankAccounts: this.normalizeBanks(input.bankAccounts),
      contacts,
    };
  }

  private normalizeBanks(items?: Array<Partial<ContractingEntityBankAccount>>) {
    const rows = (items || []).flatMap((item, index) => {
      const accountName = text(item.accountName); const bankName = text(item.bankName); const bankAccount = text(item.bankAccount);
      const bankRoutingNumber = text(item.bankRoutingNumber); const swiftCode = text(item.swiftCode); const currency = text(item.currency); const bankAddress = text(item.bankAddress);
      if (![accountName, bankName, bankAccount, bankRoutingNumber, swiftCode, currency, bankAddress].some(Boolean)) return [];
      if (!currency) throw new BadRequestException(`Bank account ${index + 1} requires a currency`);
      return [{ accountName, bankName, bankAccount, bankRoutingNumber, swiftCode, currency, bankAddress, isDefault: Boolean(item.isDefault) }];
    });
    const defaultIndex = rows.findIndex((row) => row.isDefault);
    return rows.map((row, index) => ({ ...row, sortOrder: index + 1, isDefault: index === (defaultIndex >= 0 ? defaultIndex : 0) }));
  }

  private normalizeContacts(items?: Array<Partial<ContractingEntityContact>>, fallback?: Pick<CreateContractingEntityDto, 'contactName' | 'contactPhone'>) {
    const rows = (items?.length ? items : (text(fallback?.contactName) || text(fallback?.contactPhone) ? [{ name: fallback?.contactName, phone: fallback?.contactPhone, isPrimary: true }] : []))
      .map((item) => ({ name: text(item.name), title: text(item.title), phone: text(item.phone), email: text(item.email), isPrimary: Boolean(item.isPrimary) }))
      .filter((item) => item.name || item.title || item.phone || item.email);
    const primaryIndex = rows.findIndex((row) => row.isPrimary);
    return rows.map((row, index) => ({ ...row, sortOrder: index + 1, isPrimary: index === (primaryIndex >= 0 ? primaryIndex : 0) }));
  }

  private async replaceBanks(entityId: string, rows: Array<Omit<ContractingEntityBankAccount, 'id' | 'entityId' | 'createdAt' | 'updatedAt'>>) {
    for (const row of await this.storage.query<ContractingEntityBankAccount>(BANK_FILE, { entityId })) await this.storage.delete(BANK_FILE, row.id);
    for (const row of rows) await this.storage.insert<ContractingEntityBankAccount>(BANK_FILE, { entityId, ...row });
  }

  private async replaceContacts(entityId: string, rows: Array<Omit<ContractingEntityContact, 'id' | 'entityId' | 'createdAt' | 'updatedAt'>>) {
    for (const row of await this.storage.query<ContractingEntityContact>(CONTACT_FILE, { entityId })) await this.storage.delete(CONTACT_FILE, row.id);
    for (const row of rows) await this.storage.insert<ContractingEntityContact>(CONTACT_FILE, { entityId, ...row });
  }

  private async syncDisplayName(entityId: string, displayName: string) {
    for (const fileName of ['quotations.xlsx', 'settlement_projects.xlsx']) {
      const rows = await this.storage.query<Record<string, unknown>>(fileName, { contractingEntityId: entityId });
      for (const row of rows) await this.storage.update<Record<string, unknown>>(fileName, String(row.id), { contractingEntityName: displayName });
    }
  }

  private async nextCode(): Promise<string> {
    const rows = await this.all();
    const max = rows.reduce((current, row) => Math.max(current, Number(/^ENTITY-(\d+)$/.exec(row.entityCode || '')?.[1]) || 0), 0);
    return `ENTITY-${String(max + 1).padStart(3, '0')}`;
  }
}

function toEntity(row: EntityRow): ContractingEntity {
  return { ...row, nameCn: row.nameCn || row.entityName, shortName: row.shortName || row.entityName };
}

function normalizeStringList(value: unknown): string[] {
  return [...new Set((Array.isArray(value) ? value : parseStringList(value)).map(text).filter(Boolean))];
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const source = text(value); if (!source) return [];
  try { const parsed = JSON.parse(source); if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean); } catch { /* Supports legacy comma-separated values. */ }
  return source.split(/[，,;；\n]/).map(text).filter(Boolean);
}

function text(value: unknown): string { return String(value ?? '').trim(); }
