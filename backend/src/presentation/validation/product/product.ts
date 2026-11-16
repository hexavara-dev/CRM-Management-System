import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import type {
  ProductInput,
  VariantInput,
} from '../../../usecases/product/ProductUseCase.js';
import { CATEGORY_TYPES, INT_MAX, MAX_LOCATIONS, MAX_UNITS, MAX_VARIANTS, PRICE_MAX } from './constants.js';
import { newAttributeRules } from './attribute.js';
import { unitRules } from './unit.js';

const variantRules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 150 },
  basePrice: { type: 'number', required: true, integer: true, min: 0, max: PRICE_MAX },
  currentPrice: { type: 'number', integer: true, min: 0, max: PRICE_MAX },
  minPrice: { type: 'number', integer: true, min: 0, max: PRICE_MAX, nullable: true },
  stock: { type: 'number', integer: true, min: 0, max: INT_MAX },
};

/** Variant sent together with a new product; may carry its attributes. */
const newVariantRules: Record<string, FieldRule> = {
  ...variantRules,
  attributes: { type: 'array' },
};

const productRules: Record<string, FieldRule> = {
  categoryId: { type: 'string', max: 36 },
  name: { type: 'string', required: true, max: 200 },
  code: { type: 'string', required: true, max: 100 },
  description: { type: 'string', nullable: true, allowEmpty: true, max: 5000 },
  province: { type: 'string', nullable: true, allowEmpty: true, max: 100 },
  city: { type: 'string', nullable: true, allowEmpty: true, max: 100 },
  subdistrict: { type: 'string', nullable: true, allowEmpty: true, max: 100 },
  village: { type: 'string', nullable: true, allowEmpty: true, max: 100 },
  address: { type: 'string', nullable: true, allowEmpty: true, max: 255 },
  postalCode: { type: 'string', nullable: true, allowEmpty: true, max: 10 },
  isActive: { type: 'boolean' },
  variants: { type: 'array' },
  locations: { type: 'array' },
  units: { type: 'array' },
};

const locationRules: Record<string, FieldRule> = {
  key: { type: 'string', required: true, max: 64 },
  parentKey: { type: 'string', nullable: true, max: 64 },
  name: { type: 'string', required: true, max: 150 },
  code: { type: 'string', max: 100 },
  type: { type: 'string', required: true, values: CATEGORY_TYPES },
};

export const validateVariant = (body: unknown, partial = false) =>
  validateBody(body, variantRules, { partial }) as VariantInput;

function arrayOf<T>(value: unknown, max: number, field: string, validate: (item: unknown) => T) {
  const items = value as unknown[];
  if (items.length > max) throw new Error(`${field} must contain at most ${max} items`);
  return items.map(validate);
}

export function validateProduct(body: unknown, partial = false) {
  const result = validateBody(body, productRules, { partial }) as ProductInput;
  if (partial) {
    for (const field of ['variants', 'locations', 'units'] as const) {
      if (result[field] !== undefined) {
        throw new Error(`${field} can only be sent when creating a product`);
      }
    }
    return result;
  }
  if (result.variants !== undefined) {
    result.variants = arrayOf(result.variants, MAX_VARIANTS, 'variants', (v) => {
      const variant = validateBody(v, newVariantRules) as VariantInput;
      if (variant.attributes !== undefined) {
        variant.attributes = arrayOf(variant.attributes, 50, 'attributes', (a) =>
          validateBody(a, newAttributeRules)
        ) as NonNullable<VariantInput['attributes']>;
      }
      return variant;
    });
  }
  if (result.locations !== undefined) {
    result.locations = arrayOf(result.locations, MAX_LOCATIONS, 'locations', (l) =>
      validateBody(l, locationRules)
    ) as NonNullable<ProductInput['locations']>;
  }
  if (result.units !== undefined) {
    result.units = arrayOf(result.units, MAX_UNITS, 'units', (u) =>
      validateBody(u, unitRules)
    ) as NonNullable<ProductInput['units']>;
  }
  return result;
}

export function parseProductFilters(query: Record<string, unknown>) {
  const filters: { categoryId?: string; isActive?: boolean } = {};
  if (typeof query.categoryId === 'string' && query.categoryId) filters.categoryId = query.categoryId;
  if (query.isActive !== undefined) {
    if (query.isActive !== 'true' && query.isActive !== 'false') {
      throw new Error('isActive must be true or false');
    }
    filters.isActive = query.isActive === 'true';
  }
  return filters;
}
