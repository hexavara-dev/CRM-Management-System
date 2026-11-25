import { jest } from '@jest/globals';
import { ProductUseCase } from '../src/usecases/product/ProductUseCase.js';
import { mapHttpError } from '../src/infrastructure/utils/HttpErrorMapper.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

function fixture(over: { leads?: number; units?: number; usedCategories?: number } = {}) {
  const tx = {
    product: { delete: fn(), count: fn(over.usedCategories ?? 0) },
    productUnit: { count: fn(over.units ?? 0) },
    productVariantPriceLog: { count: fn(0) },
    productCategory: {
      findMany: fn([
        { id: 'block', parentId: 'cluster', type: 'BLOCK', siteplanImg: null },
        { id: 'root', parentId: null, type: 'PROJECT', siteplanImg: 'siteplan' },
        { id: 'cluster', parentId: 'root', type: 'CLUSTER', siteplanImg: null },
        { id: 'other', parentId: null, type: 'PROJECT', siteplanImg: 'other' },
      ]),
      delete: fn(),
    },
    productVariant: { delete: fn() },
    productMedia: { findMany: fn([{ fileUrl: 'photo' }]) },
    lead: { count: fn(over.leads ?? 0) },
    leadInterest: { count: fn(0) },
  };
  const prisma = {
    product: { findFirst: fn({ id: 'p-1', categoryId: 'root', variants: [], media: [{ mediaType: 'IMAGE', fileUrl: 'cover' }] }) },
    productUnit: { count: fn(0), groupBy: fn([]) },
    productVariant: { findFirst: fn({ id: 'v-1' }), count: fn(2) },
    lead: { count: fn(over.leads ?? 0) },
    leadInterest: { count: fn(0) },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };
  const storage = { remove: fn(), getFilePathFromPublicUrl: (url: string) => url };
  return { tx, prisma, storage, useCase: new ProductUseCase(prisma as never, storage as never) };
}

describe('project removal', () => {
  it('removes its location tree children first and returns cover and siteplan files', async () => {
    const { tx, useCase } = fixture();
    await expect(useCase.remove('p-1', 't-1')).resolves.toEqual(['cover', 'siteplan']);
    expect(tx.productCategory.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't-1' });
    expect(tx.productCategory.delete.mock.calls.map((call) => call[0].where.id)).toEqual(['block', 'cluster', 'root']);
  });

  it('keeps a tree still used by another product', async () => {
    const { tx, useCase } = fixture({ usedCategories: 1 });
    await expect(useCase.remove('p-1', 't-1')).resolves.toEqual(['cover']);
    expect(tx.productCategory.delete).not.toHaveBeenCalled();
  });

  it('explains that a project used by leads must remain', async () => {
    const { prisma, useCase } = fixture({ leads: 1 });
    const error = await useCase.remove('p-1', 't-1').catch((caught: unknown) => caught);
    expect(mapHttpError(error).status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('type removal', () => {
  it('removes photos of the type after the transaction', async () => {
    const { tx, storage, useCase } = fixture();
    await useCase.removeVariant('p-1', 'v-1', 't-1');
    expect(tx.productVariant.delete).toHaveBeenCalledWith({ where: { id: 'v-1' } });
    expect(storage.remove).toHaveBeenCalledWith(['photo']);
  });

  it('explains why a type with units or leads must remain', async () => {
    for (const [over, message] of [[{ units: 1 }, /with units/], [{ leads: 1 }, /used by leads/]] as const) {
      const { tx, useCase } = fixture(over);
      const error = await useCase.removeVariant('p-1', 'v-1', 't-1').catch((caught: unknown) => caught);
      expect(mapHttpError(error)).toMatchObject({ status: 409, message: expect.stringMatching(message) });
      expect(tx.productVariant.delete).not.toHaveBeenCalled();
    }
  });
});
