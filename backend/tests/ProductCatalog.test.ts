import { jest } from '@jest/globals';
import { ProductUseCase } from '../src/usecases/product/ProductUseCase.js';
import { ProductCategoryUseCase } from '../src/usecases/product/ProductCategoryUseCase.js';
import { ProductMediaUseCase } from '../src/usecases/product/ProductMediaUseCase.js';
import { parseCategoryFilters, validateAttribute, validateAttributeDefinition, validateCategory, validateProduct, validateUploadFields } from '../src/presentation/validation/ProductRequestValidation.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

const baseProduct = {
  categoryId: 'cat-1',
  name: 'Perumahan Green',
  code: 'GREEN',
  variants: [{ name: 'Type 36', basePrice: 350000000 }],
};

function productPrisma(overrides: Record<string, unknown> = {}) {
  return {
    productCategory: { findFirst: fn({ id: 'cat-1', type: 'BLOCK' }) },
    product: { findFirst: fn(null), create: fn({ id: 'p-1' }) },
    productVariant: { createMany: fn({ count: 1 }), findFirst: fn(null), count: fn(1) },
    productAttribute: { findFirst: fn(null), create: fn({}) },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(overrides.tx ?? {})),
    ...overrides,
  };
}

describe('ProductUseCase', () => {
  it('requires at least one variant', async () => {
    const useCase = new ProductUseCase(productPrisma() as never);
    await expect(useCase.create('t-1', { ...baseProduct, variants: [] })).rejects.toThrow(
      'variants must contain at least one variant'
    );
  });

  it('looks up the category inside the authenticated tenant only', async () => {
    const prisma = productPrisma({ productCategory: { findFirst: fn(null) } });
    const useCase = new ProductUseCase(prisma as never);
    await expect(useCase.create('t-1', baseProduct)).rejects.toThrow('Category not found');
    expect(prisma.productCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cat-1', tenantId: 't-1' } })
    );
  });

  it('creates the product and its variants in one transaction', async () => {
    const tx = { product: { create: fn({ id: 'p-1' }) }, productVariant: { create: fn({ id: 'v-1' }) } };
    const prisma = productPrisma({ tx, product: { findFirst: fn({ id: 'p-1', media: [] }) } });
    const useCase = new ProductUseCase(prisma as never);
    await useCase.create('t-1', baseProduct);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.productVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 't-1',
        productId: 'p-1',
        basePrice: 350000000,
        currentPrice: 350000000,
        stock: 0,
      }),
    });
  });

  it('keeps at least one variant', async () => {
    const prisma = productPrisma({ productVariant: { findFirst: fn({ id: 'v-1' }), count: fn(1) } });
    const useCase = new ProductUseCase(prisma as never);
    await expect(useCase.removeVariant('p-1', 'v-1', 't-1')).rejects.toThrow(/at least one variant/);
  });

  it('rejects an attribute for a variant of another product', async () => {
    const prisma = productPrisma({ product: { findFirst: fn({ id: 'p-1', media: [] }) } });
    const useCase = new ProductUseCase(prisma as never);
    await expect(
      useCase.addAttribute('p-1', 't-1', {
        variantId: 'v-other',
        attributeId: 'a-1',
        value: 72,
      })
    ).rejects.toThrow('Variant not found');
  });
});

describe('attribute request validation', () => {
  const attribute = { attributeId: 'a-1', value: 72 };

  it('accepts an integer value for a master attribute', () => {
    expect(validateAttribute(attribute)).toEqual(attribute);
  });

  it('rejects a non-integer value and definition fields on the pivot', () => {
    expect(() => validateAttribute({ ...attribute, value: 'abc' })).toThrow(/value must be a finite number/);
    expect(() => validateAttribute({ ...attribute, value: 1.5 })).toThrow(/integer/);
    expect(() => validateAttribute({ ...attribute, code: 'LT' })).toThrow(/Unsupported field/);
  });

  it('validates the master definition and rejects the removed BOOLEAN type', () => {
    const definition = { name: 'Luas Tanah', code: 'LT', dataType: 'NUMBER', unit: 'm2' };
    expect(validateAttributeDefinition(definition)).toEqual(definition);
    expect(() => validateAttributeDefinition({ ...definition, dataType: 'BOOLEAN' })).toThrow(
      /dataType must be one of/
    );
  });
});

describe('ProductCategoryUseCase', () => {
  it('rejects moving a category under its own descendant', async () => {
    const rows = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
    ];
    const prisma = {
      productCategory: {
        findFirst: fn({ id: 'a', parentId: null }),
        findMany: fn(rows),
      },
    };
    const useCase = new ProductCategoryUseCase(prisma as never);
    await expect(useCase.update('a', 't-1', { parentId: 'b' })).rejects.toThrow(/descendants/);
  });

  it('refuses to delete a category that is still in use', async () => {
    const prisma = {
      productCategory: {
        findFirst: fn({ id: 'a', _count: { children: 0, products: 2 } }),
        delete: fn(),
      },
    };
    const useCase = new ProductCategoryUseCase(prisma as never);
    await expect(useCase.remove('a', 't-1')).rejects.toThrow(/in use/);
    expect(prisma.productCategory.delete).not.toHaveBeenCalled();
  });
});

describe('ProductMediaUseCase', () => {
  const prisma = {
    product: { findFirst: fn({ id: 'p-1' }) },
    productVariant: { findFirst: fn({ id: 'v-1' }) },
    $transaction: fn(),
  };

  it('accepts only https video links', async () => {
    const useCase = new ProductMediaUseCase(prisma as never);
    await expect(
      useCase.addLink('p-1', 't-1', { fileUrl: 'http://example.com/video' })
    ).rejects.toThrow(/https/);
  });

  it('rejects unsupported file types before storing anything', async () => {
    const storage = { upload: fn(), getPublicUrl: jest.fn(), remove: fn() };
    const useCase = new ProductMediaUseCase(prisma as never, storage as never);
    const file = { mimetype: 'text/plain', originalname: 'a.txt', buffer: Buffer.from(''), size: 1 };
    await expect(useCase.upload('p-1', 't-1', file as never, {})).rejects.toThrow('Unsupported file type');
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe('category request validation', () => {
  it('reads the type filter case-insensitively', () => {
    expect(parseCategoryFilters({ type: 'project' })).toEqual({ type: 'PROJECT' });
    expect(() => parseCategoryFilters({ type: 'room' })).toThrow(/type must be one of/);
  });

  it('accepts the hierarchy levels and rejects unknown types', () => {
    for (const type of ['PROJECT', 'CLUSTER', 'ZONE', 'BLOCK', 'TOWER', 'FLOOR']) {
      expect(() => validateCategory({ name: 'A', code: 'A', type })).not.toThrow();
    }
    expect(() => validateCategory({ name: 'A', code: 'A', type: 'ROOM' })).toThrow(/type must be one of/);
  });
});

describe('product request validation', () => {
  it('rejects variants on a partial update', () => {
    expect(() => validateProduct({ variants: [] }, true)).toThrow(/only be sent when creating/);
  });

  it('rejects a negative base price', () => {
    expect(() =>
      validateProduct({ ...baseProduct, variants: [{ name: 'A', basePrice: -1 }] })
    ).toThrow(/basePrice must be at least 0/);
  });

  it('accepts a price above 2.1 billion but rejects one above the JSON-safe range', () => {
    expect(() =>
      validateProduct({ ...baseProduct, variants: [{ name: 'A', basePrice: 3500000000 }] })
    ).not.toThrow();
    expect(() =>
      validateProduct({ ...baseProduct, variants: [{ name: 'A', basePrice: Number.MAX_SAFE_INTEGER + 2 }] })
    ).toThrow(/basePrice must be at most/);
  });

  it('no longer accepts the removed tracking, project, slug and variant code fields', () => {
    expect(() => validateProduct({ ...baseProduct, trackingType: 'UNIT' })).toThrow(/Unsupported field/);
    expect(() => validateProduct({ ...baseProduct, projectCategoryId: 'p' })).toThrow(/Unsupported field/);
    expect(() =>
      validateProduct({ ...baseProduct, variants: [{ name: 'A', code: 'A', basePrice: 1 }] })
    ).toThrow(/Unsupported field/);
  });

  it('converts multipart upload fields', () => {
    expect(validateUploadFields({ title: 'Denah', isPrimary: 'true', sortOrder: '2' })).toEqual({
      title: 'Denah',
      isPrimary: true,
      sortOrder: 2,
    });
  });
});
