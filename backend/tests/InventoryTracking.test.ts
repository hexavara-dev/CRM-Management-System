import { jest } from '@jest/globals';
import {
  InventoryTrackingUseCase,
  quantityTrackingEnabled,
  unitTrackingEnabled,
} from '../src/usecases/settings/InventoryTrackingUseCase.js';
import { validateInventoryTracking } from '../src/presentation/validation/settings/inventoryTracking.js';
import { ProductUseCase } from '../src/usecases/product/ProductUseCase.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

function prisma(mode: string, units: { variant: { productId: string } }[] = []) {
  return {
    company: { findUnique: fn({ trackingType: mode }), update: fn({}) },
    productUnit: { findMany: fn(units) },
  };
}

describe('inventory tracking rules', () => {
  it('enables unit and quantity tracking according to the mode', () => {
    expect([unitTrackingEnabled('UNIT'), quantityTrackingEnabled('UNIT')]).toEqual([true, false]);
    expect([unitTrackingEnabled('QUANTITY'), quantityTrackingEnabled('QUANTITY')]).toEqual([false, true]);
    expect([unitTrackingEnabled('BOTH'), quantityTrackingEnabled('BOTH')]).toEqual([true, true]);
  });
});

describe('InventoryTrackingUseCase', () => {
  const units = [{ variant: { productId: 'p-1' } }, { variant: { productId: 'p-1' } }, { variant: { productId: 'p-2' } }];

  it('returns the mode, flags, and unit usage of the tenant', async () => {
    const db = prisma('UNIT', units);
    await expect(new InventoryTrackingUseCase(db as never).get('t-1')).resolves.toEqual({
      mode: 'UNIT',
      unitTrackingEnabled: true,
      quantityTrackingEnabled: false,
      unitCount: 3,
      projectCount: 2,
    });
    expect(db.company.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't-1' } }));
    expect(db.productUnit.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't-1' } }));
  });

  it('updates the mode of the tenant', async () => {
    const db = prisma('UNIT');
    await new InventoryTrackingUseCase(db as never).update('t-1', 'BOTH');
    expect(db.company.update).toHaveBeenCalledWith({ where: { id: 't-1' }, data: { trackingType: 'BOTH' } });
  });

  it('rejects quantity-based only while units exist', async () => {
    const db = prisma('UNIT', units);
    await expect(new InventoryTrackingUseCase(db as never).update('t-1', 'QUANTITY')).rejects.toThrow(
      /3 units exist in 2 projects \(conflict\)/
    );
    expect(db.company.update).not.toHaveBeenCalled();
  });

  it('allows quantity-based only without units', async () => {
    const db = prisma('BOTH');
    await new InventoryTrackingUseCase(db as never).update('t-1', 'QUANTITY');
    expect(db.company.update).toHaveBeenCalled();
  });
});

describe('inventory tracking validation', () => {
  it('accepts the three modes case-insensitively', () => {
    expect(validateInventoryTracking({ mode: 'both' })).toBe('BOTH');
    expect(validateInventoryTracking({ mode: 'QUANTITY' })).toBe('QUANTITY');
  });

  it('rejects missing, unknown, and extra fields', () => {
    expect(() => validateInventoryTracking({})).toThrow(/mode is required/);
    expect(() => validateInventoryTracking({ mode: 'ALL' })).toThrow(/must be one of/);
    expect(() => validateInventoryTracking({ mode: 'UNIT', tenantId: 'x' })).toThrow(/Unsupported field/);
  });
});

describe('unit creation guard', () => {
  it('rejects creating units while unit-based tracking is disabled', async () => {
    const db = prisma('QUANTITY');
    const input = {
      name: 'Project',
      code: 'PRJ',
      variants: [{ name: 'Type 36', basePrice: 1 }],
      units: [{ code: 'A-01', variantIndex: 0 }],
    };
    await expect(new ProductUseCase(db as never).create('t-1', input as never)).rejects.toThrow(
      /Unit-based tracking is disabled/
    );
  });
});
