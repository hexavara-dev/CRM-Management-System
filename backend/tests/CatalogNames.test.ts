import { jest } from '@jest/globals';
import { assertLocationNames, swappedNames } from '../src/usecases/product/catalogStructure.js';
import { ReservationUseCase } from '../src/usecases/reservation/ReservationUseCase.js';

const location = (key: string, name: string, parentKey?: string) => ({
  key, name, type: 'BLOCK' as const, ...(parentKey ? { parentKey } : {}),
});

describe('assertLocationNames', () => {
  const twins = [location('a', 'Blok A'), location('b', ' blok a ')];

  it('rejects a new twin below the same parent only', () => {
    expect(() => assertLocationNames(twins, (item) => item.key === 'b')).toThrow(/sudah ada di lokasi induk/);
    expect(() => assertLocationNames(twins, (item) => item.key === 'a')).toThrow(/sudah ada di lokasi induk/);
    expect(() =>
      assertLocationNames([location('t1', 'T1'), location('t2', 'T2'), location('x', 'Lantai 1', 't1'), location('y', 'Lantai 1', 't2')], () => true)
    ).not.toThrow();
  });

  it('keeps existing twins savable', () => {
    expect(() => assertLocationNames(twins, () => false)).not.toThrow();
  });
});

describe('swappedNames', () => {
  const current = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }];

  it('finds variants whose old name is taken over by another variant', () => {
    expect(swappedNames(current, [{ id: '1', name: 'B' }, { id: '2', name: 'A' }, { id: '3', name: 'C' }])).toEqual(['1', '2']);
    expect(swappedNames(current, [{ id: '1', name: 'D' }, { name: 'a' }])).toEqual(['1']);
    expect(swappedNames(current, [{ id: '1', name: 'D' }, { id: '2', name: 'B' }])).toEqual([]);
  });
});

describe('reservations of inactive projects', () => {
  it('are rejected before the unit is claimed', async () => {
    const fn = (value?: unknown) => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);
    const tx = {
      productUnit: {
        findFirst: fn({ id: 'u', code: 'A-01', categoryId: 'c', typeVariantId: 'tv', typeVariant: { basePrice: 1n }, variant: { product: { isActive: false } } }),
        updateMany: fn({ count: 1 }),
      },
      user: { findFirst: fn({ id: 's' }) },
    };
    const prisma = { $transaction: async (action: any) => action(tx) };
    await expect(
      new ReservationUseCase(prisma as never).create({ unitId: 'u', customerName: 'C', price: 1 }, 't', 's')
    ).rejects.toThrow(/Conflict: unit A-01 berada di proyek yang tidak aktif/);
    expect(tx.productUnit.updateMany).not.toHaveBeenCalled();
  });
});
