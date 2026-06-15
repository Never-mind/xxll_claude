import { utils, write } from 'xlsx';
import { describe, expect, it, vi } from 'vitest';
import { TariffRateService } from './tariff-rate.service.js';

describe('TariffRateService import', () => {
  it('updates existing device types and inserts new rows', async () => {
    const existing = {
      id: 'rate-1',
      deviceType: '设备A',
      hsCode: 'OLD',
      taxRate: 5,
      needNom: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    const storage = {
      query: vi.fn(async (_file: string, where: { deviceType?: string }) => where.deviceType === existing.deviceType ? [existing] : []),
      update: vi.fn(async (_file: string, id: string, data: unknown) => ({ ...existing, id, ...(data as object) })),
      insert: vi.fn(async (_file: string, data: object) => ({ id: 'rate-2', createdAt: '', updatedAt: '', ...data })),
    };
    const service = new TariffRateService(storage as never);

    const result = await service.import(tariffWorkbook([
      ['设备类型', 'HS编码', '税率(%)', '需要NOM'],
      ['设备A', 'NEW-HS', 16, '是'],
      ['设备B', 'NEW-HS', 20, '否'],
    ]));

    expect(result.imported).toBe(2);
    expect(result.errors).toEqual([]);
    expect(storage.update).toHaveBeenCalledWith('tariff_rates.xlsx', 'rate-1', expect.objectContaining({ hsCode: 'NEW-HS', taxRate: 16, needNom: true }));
    expect(storage.insert).toHaveBeenCalledWith('tariff_rates.xlsx', expect.objectContaining({ deviceType: '设备B', hsCode: 'NEW-HS', taxRate: 20 }));
  });
});

function tariffWorkbook(rows: unknown[][]): Buffer {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), 'Sheet1');
  return write(workbook, { bookType: 'xlsx', type: 'buffer' });
}
