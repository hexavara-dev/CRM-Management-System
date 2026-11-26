import { jest } from '@jest/globals';
import { validateProduct } from '../src/presentation/validation/ProductRequestValidation.js';
import { ProductUseCase } from '../src/usecases/product/ProductUseCase.js';

const fn = (value?: unknown) => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);
const attribute = { name: 'Building Area', code: 'building_area', dataType: 'NUMBER', unit: 'm²' };
const body = (value: number, code = ' A-01 ') => ({
  name: 'P',
  code: 'P',
  variants: [{ name: 'T', typeVariants: [{ name: 'D', basePrice: 1, stock: 1, attributes: [{ ...attribute, value }] }] }],
  units: [{ code, variantIndex: 0 }],
});

describe('specification decimals', () => {
  it('accepts decimals and trims unit codes', () => {
    const product = validateProduct(body(36.5));
    expect(product.variants![0]!.typeVariants![0]!.attributes![0]!.value).toBe(36.5);
    expect(product.units![0]!.code).toBe('A-01');
  });

  it('stores two decimals and returns plain numbers', async () => {
    const tx = {
      product: { create: fn({ id: 'p' }), findFirst: fn(null) },
      productCategory: { create: fn({ id: 'c' }), findFirst: fn(null) },
      productVariant: { create: fn({ id: 'v' }) },
      productTypeVariant: { create: fn({ id: 'tv' }) },
      attribute: { findFirst: fn({ id: 'a', source: 'UNIT_TYPE' }) },
      productAttribute: { findMany: fn([]), create: fn({}) },
    };
    const prisma = {
      $transaction: async (action: any) => action(tx),
      product: { findFirst: fn({ id: 'p', media: [], variants: [], attributes: [{ id: 'x', value: { toString: () => '36.46' } }] }) },
    };
    const { units: _units, ...input } = validateProduct(body(36.456)) as any;
    const product = await new ProductUseCase(prisma as never).create('t', input);
    expect(tx.productAttribute.create.mock.calls[0]![0].data.value).toBe(36.46);
    expect(product.attributes[0]!.value).toBe(36.46);
  });
});

describe('cover limit', () => {
  it('counts existing covers but keeps older projects savable', async () => {
    const media = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, mediaType: 'IMAGE', variantId: null, unitId: null, fileUrl: 'x' }));
    const prisma = {
      product: { findFirst: fn({ id: 'p', categoryId: 'c', category: { id: 'c', type: 'PROJECT' }, media, variants: [], attributes: [] }) },
      $transaction: jest.fn(async () => undefined),
    };
    const useCase = new ProductUseCase(prisma as never, { upload: fn(), remove: fn(), getPublicUrl: () => ({ publicUrl: '' }) } as never);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const cover = { mimetype: 'image/png', buffer: png, originalname: 'a.png', size: 8 } as Express.Multer.File;
    await expect(useCase.update('p', 't', {}, [cover])).rejects.toThrow(/Invalid cover count/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await useCase.update('p', 't', { removeMediaIds: ['m0'] }, [cover]);
    await useCase.update('p', 't', {});
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
