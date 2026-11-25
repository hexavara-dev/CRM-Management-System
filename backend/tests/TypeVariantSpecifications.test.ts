import { jest } from '@jest/globals';
import { AvailabilityUseCase } from '../src/usecases/availability/AvailabilityUseCase.js';
import { ProductUseCase } from '../src/usecases/product/ProductUseCase.js';
import { mapHttpError } from '../src/infrastructure/utils/HttpErrorMapper.js';
import { validateAttribute, validateProduct, validateVariant } from '../src/presentation/validation/ProductRequestValidation.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);
const spec = (code: string, value: number) => ({ name: code, code, dataType: 'NUMBER' as const, value });

function variantFixture(source = 'UNIT_TYPE') {
  const option = (id: string, name: string) => ({
    id, name, code: null, basePrice: BigInt(1), currentPrice: BigInt(1), minPrice: null, stock: 5, isActive: true,
  });
  const tx = {
    productVariant: { update: fn({ id: 'v-1' }) },
    productTypeVariant: {
      findMany: fn([option('tv-1', 'Standard'), option('tv-2', 'Premium')]),
      update: jest.fn(async ({ where }: any) => ({ id: where.id })),
    },
    productUnit: { count: fn(0) },
    attribute: { findFirst: fn({ id: 'a-bed', source }), create: fn() },
    productAttribute: {
      findMany: jest.fn(async ({ where }: any) =>
        where.typeVariantId === 'tv-1' ? [{ id: 'pa-1', attributeId: 'a-bed', value: 2 }] : []),
      create: fn({}),
      update: fn({}),
    },
  };
  const prisma = {
    productVariant: { findFirst: fn({ id: 'v-1' }) },
    $transaction: jest.fn(async (cb: (client: unknown) => unknown) => cb(tx)),
  };
  return { tx, useCase: new ProductUseCase(prisma as never), prisma };
}
const typeVariants = (standard?: ReturnType<typeof spec>[], premium?: ReturnType<typeof spec>[]) => [
  { id: 'tv-1', name: 'Standard', basePrice: 1, stock: 5, ...(standard ? { attributes: standard } : {}) },
  { id: 'tv-2', name: 'Premium', basePrice: 1, stock: 5, ...(premium ? { attributes: premium } : {}) },
];

describe('type variant specifications', () => {
  it('stores different values per variant in one transaction', async () => {
    const { tx, useCase, prisma } = variantFixture();
    await useCase.updateVariant('p-1', 'v-1', 't-1', { typeVariants: typeVariants([spec('bedroom', 4)], [spec('bedroom', 3)]) });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.productAttribute.update).toHaveBeenCalledWith({ where: { id: 'pa-1' }, data: { value: 4 } });
    expect(tx.productAttribute.create).toHaveBeenCalledWith({
      data: { tenantId: 't-1', productId: 'p-1', variantId: 'v-1', typeVariantId: 'tv-2', attributeId: 'a-bed', value: 3 },
    });
  });

  it('keeps specifications that are not sent and skips unchanged values', async () => {
    const { tx, useCase } = variantFixture();
    await useCase.updateVariant('p-1', 'v-1', 't-1', { typeVariants: typeVariants([spec('bedroom', 2)]) });
    expect(tx.productAttribute.create).not.toHaveBeenCalled();
    expect(tx.productAttribute.update).not.toHaveBeenCalled();
  });

  it('rejects duplicate codes before writing and facility attributes as specifications', async () => {
    const duplicate = variantFixture();
    const error = await duplicate.useCase
      .updateVariant('p-1', 'v-1', 't-1', { typeVariants: typeVariants([spec('bedroom', 1), spec('bedroom', 2)]) })
      .catch((caught: unknown) => caught);
    expect(mapHttpError(error).status).toBe(400);
    expect(duplicate.prisma.$transaction).not.toHaveBeenCalled();

    const facility = variantFixture('PROJECT');
    await expect(
      facility.useCase.updateVariant('p-1', 'v-1', 't-1', { typeVariants: typeVariants([spec('facility_pool', 1)]) })
    ).rejects.toThrow(/Invalid attribute source/);
  });

  it('does not touch specifications when only locations and units are saved', async () => {
    const tx = {
      product: { findFirst: fn(null), update: fn() },
      productCategory: { findMany: fn([{ id: 'root', parentId: null, code: 'PRJ' }]), findFirst: fn(null) },
      productVariant: {
        findMany: fn([{ id: 'v-1', typeVariants: [{ id: 'tv-1', name: 'Standard', code: null, basePrice: BigInt(1), currentPrice: BigInt(1), minPrice: null, stock: 1, isActive: true }] }]),
        update: fn({ id: 'v-1' }),
      },
      productTypeVariant: { update: fn({ id: 'tv-1' }) },
      productUnit: { findMany: fn([]) },
      productAttribute: { findMany: fn([]), create: fn(), update: fn(), deleteMany: fn() },
      productMedia: { findFirst: fn(null) },
    };
    const project = {
      id: 'p-1', categoryId: 'root', category: { id: 'root', type: 'PROJECT' }, media: [], attributes: [],
      variants: [{ id: 'v-1', name: 'Type 36', _count: { units: 0 }, typeVariants: [{ id: 'tv-1', name: 'Standard', code: null, basePrice: BigInt(1), currentPrice: BigInt(1), minPrice: null, stock: 1, isActive: true, _count: { units: 0 } }] }],
    };
    const prisma = {
      product: { findFirst: fn(project) },
      productUnit: { findMany: fn([]), groupBy: fn([]) },
      productCategory: { findMany: fn([{ id: 'root', parentId: null, name: 'X', code: 'PRJ', type: 'PROJECT' }]) },
      $transaction: jest.fn(async (cb: (client: unknown) => unknown) => cb(tx)),
    };
    await new ProductUseCase(prisma as never).update('p-1', 't-1', { locations: [], units: [] });
    expect(tx.productTypeVariant.update).toHaveBeenCalled();
    for (const write of [tx.productAttribute.create, tx.productAttribute.update, tx.productAttribute.deleteMany]) {
      expect(write).not.toHaveBeenCalled();
    }
  });

  it('cannot move a value to another variant and maps an existing value to 409', async () => {
    const prisma = {
      product: { findFirst: fn({ id: 'p-1', variants: [], media: [] }) },
      productTypeVariant: { findFirst: fn({ id: 'tv-1', productVariantId: 'v-1' }) },
      attribute: { findFirst: fn({ id: 'a-bed', source: 'UNIT_TYPE' }) },
      productAttribute: { findFirst: fn({ id: 'pa-1', typeVariantId: 'tv-1', value: 2 }), create: fn(), update: fn() },
    };
    const useCase = new ProductUseCase(prisma as never);
    await expect(useCase.updateAttribute('p-1', 'pa-1', 't-1', { typeVariantId: 'tv-2' })).rejects.toThrow(/Invalid typeVariantId/);
    const error = await useCase
      .addAttribute('p-1', 't-1', { typeVariantId: 'tv-1', attributeId: 'a-bed', value: 1 })
      .catch((caught: unknown) => caught);
    expect(mapHttpError(error).status).toBe(409);
    expect(prisma.productAttribute.create).not.toHaveBeenCalled();
  });

  it('reads the unit detail from the unit variant', async () => {
    const attribute = { code: 'bedroom', name: 'Kamar Tidur', unit: null };
    const unitFindMany = fn([{
      id: 'u-1', code: 'A-01', name: null, categoryId: 'c-1', status: 'AVAILABLE',
      variant: { id: 'v-1', name: 'Type 36' }, typeVariantId: 'tv-2',
      typeVariant: { id: 'tv-2', name: 'Premium', basePrice: BigInt(1), currentPrice: BigInt(1), attributes: [{ attribute, value: 3 }] },
      media: [], reservations: [],
    }]);
    const prisma = {
      product: {
        findUnique: fn({ id: 'p-1', code: 'PRJ', name: 'X', categoryId: 'root', variants: [{ typeVariants: [{ stock: 1 }] }], media: [] }),
        findFirst: fn(null),
      },
      productCategory: { findMany: fn([
        { id: 'root', code: 'ROOT', parentId: null, name: 'X', type: 'PROJECT' },
        { id: 'c-1', code: 'C1', parentId: 'root', name: 'C1', type: 'CLUSTER' },
      ]) },
      productUnit: { findMany: unitFindMany },
      reservation: { findMany: fn([]) },
      productMedia: { findMany: fn([]) },
    };
    const detail = await new AvailabilityUseCase(prisma as never).unit('t-1', 'PRJ', 'C1', 'A-01');
    expect(detail?.specifications).toEqual([{ key: 'bedroom', label: 'Kamar Tidur: 3' }]);
    const include = unitFindMany.mock.calls[0][0].include;
    expect(include.variant.select.attributes).toBeUndefined();
    expect(include.typeVariant.select.attributes.where).toEqual({ tenantId: 't-1', attribute: { tenantId: 't-1' } });
  });
});

describe('type variant specification validation', () => {
  const typeVariant = { name: 'Standard', basePrice: 1, stock: 1, attributes: [spec('bedroom', 2)] };

  it('accepts specifications on type variants only', () => {
    expect(validateVariant({ name: 'A', typeVariants: [typeVariant] }).typeVariants?.[0]?.attributes).toHaveLength(1);
    const wrongLevel = { name: 'P', code: 'P', variants: [{ name: 'A', typeVariants: [typeVariant], attributes: [] }] };
    expect(() => validateProduct(wrongLevel)).toThrow(/Unsupported field/);
    expect(() => validateAttribute({ variantId: 'v-1', attributeId: 'a-1' })).toThrow(/Unsupported field/);
  });

  it('rejects fractional values and stock above 1000', () => {
    const fractional = { ...typeVariant, attributes: [spec('bedroom', 1.5)] };
    expect(() => validateVariant({ name: 'A', typeVariants: [fractional] })).toThrow(/integer/);
    expect(() => validateVariant({ name: 'A', typeVariants: [{ ...typeVariant, stock: 1001 }] })).toThrow(/at most 1000/);
  });
});
