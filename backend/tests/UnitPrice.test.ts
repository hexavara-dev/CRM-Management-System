import { jest } from '@jest/globals';
import {
  activeAdjustment,
  activeLogsForUnit,
  ancestorChain,
  needsApproval,
  PRICE_APPROVAL_ENABLED,
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
  validateBulkAdjustment,
  validateReview,
} from '../src/presentation/validation/product/unitPrice.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);
const big = (n: number) => BigInt(n);

const log = (over: Partial<PriceLogRow>): PriceLogRow => ({
  id: 'l',
  typeVariantId: 'tv-45',
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
      log({ id: 'other-variant', typeVariantId: 'tv-36' }),
    ];
    expect(activeLogsForUnit(logs, 'tv-45', chain, '2026-11-13').map((l) => l.id)).toEqual([
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
    expect(activeLogsForUnit(logs, 'tv-45', [], '2026-11-13').map((l) => l.id)).toEqual(['last-day']);
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

  it('requires approval only below a configured minimum when approval is enabled', () => {
    expect(needsApproval(big(400), big(440), true)).toBe(true);
    expect(needsApproval(big(440), big(440), true)).toBe(false);
    expect(needsApproval(big(1), null, true)).toBe(false);
  });

  it('never requires approval while approval is disabled', () => {
    expect(PRICE_APPROVAL_ENABLED).toBe(false);
    expect(needsApproval(big(400), big(440))).toBe(false);
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
    typeVariantId: 'tv-45',
    status: 'AVAILABLE',
    variant: { id: 'v-45', name: 'Type 45', basePrice: big(450_000_000), minPrice: big(440_000_000), product: {} },
    typeVariant: { id: 'tv-45', name: 'Standard', basePrice: big(450_000_000), minPrice: big(440_000_000) },
    category: {},
  };
  const input = (price: number, effectiveDate = today) => ({ price, reason: 'Posisi hook', effectiveDate });

  function prisma(over: { unit?: unknown; pending?: number; adjustments?: unknown[]; logs?: unknown[] } = {}) {
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
      productVariantPriceLog: { findMany: fn(over.logs ?? []) },
      unitPriceAdjustment: { findMany: fn(over.adjustments ?? []) },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    };
  }

  it('sets the selling price to the final price instead of adding it', async () => {
    const active = { unitId: 'u-1', amount: big(40_000_000), effectiveDate: toDateValue('2026-01-01'), approvedAt: new Date(1) };
    const db = prisma({ adjustments: [active], logs: [log({ adjustmentPrice: big(10_000_000) })] });
    const row = (await new UnitPriceUseCase(db as never).createAdjustment('u-1', actor, input(600_000_000))) as any;
    expect(row.priceBefore).toBe(big(500_000_000));
    expect(row.priceAfter).toBe(big(600_000_000));
    // 600jt - harga dasar 450jt - kenaikan tipe 10jt
    expect(row.amount).toBe(big(140_000_000));
    expect(row.status).toBe('APPROVED');
    expect(row.approvedById).toBe('owner-1');
    expect(row.tenantId).toBe('t-1');
  });

  it('allows a final price below the base price', async () => {
    const row = (await new UnitPriceUseCase(prisma() as never).createAdjustment('u-1', actor, input(200_000_000))) as any;
    expect(row.priceAfter).toBe(big(200_000_000));
    expect(row.amount).toBe(big(-250_000_000));
  });

  it('rejects a price equal to the current selling price', async () => {
    await expect(
      new UnitPriceUseCase(prisma() as never).createAdjustment('u-1', actor, input(450_000_000))
    ).rejects.toThrow(/must differ/);
  });

  it('approves a price below the minimum while approval is disabled', async () => {
    const row = (await new UnitPriceUseCase(prisma() as never).createAdjustment('u-1', actor, input(430_000_000))) as any;
    expect(row.status).toBe('APPROVED');
    expect(row.priceAfter).toBe(big(430_000_000));
    expect(row.minPrice).toBe(big(440_000_000));
  });

  it('rejects a second adjustment while one is pending', async () => {
    await expect(
      new UnitPriceUseCase(prisma({ pending: 1 }) as never).createAdjustment('u-1', actor, input(1))
    ).rejects.toThrow(/pending adjustment/);
  });

  it('rejects past dates, sold units, and other tenants', async () => {
    await expect(
      new UnitPriceUseCase(prisma() as never).createAdjustment('u-1', actor, input(1, '2000-01-01'))
    ).rejects.toThrow(/today or later/);
    await expect(
      new UnitPriceUseCase(prisma({ unit: { ...unit, status: 'SOLD' } }) as never).createAdjustment('u-1', actor, input(1))
    ).rejects.toThrow(/sold unit/);

    const db = prisma({ unit: null });
    await expect(new UnitPriceUseCase(db as never).createAdjustment('u-1', actor, input(1))).rejects.toThrow(
      'Unit not found'
    );
    expect(db.productUnit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1', tenantId: 't-1' } })
    );
  });
});

describe('UnitPriceUseCase.createBulkAdjustment', () => {
  const today = todayInPriceZone();
  const actor = { tenantId: 't-1', userId: 'owner-1' };
  const input = (price: number) => ({ price, reason: 'Harga baru Q4', effectiveDate: today });
  const unit = (id: string, over: { status?: string; productId?: string; basePrice?: number } = {}) => ({
    id,
    code: id.toUpperCase(),
    categoryId: 'block-a',
    variantId: 'v-36',
    typeVariantId: 'tv-36',
    status: over.status ?? 'AVAILABLE',
    variant: {
      id: 'v-36',
      name: 'Type 36',
      basePrice: big(over.basePrice ?? 350_000_000),
      minPrice: big(340_000_000),
      product: { id: over.productId ?? 'p-1', name: 'Project' },
    },
    typeVariant: {
      id: 'tv-36', name: 'Standard', basePrice: big(over.basePrice ?? 350_000_000), minPrice: big(340_000_000),
    },
    category: {},
  });

  function prisma(units: unknown[], over: { pending?: unknown[]; adjustments?: unknown[] } = {}) {
    const tx = {
      unitPriceAdjustment: {
        findMany: fn(over.pending ?? []),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: `adj-${data.unitId}`, ...data })),
      },
    };
    return {
      tx,
      productUnit: { findMany: fn(units) },
      productCategory: { findMany: fn([]) },
      productVariantPriceLog: { findMany: fn([]) },
      unitPriceAdjustment: { findMany: fn(over.adjustments ?? []) },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    };
  }

  it('sets every unit to the same final price in one transaction', async () => {
    const active = { unitId: 'u-2', amount: big(10_000_000), effectiveDate: toDateValue('2026-01-01'), approvedAt: new Date(1) };
    const db = prisma([unit('u-1'), unit('u-2'), unit('u-3', { basePrice: 450_000_000 })], { adjustments: [active] });
    const result = await new UnitPriceUseCase(db as never).createBulkAdjustment(['u-1', 'u-2', 'u-3'], actor, input(400_000_000));

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(result.count).toBe(3);
    expect(result.data.map((r) => [r.code, r.priceBefore, r.priceAfter])).toEqual([
      ['U-1', big(350_000_000), big(400_000_000)],
      ['U-2', big(360_000_000), big(400_000_000)],
      ['U-3', big(450_000_000), big(400_000_000)],
    ]);
    const created = db.tx.unitPriceAdjustment.create.mock.calls.map(([arg]) => (arg as { data: any }).data);
    expect(created.find((d) => d.unitId === 'u-2').amount).toBe(big(50_000_000));
    expect(created.find((d) => d.unitId === 'u-3').amount).toBe(big(-50_000_000));
    expect(created.every((d) => d.tenantId === 't-1' && d.status === 'APPROVED')).toBe(true);
    expect(db.productUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['u-1', 'u-2', 'u-3'] }, tenantId: 't-1' } })
    );
  });

  it('skips units already at the final price and rejects when none change', async () => {
    const db = prisma([unit('u-1'), unit('u-2', { basePrice: 400_000_000 })]);
    const result = await new UnitPriceUseCase(db as never).createBulkAdjustment(['u-1', 'u-2'], actor, input(400_000_000));
    expect(result.data.map((r) => r.code)).toEqual(['U-1']);

    await expect(
      new UnitPriceUseCase(prisma([unit('u-1')]) as never).createBulkAdjustment(['u-1'], actor, input(350_000_000))
    ).rejects.toThrow(/must differ/);
  });

  it('rejects units of another tenant or missing units', async () => {
    const db = prisma([unit('u-1')]);
    await expect(
      new UnitPriceUseCase(db as never).createBulkAdjustment(['u-1', 'u-x'], actor, input(1))
    ).rejects.toThrow('Units not found: u-x');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects units from different projects', async () => {
    const db = prisma([unit('u-1'), unit('u-2', { productId: 'p-2' })]);
    await expect(
      new UnitPriceUseCase(db as never).createBulkAdjustment(['u-1', 'u-2'], actor, input(1))
    ).rejects.toThrow(/same project/);
  });

  it('rejects sold units with their codes', async () => {
    await expect(
      new UnitPriceUseCase(prisma([unit('u-1'), unit('u-2', { status: 'SOLD' })]) as never).createBulkAdjustment(
        ['u-1', 'u-2'],
        actor,
        input(1)
      )
    ).rejects.toThrow(/sold unit.*U-2/);
  });

  it('rejects units with a pending adjustment and writes nothing', async () => {
    const db = prisma([unit('u-1'), unit('u-2')], { pending: [{ unitId: 'u-2' }] });
    await expect(
      new UnitPriceUseCase(db as never).createBulkAdjustment(['u-1', 'u-2'], actor, input(1))
    ).rejects.toThrow(/pending adjustment.*U-2/);
    expect(db.tx.unitPriceAdjustment.create).not.toHaveBeenCalled();
  });
});

describe('bulk adjustment validation', () => {
  const base = { price: 1, reason: 'Hook', effectiveDate: '2026-11-16' };

  it('requires 1 to 100 unique unit ids', () => {
    expect(() => validateBulkAdjustment({ ...base })).toThrow(/non-empty array/);
    expect(() => validateBulkAdjustment({ ...base, unitIds: [] })).toThrow(/non-empty array/);
    const many = Array.from({ length: 101 }, (_, i) => `u-${i}`);
    expect(() => validateBulkAdjustment({ ...base, unitIds: many })).toThrow(/at most 100/);
    expect(() => validateBulkAdjustment({ ...base, unitIds: ['a', 'a'] })).toThrow(/duplicates/);
    expect(() => validateBulkAdjustment({ ...base, unitIds: [1] })).toThrow(/valid unit ids/);
  });

  it('applies the single adjustment rules', () => {
    expect(() => validateBulkAdjustment({ unitIds: ['a'], price: 1 })).toThrow(/reason is required/);
    expect(validateBulkAdjustment({ ...base, unitIds: ['a'] })).toEqual({ ...base, unitIds: ['a'] });
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
    expect(() => validateAdjustment({ price: 1, effectiveDate: '2026-11-13' })).toThrow(/reason is required/);
    expect(() => validateAdjustment({ price: -1, reason: 'Hook', effectiveDate: '2026-11-13' })).toThrow();
    expect(() => validateAdjustment({ amount: 1, reason: 'Hook', effectiveDate: '2026-11-13' })).toThrow();
    expect(() => validateAdjustment({ price: 1, reason: 'Hook', effectiveDate: '13-11-2026' })).toThrow(
      /YYYY-MM-DD/
    );
    expect(() => validateAdjustment({ price: 1.5, reason: 'Hook', effectiveDate: '2026-11-13' })).toThrow(
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

describe('UnitPriceUseCase.list summary', () => {
  it('summarizes all filtered units, not only the current page', async () => {
    const unit = (id: string, status: string, productId: string, basePrice: number) => ({
      id,
      code: id,
      name: null,
      status,
      variantId: `v-${productId}`,
      typeVariantId: `tv-${productId}`,
      categoryId: 'block',
      variant: { id: `v-${productId}`, name: 'Type', basePrice: BigInt(basePrice), minPrice: null, product: { id: productId, name: productId } },
      typeVariant: { id: `tv-${productId}`, name: 'Standard', basePrice: BigInt(basePrice), minPrice: null },
      category: { id: 'block', name: 'Block', type: 'BLOCK' },
    });
    const units = [
      unit('A1', 'AVAILABLE', 'p-1', 100),
      unit('A2', 'SOLD', 'p-1', 200),
      unit('B1', 'RESERVED', 'p-2', 300),
    ];
    const ok = (value: unknown) => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);
    const db = {
      productUnit: { findMany: ok(units) },
      unitPriceAdjustment: { count: ok(0), findMany: ok([]) },
      productCategory: { findMany: ok([]) },
      productVariantPriceLog: { findMany: ok([]) },
    };
    const result = await new UnitPriceUseCase(db as never).list('t-1', { page: 1, limit: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(3);
    expect(result.summary.totalProjects).toBe(2);
    expect(result.summary.byStatus).toMatchObject({ AVAILABLE: 1, SOLD: 1, RESERVED: 1 });
    expect(result.summary.unsoldValue).toBe(BigInt(400));
  });
});
