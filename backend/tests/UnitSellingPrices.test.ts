import { jest } from '@jest/globals';
import { unitSellingPrices } from '../src/usecases/pricing/unitPrices.js';
import { ProductUnitUseCase } from '../src/usecases/product/ProductUnitUseCase.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);
const past = new Date('2020-01-01');
const log = (over: Record<string, unknown>) => ({
  id: 'l', typeVariantId: 'tv-1', categoryId: null, adjustmentPrice: 5n, effectiveStart: past, endDate: null, reason: '', ...over,
});
const db = (logs: unknown[], adjustments: unknown[]) => ({
  productCategory: { findMany: fn([{ id: 'tower', parentId: 'root' }, { id: 'floor', parentId: 'tower' }, { id: 'other', parentId: 'root' }]) },
  productVariantPriceLog: { findMany: fn(logs) },
  unitPriceAdjustment: { findMany: fn(adjustments) },
});
const unit = (id: string, categoryId = 'floor') => ({ id, categoryId, typeVariantId: 'tv-1', typeVariant: { basePrice: 100n } });

describe('unitSellingPrices', () => {
  it('adds variant, location, and unit adjustments per unit', async () => {
    const prisma = db(
      [log({}), log({ categoryId: 'tower', adjustmentPrice: 10n }), log({ adjustmentPrice: 99n, endDate: past })],
      [{ unitId: 'u-1', amount: -20n, effectiveDate: past, approvedAt: past }]
    );
    const prices = await unitSellingPrices(prisma as never, 't-1', [unit('u-1'), unit('u-2'), unit('u-3', 'other')]);
    expect(Object.fromEntries(prices)).toEqual({ 'u-1': 95n, 'u-2': 115n, 'u-3': 105n });
    for (const table of [prisma.productCategory, prisma.productVariantPriceLog, prisma.unitPriceAdjustment]) {
      expect(table.findMany).toHaveBeenCalledTimes(1);
      expect(table.findMany.mock.calls[0][0].where.tenantId).toBe('t-1');
    }
    expect(prisma.unitPriceAdjustment.findMany.mock.calls[0][0].where.status).toBe('APPROVED');
  });

  it('does not query anything without units', async () => {
    const prisma = db([], []);
    await expect(unitSellingPrices(prisma as never, 't-1', [])).resolves.toEqual(new Map());
    expect(prisma.productCategory.findMany).not.toHaveBeenCalled();
  });

  it('is the current price of the unit list used by reservations and deals', async () => {
    const prisma = {
      ...db([], [{ unitId: 'u-1', amount: 15n, effectiveDate: past, approvedAt: past }]),
      reservation: { findMany: fn([]) },
      productUnit: { findMany: fn([{ ...unit('u-1'), variant: { id: 'v' }, typeVariant: { basePrice: 100n, currentPrice: 100n } }]), count: fn(1) },
    };
    const { data } = await new ProductUnitUseCase(prisma as never).list('t-1', { page: 1, limit: 20 });
    expect(data[0]).toMatchObject({ variant: { currentPrice: 115n }, typeVariant: { basePrice: 100n, currentPrice: 115n } });
  });
});
