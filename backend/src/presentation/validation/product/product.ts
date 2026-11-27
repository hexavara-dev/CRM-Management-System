import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import type {
  ProductInput,
  TypeVariantInput,
  VariantInput,
} from '../../../usecases/product/ProductUseCase.js';
import { CATEGORY_TYPES, MAX_LOCATIONS, MAX_UNITS, MAX_VARIANTS, PRICE_MAX, STOCK_MAX } from './constants.js';
import { MAX_TYPE_IMAGES } from '../../../usecases/product/typeImages.js';
import { newAttributeRules } from './attribute.js';
import { unitRules } from './unit.js';

const variantRules: Record<string, FieldRule> = {
  id: { type: 'string', max: 36 },
  name: { type: 'string', required: true, max: 150 },
  basePrice: { type: 'number', integer: true, min: 0, max: PRICE_MAX },
  currentPrice: { type: 'number', integer: true, min: 0, max: PRICE_MAX },
  minPrice: { type: 'number', integer: true, min: 0, max: PRICE_MAX, nullable: true },
  stock: { type: 'number', integer: true, min: 0, max: STOCK_MAX },
  typeVariants: { type: 'array' },
  mediaOrder: { type: 'array' },
};

const typeVariantRules: Record<string, FieldRule> = {
  id: { type: 'string', max: 36 },
  name: { type: 'string', required: true, max: 150 },
  code: { type: 'string', nullable: true, allowEmpty: true, max: 100 },
  basePrice: { type: 'number', required: true, integer: true, min: 0, max: PRICE_MAX },
  currentPrice: { type: 'number', integer: true, min: 0, max: PRICE_MAX },
  minPrice: { type: 'number', integer: true, min: 0, max: PRICE_MAX, nullable: true },
  stock: { type: 'number', required: true, integer: true, min: 0, max: STOCK_MAX },
  isActive: { type: 'boolean' },
  attributes: { type: 'array' },
  mediaOrder: { type: 'array' },
};

function assertMediaOrder(value: unknown) {
  if (value === undefined) return;
  const order = value as unknown[];
  if (order.length > MAX_TYPE_IMAGES || order.some((key) => typeof key !== 'string' || !key || key.length > 36)) {
    throw new Error(`Invalid mediaOrder: at most ${MAX_TYPE_IMAGES} photos are allowed per type or variant`);
  }
}

/** Validates type variants together with their unit specifications. */
function typeVariantsOf(value: unknown): TypeVariantInput[] {
  return arrayOf(value, 100, 'typeVariants', (item) => {
    const typeVariant = validateBody(item, typeVariantRules) as TypeVariantInput;
    assertMediaOrder(typeVariant.mediaOrder);
    if (typeVariant.attributes !== undefined) {
      typeVariant.attributes = arrayOf(typeVariant.attributes, 50, 'attributes', (attribute) =>
        validateBody(attribute, newAttributeRules)
      ) as NonNullable<TypeVariantInput['attributes']>;
      // Hanya spesifikasi bersatuan (luas) yang boleh desimal; jumlah ruang selalu bulat.
      for (const { name, unit, value } of typeVariant.attributes) {
        if (!unit && value !== undefined && !Number.isInteger(value)) throw new Error(`${name} must be an integer`);
      }
    }
    return typeVariant;
  });
}

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
  mapsUrl: { type: 'string', nullable: true, allowEmpty: true, max: 4096 },
  isActive: { type: 'boolean' },
  variants: { type: 'array' },
  locations: { type: 'array' },
  units: { type: 'array' },
  facilityAttributeIds: { type: 'array' },
  removeMediaIds: { type: 'array' },
  primaryMediaId: { type: 'string', max: 36 },
};

const locationRules: Record<string, FieldRule> = {
  id: { type: 'string', max: 36 },
  key: { type: 'string', required: true, max: 64 },
  parentKey: { type: 'string', nullable: true, max: 64 },
  name: { type: 'string', required: true, max: 150 },
  code: { type: 'string', max: 100 },
  type: { type: 'string', required: true, values: CATEGORY_TYPES },
};

export function validateVariant(body: unknown, partial = false) {
  const variant = validateBody(body, variantRules, { partial }) as VariantInput;
  assertMediaOrder(variant.mediaOrder);
  if (variant.typeVariants !== undefined) {
    variant.typeVariants = typeVariantsOf(variant.typeVariants);
  }
  return variant;
}

function arrayOf<T>(value: unknown, max: number, field: string, validate: (item: unknown) => T) {
  const items = value as unknown[];
  if (items.length > max) throw new Error(`${field} must contain at most ${max} items`);
  return items.map(validate);
}

/** Host Google Maps yang boleh disimpan: google.com, google.co.id, google.de, maps.google.com, dll. */
const GOOGLE_MAPS_HOST = /^(?:www\.|maps\.)?google\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/;

/** mapsUrl dirender sebagai iframe di frontend, jadi hanya link https Google Maps yang diterima. */
export function assertGoogleMapsUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid mapsUrl: must be a Google Maps https link');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !GOOGLE_MAPS_HOST.test(url.hostname.toLowerCase()) || !url.pathname.startsWith('/maps')) {
    throw new Error('Invalid mapsUrl: must be a Google Maps https link');
  }
}

export function validateProduct(body: unknown, partial = false) {
  const result = validateBody(body, productRules, { partial }) as ProductInput;
  if (typeof result.mapsUrl === 'string' && result.mapsUrl.trim()) {
    assertGoogleMapsUrl(result.mapsUrl.trim());
  }
  if (result.facilityAttributeIds !== undefined) {
    const ids = result.facilityAttributeIds;
    if (ids.length > 100 || ids.some((id) => typeof id !== 'string' || !id || id.length > 36) || new Set(ids).size !== ids.length) {
      throw new Error('Invalid facility attribute IDs');
    }
  }
  if (result.removeMediaIds !== undefined) {
    const ids = result.removeMediaIds;
    if (ids.length > 10 || ids.some((id) => typeof id !== 'string' || !id || id.length > 36) || new Set(ids).size !== ids.length) {
      throw new Error('Invalid project media IDs');
    }
  }
  if (result.variants !== undefined) {
    result.variants = arrayOf(result.variants, MAX_VARIANTS, 'variants', (v) => {
      const variant = validateBody(v, variantRules) as VariantInput;
      assertMediaOrder(variant.mediaOrder);
      if (variant.typeVariants !== undefined) {
        variant.typeVariants = typeVariantsOf(variant.typeVariants);
        if (variant.typeVariants.length === 0) throw new Error('typeVariants must contain at least one item');
      } else if (variant.basePrice === undefined) {
        throw new Error('typeVariants must contain at least one item');
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
    for (const unit of result.units) unit.code = unit.code.trim();
    // Unit baru boleh langsung ditandai terjual (data awal project yang sudah berjalan); status lain
    // hanya lewat reservasi/deal. Unit tersimpan diperiksa use case terhadap status sekarang.
    const invalid = result.units.find(
      (unit) => (!partial || !unit.id) && unit.status && unit.status !== 'AVAILABLE' && unit.status !== 'SOLD'
    );
    if (invalid) {
      throw new Error(`Invalid unit status: new unit ${invalid.code} must be AVAILABLE or SOLD. Use a reservation to change it.`);
    }
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
