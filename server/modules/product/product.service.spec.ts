import { describe, expect, it, vi } from 'vitest';
import { ProductService } from './product.service.js';

describe('ProductService tariff mapping', () => {
  it('fills Mexico HS code from the selected category device type', async () => {
    const storage = {
      query: vi.fn(async () => []),
      insert: vi.fn(async (_file: string, data: object) => ({ id: 'product-1', createdAt: '', updatedAt: '', ...data })),
    };
    const tariffs = {
      byDeviceType: vi.fn(async (deviceType: string) => deviceType === '线缆' ? { hsCode: '8544.42.99' } : undefined),
    };
    const service = new ProductService(storage as never, tariffs as never);

    const result = await service.create({
      productCode: 'P-001',
      name: '测试产品',
      category: '线缆',
      unit: '个',
      length: 0,
      width: 0,
      height: 0,
      grossWeight: 0,
      hsCodeMx: 'MANUAL',
      suggestedPrice: 0,
      isMagnetic: false,
      isElectric: false,
      needNom: false,
    });

    expect(result.hsCodeMx).toBe('8544.42.99');
    expect(storage.insert).toHaveBeenCalledWith('products.xlsx', expect.objectContaining({ hsCodeMx: '8544.42.99' }));
  });
});
