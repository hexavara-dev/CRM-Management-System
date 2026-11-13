import { jest } from '@jest/globals';
import {
  activeAdjustment,
  activeLogsForUnit,
  ancestorChain,
  needsApproval,
  sellingPrice,
  sumLogs,
  toDateValue,
  todayInPriceZone,
  type PriceLogRow,
} from '../src/usecases/pricing/priceRules.js';
import { UnitPriceUseCase } from '../src/usecases/pricing/UnitPriceUseCase.js';
import {
  parseUnitPriceFilters,
  validateAdjustment,
  validateReview,
} from '../src/presentation/validation/product/unitPrice.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);
const big = (n: number) => BigInt(n);

const log = (over: Partial<PriceLogRow>): PriceLogRow => ({
  id: 'l',
  variantId: 'v-45',
  categoryId: null,
  adjustmentPrice: big(20_000_000),
  effectiveStart: toDateValue('2026-11-01'),
  endDate: null,
  reason: 'Kenaikan',
  ...over,
});

describe('price rules', () => {
  const parents = new Map<string, string | null>([
    ['block-b', 'cluster'],
    ['cluster', 'project'],
    ['project', null],
  ]);

  it('builds the location chain from the unit up to the root', () => {
    expect(ancestorChain('block-b', parents)).toEqual(['block-b', 'cluster', 'project']);
  });

  it('applies logs for all units, the block, and its ancestors only', () => {
    const chain = ancestorChain('block-b', parents);
    const logs = [
      log({ id: 'all' }),
      log({ id: 'block', categoryId: 'block-b' }),
      log({ id: 'cluster', categoryId: 'cluster' }),
      log({ id: 'other-block', categoryId: 'block-a' }),
      log({ id: 'other-variant', variantId: 'v-36' }),
    ];
    expect(activeLogsForUnit(logs, 'v-45', chain, '2026-11-13').map((l) => l.id)).toEqual([
      'all',
      'block',
      'cluster',
    ]);
  });

  it('ignores scheduled and expired logs', () => {
    const logs = [
      log({ id: 'scheduled', effectiveStart: toDateValue('2026-12-01') }),
      log({ id: 'expired', endDate: toDateValue('2026-11-12') }),
      log({ id: 'last-day', endDate: toDateValue('2026-11-13') }),
    ];
    expect(activeLogsForUnit(logs, 'v-45', [], '2026-11-13').map((l) => l.id)).toEqual(['last-day']);
  });

  it('uses the latest effective adjustment instead of adding them up', () => {
    const rows = [
      { unitId: 'u', amount: big(10), effectiveDate: toDateValue('2026-10-01'), approvedAt: new Date(1) },
      { unitId: 'u', amount: big(15), effectiveDate: toDateValue('2026-11-01'), approvedAt: new Date(2) },
      { unitId: 'u', amount: big(99), effectiveDate: toDateValue('2026-12-01'), approvedAt: new Date(3) },
    ];
    expect(activeAdjustment(rows, '2026-11-13')?.amount).toBe(big(15));
    expect(activeAdjustment(rows, '2026-09-01')).toBeNull();
  });

  it('computes the selling price from base, logs, and adjustment', () => {
    const total = sumLogs([log({}), log({ adjustmentPrice: big(5_000_000) })]);
    expect(sellingPrice(big(450_000_000), total, big(10_000_000))).toBe(big(485_000_000));
  });

  it('requires approval only below a configured minimum', () => {
    expect(needsApproval(big(400), big(440))).toBe(true);
    expect(needsApproval(big(440), big(440))).toBe(false);
    expect(needsApproval(big(1), null)).toBe(false);
  });

  it('formats today in the Jakarta time zone', () => {
    expect(todayInPriceZone(new Date('2026-11-12T18:00:00Z'))).toBe('2026-11-13');
  });
});

describe('UnitPriceUseCase.createAdjustment', () => {
  const today = todayInPriceZone();
  const actor = { tenantId: 't-1', userId: 'owner-1' };
  const unit = {
    id: 'u-1',
    categoryId: 'block-b',
    variantId: 'v-45',
    status: 'AVAILABLE',
    variant: { id: 'v-45', name: 'Type 45', basePrice: big(450_000_000), minPrice: big(440_000_000), product: {} },
    category: {},
  };

  function prisma(over: { unit?: unknown; pending?: number } = {}) {
    const tx = {
      unitPriceAdjustment: {
        count: fn(over.pending ?? 0),
        create: jest.fn(async ({ data }: { data: unknown }) => data),
      },
    };
    return {
      tx,
      productUnit: { findFirst: fn('unit' in over ? over.unit : unit) },
      productCategory: { findMany: fn([]) },
      productVariantPriceLog: { findMany: fn([]) },
      unitPriceAdjustment: { findMany: fn([]) },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    };
  }

  const input = (amount: number, effectiveDate = today) => ({ amount, reason: 'Posisi hook', effectiveDate });

  it('applies an adjustment at or above the minimum immediately', async () => {
    const db = prisma();
    const row = (await new UnitPriceUseCase(db as never).createAdjustment('u-1', actor, input(-10_000_000))) as any;
    expect(row.status).toBe('APPROVED');
    expect(row.approvedById).toBe('owner-1');
    expect(row.priceBefore).toBe(big(450_000_000));
    expect(row.priceAfter).toBe(big(440_000_000));
    expect(row.tenantId).toBe('t-1');
  });

  it('marks an adjustment below the minimum as pending', async () => {
    const db = prisma();
    const row = (await new UnitPriceUseCase(db as never).createAdjustment('u-1', actor, input(-20_000_000))) as any;
    expect(row.status).toBe('PENDING');
    expect(row.approvedById).toBeUndefined();
    expect(row.minPrice).toBe(big(440_000_000));
  });

  it('rejects a second adjustment while one is pending', async () => {
    const db = prisma({ pending: 1 });
    await expect(
      new UnitPriceUseCase(db as never).createAdjustment('u-1', actor, input(1_000_000))
    ).rejects.toThrow(/pending adjustment/);
  });

  it('rejects past dates, sold units, negative prices, and other tenants', async () => {
    await expect(
      new UnitPriceUseCase(prisma() as never).createAdjustment('u-1', actor, input(1, '2000-01-01'))
    ).rejects.toThrow(/today or later/);
    await expect(
      new UnitPriceUseCase(prisma({ unit: { ...unit, status: 'SOLD' } }) as never).createAdjustment('u-1', actor, input(1))
    ).rejects.toThrow(/sold unit/);
    await expect(
      new UnitPriceUseCase(prisma() as never).createAdjustment('u-1', actor, input(-500_000_000))
    ).rejects.toThrow(/at least 0/);

    const db = prisma({ unit: null });
    await expect(new UnitPriceUseCase(db as never).createAdjustment('u-1', actor, input(1))).rejects.toThrow(
      'Unit not found'
    );
    expect(db.productUnit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1', tenantId: 't-1' } })
    );
  });
});

describe('UnitPriceUseCase.review', () => {
  const actor = { tenantId: 't-1', userId: 'owner-1' };

  it('decides a pending adjustment only once', async () => {
    const db = {
      unitPriceAdjustment: {
        updateMany: fn({ count: 0 }),
        findFirst: fn({ id: 'a-1' }),
      },
    };
    await expect(new UnitPriceUseCase(db as never).review('a-1', actor, 'APPROVED')).rejects.toThrow(
      /Only pending/
    );
    expect(db.unitPriceAdjustment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a-1', tenantId: 't-1', status: 'PENDING' } })
    );
  });

  it('requires a note to reject', async () => {
    await expect(new UnitPriceUseCase({} as never).review('a-1', actor, 'REJECTED', ' ')).rejects.toThrow(
      /note is required/
    );
  });
});

describe('unit price validation', () => {
  it('requires a reason and a valid effective date', () => {
    expect(() => validateAdjustment({ amount: 1, effectiveDate: '2026-11-13' })).toThrow(/reason is required/);
    expect(() => validateAdjustment({ amount: 1, reason: 'Hook', effectiveDate: '13-11-2026' })).toThrow(
      /YYYY-MM-DD/
    );
    expect(() => validateAdjustment({ amount: 1.5, reason: 'Hook', effectiveDate: '2026-11-13' })).toThrow(
      /integer/
    );
  });

  it('requires a note only when rejecting', () => {
    expect(validateReview({}, false)).toBeUndefined();
    expect(() => validateReview({}, true)).toThrow(/note is required/);
  });
});

describe('unit price filters', () => {
  it('accepts YYYY-MM-DD dates and rejects other formats', () => {
    expect(parseUnitPriceFilters({ date: '2026-11-13' }).date).toBe('2026-11-13');
    expect(() => parseUnitPriceFilters({ date: '13-11-2026' })).toThrow(/YYYY-MM-DD/);
    expect(() => parseUnitPriceFilters({ date: 'dd2026-11-13' })).toThrow(/YYYY-MM-DD/);
  });
});
