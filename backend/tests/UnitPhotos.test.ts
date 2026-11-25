import { jest } from '@jest/globals';
import { ProductUnitUseCase } from '../src/usecases/product/ProductUnitUseCase.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

describe('ProductUnitUseCase.photos', () => {
  it('pages units with photos inside the tenant and project', async () => {
    const prisma = {
      product: { findFirst: fn({ id: 'p-1' }) },
      productUnit: {
        findMany: fn([{ id: 'u-1', code: 'A-01', variant: { name: 'T36' }, typeVariant: { name: 'Std' }, media: [{ id: 'm', fileUrl: 'x' }] }]),
        count: fn(41),
      },
    };
    const result = await new ProductUnitUseCase(prisma as never).photos('t-1', 'p-1', {
      page: 2, limit: 20, search: 'A-', typeVariantId: 'tv-1',
    });
    expect(result).toEqual({
      data: [{ id: 'u-1', code: 'A-01', type: 'T36', variant: 'Std', photos: [{ id: 'm', fileUrl: 'x' }] }],
      meta: { total: 41, page: 2, limit: 20, totalPages: 3 },
    });
    const { where, skip, take } = prisma.productUnit.findMany.mock.calls[0][0];
    expect({ skip, take }).toEqual({ skip: 20, take: 20 });
    expect(where).toEqual({
      tenantId: 't-1', variant: { productId: 'p-1', tenantId: 't-1' },
      media: { some: { tenantId: 't-1', mediaType: 'IMAGE' } }, code: { contains: 'A-' }, typeVariantId: 'tv-1',
    });
  });

  it('rejects a project of another tenant', async () => {
    const prisma = { product: { findFirst: fn(null) } };
    await expect(new ProductUnitUseCase(prisma as never).photos('t-1', 'p-2', { page: 1, limit: 20 })).rejects.toThrow('Product not found');
  });
});
