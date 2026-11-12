import { jest } from '@jest/globals';
import { ProductUseCase } from '../src/usecases/product/ProductUseCase.js';
import { assertUnits, orderLocations } from '../src/usecases/product/catalogStructure.js';
import { parseUnitFilters, validateProduct } from '../src/presentation/validation/ProductRequestValidation.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

describe('orderLocations', () => {
  const loc = (key: string, parentKey: string | null = null) => ({ key, parentKey, name: key, type: 'BLOCK' as const });

  it('puts parents before children whatever the input order', () => {
    const ordered = orderLocations([loc('c', 'b'), loc('b', 'a'), loc('a')]).map((l) => l.key);
    expect(ordered).toEqual(['a', 'b', 'c']);
  });

  it('rejects cycles, unknown parents and duplicate keys', () => {
    expect(() => orderLocations([loc('a', 'b'), loc('b', 'a')])).toThrow(/cycle/);
    expect(() => orderLocations([loc('a', 'x')])).toThrow(/Unknown parentKey/);
    expect(() => orderLocations([loc('a'), loc('a')])).toThrow(/Duplicate location key/);
  });
});

describe('assertUnits', () => {
  it('rejects unknown variant, unknown location and duplicate codes', () => {
    const keys = new Set(['a']);
    expect(() => assertUnits([{ code: 'U1', variantIndex: 1 }], 1, keys)).toThrow(/variant that does not exist/);
    expect(() => assertUnits([{ code: 'U1', variantIndex: 0, locationKey: 'z' }], 1, keys)).toThrow(/unknown location/);
    expect(() =>
      assertUnits([{ code: 'U1', variantIndex: 0 }, { code: 'U1', variantIndex: 0 }], 1, keys)
    ).toThrow(/Duplicate unit code/);
    expect(() => assertUnits([{ code: 'U1', variantIndex: 0, locationKey: 'a' }], 1, keys)).not.toThrow();
  });
});

describe('ProductUseCase.create (whole project)', () => {
  it('creates the PROJECT root, variants, attributes, tree and units in one transaction', async () => {
    const tx = {
      productCategory: {
        create: jest
          .fn<(...args: any[]) => any>()
          .mockResolvedValueOnce({ id: 'root' })
          .mockResolvedValueOnce({ id: 'n-cluster' })
          .mockResolvedValueOnce({ id: 'n-block' }),
      },
      product: { create: fn({ id: 'p-1' }) },
      productVariant: { create: fn({ id: 'v-1' }) },
      attribute: { findFirst: fn(null), create: fn({ id: 'attr-1' }) },
      productAttribute: { createMany: fn({ count: 1 }) },
      productUnit: { createMany: fn({ count: 1 }) },
    };
    const prisma = {
      product: { findFirst: fn({ id: 'p-1', variants: [], media: [] }) },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    };
    const useCase = new ProductUseCase(prisma as never);

    await useCase.create('t-1', {
      name: 'Citraland',
      code: 'CL',
      city: 'Malang',
      variants: [
        {
          name: 'Type 36',
          basePrice: 350000000,
          stock: 2,
          attributes: [{ name: 'Bedroom', code: 'bedroom', dataType: 'NUMBER', value: 2 }],
        },
      ],
      locations: [
        { key: 'b', parentKey: 'c', name: 'Block A', type: 'BLOCK' },
        { key: 'c', name: 'Cluster 1', type: 'CLUSTER' },
      ],
      units: [{ code: 'A-01', variantIndex: 0, locationKey: 'b', status: 'RESERVED' }],
    });

    const [rootCall, clusterCall, blockCall] = tx.productCategory.create.mock.calls.map((c) => c[0].data);
    expect(rootCall).toMatchObject({ tenantId: 't-1', name: 'Citraland', code: 'CL', type: 'PROJECT' });
    expect(clusterCall).toMatchObject({ parentId: 'root', type: 'CLUSTER', code: 'CL-001' });
    expect(blockCall).toMatchObject({ parentId: 'n-cluster', type: 'BLOCK', code: 'CL-002' });
    expect(tx.product.create.mock.calls[0][0].data).toMatchObject({ categoryId: 'root', name: 'Citraland', city: 'Malang', province: null });
    expect(tx.attribute.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't-1', code: 'bedroom' });
    expect(tx.productAttribute.createMany.mock.calls[0][0].data[0]).toMatchObject({
      variantId: 'v-1',
      attributeId: 'attr-1',
      value: 2,
    });
    expect(tx.productUnit.createMany.mock.calls[0][0].data[0]).toMatchObject({
      variantId: 'v-1',
      categoryId: 'n-block',
      code: 'A-01',
      status: 'RESERVED',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing master attribute instead of creating it again', async () => {
    const tx = {
      productCategory: { create: fn({ id: 'root' }) },
      product: { create: fn({ id: 'p-1' }) },
      productVariant: { create: jest.fn<(...args: any[]) => any>().mockResolvedValueOnce({ id: 'v-1' }).mockResolvedValueOnce({ id: 'v-2' }) },
      attribute: { findFirst: fn({ id: 'attr-9' }), create: fn() },
      productAttribute: { createMany: fn({ count: 1 }) },
    };
    const prisma = {
      product: { findFirst: fn({ id: 'p-1', variants: [], media: [] }) },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    };
    const bedroom = { name: 'Bedroom', code: 'bedroom', dataType: 'NUMBER' as const, value: 2 };
    await new ProductUseCase(prisma as never).create('t-1', {
      name: 'X',
      code: 'X',
      variants: [
        { name: 'A', basePrice: 1, attributes: [bedroom] },
        { name: 'B', basePrice: 1, attributes: [{ ...bedroom, value: 3 }] },
      ],
    });
    expect(tx.attribute.create).not.toHaveBeenCalled();
    expect(tx.attribute.findFirst).toHaveBeenCalledTimes(1); // second variant hits the in-transaction cache
    expect(tx.productAttribute.createMany.mock.calls.map((c) => c[0].data[0].attributeId)).toEqual(['attr-9', 'attr-9']);
  });

  it('stores 0 for an attribute sent without a value', async () => {
    const tx = {
      productCategory: { create: fn({ id: 'root' }) },
      product: { create: fn({ id: 'p-1' }) },
      productVariant: { create: fn({ id: 'v-1' }) },
      attribute: { findFirst: fn({ id: 'attr-1' }), create: fn() },
      productAttribute: { createMany: fn({ count: 1 }) },
    };
    const prisma = {
      product: { findFirst: fn({ id: 'p-1', variants: [], media: [] }) },
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    };
    await new ProductUseCase(prisma as never).create('t-1', {
      name: 'X',
      code: 'X',
      variants: [{ name: 'A', basePrice: 1, attributes: [{ name: 'Carport', code: 'carport', dataType: 'NUMBER' }] }],
    });
    expect(tx.productAttribute.createMany.mock.calls[0][0].data[0]).toMatchObject({ value: 0 });
  });

  it('rejects bad structure before opening a transaction', async () => {
    const prisma = { $transaction: jest.fn() };
    const useCase = new ProductUseCase(prisma as never);
    await expect(
      useCase.create('t-1', {
        name: 'X',
        code: 'X',
        variants: [{ name: 'T', basePrice: 1 }],
        units: [{ code: 'U', variantIndex: 3 }],
      })
    ).rejects.toThrow(/variant that does not exist/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('project request validation', () => {
  const base = { name: 'Citraland', code: 'CL', variants: [{ name: 'T', basePrice: 1 }] };

  it('works without categoryId and accepts locations and units', () => {
    const result = validateProduct({
      ...base,
      locations: [{ key: 'a', name: 'Cluster', type: 'CLUSTER' }],
      units: [{ code: 'U1', variantIndex: 0, locationKey: 'a', status: 'SOLD' }],
    });
    expect(result.locations).toHaveLength(1);
    expect(result.units?.[0]).toMatchObject({ code: 'U1', status: 'SOLD' });
  });

  it('rejects bad unit status, bad location type and locations on update', () => {
    expect(() => validateProduct({ ...base, units: [{ code: 'U', variantIndex: 0, status: 'GONE' }] })).toThrow(
      /status must be one of/
    );
    expect(() => validateProduct({ ...base, locations: [{ key: 'a', name: 'R', type: 'ROOM' }] })).toThrow(
      /type must be one of/
    );
    expect(() => validateProduct({ locations: [] }, true)).toThrow(/only be sent when creating/);
  });

  it('reads unit status filters case-insensitively', () => {
    expect(parseUnitFilters({ status: 'sold', productId: 'p' })).toEqual({ status: 'SOLD', productId: 'p' });
    expect(() => parseUnitFilters({ status: 'x' })).toThrow(/status must be one of/);
  });
});
