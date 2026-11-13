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
import { parseUnitPriceFilters } from '../src/presentation/validation/product/unitPrice.js';

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

describe('unit price filters', () => {
  it('accepts YYYY-MM-DD dates and rejects other formats', () => {
    expect(parseUnitPriceFilters({ date: '2026-11-13' }).date).toBe('2026-11-13');
    expect(() => parseUnitPriceFilters({ date: '13-11-2026' })).toThrow(/YYYY-MM-DD/);
    expect(() => parseUnitPriceFilters({ date: 'dd2026-11-13' })).toThrow(/YYYY-MM-DD/);
  });
});
