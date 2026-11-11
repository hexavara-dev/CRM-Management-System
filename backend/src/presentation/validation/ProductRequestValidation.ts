import type { AttributeDataType, ProductCategoryType, TrackingType } from '@prisma/client';
import { validateBody, type FieldRule } from '../../infrastructure/utils/RequestValidation.js';
import type { CategoryInput } from '../../usecases/product/ProductCategoryUseCase.js';
import type {
  AttributeInput,
  ProductInput,
  VariantInput,
} from '../../usecases/product/ProductUseCase.js';
import type { CharacteristicInput } from '../../usecases/product/CharacteristicUseCase.js';
import type { MediaLinkInput, MediaMetaInput } from '../../usecases/product/ProductMediaUseCase.js';

export const CATEGORY_TYPES = [
  'CATEGORY',
  'PROJECT',
  'CLUSTER',
  'BLOCK',
  'WAREHOUSE',
  'RACK',
  'BIN',
] as const;
export const TRACKING_TYPES = ['QUANTITY', 'UNIT'] as const;
const DATA_TYPES = ['NUMBER', 'STRING', 'BOOLEAN'] as const;

const categoryRules: Record<string, FieldRule> = {
  parentId: { type: 'string', nullable: true, max: 36 },
  name: { type: 'string', required: true, max: 150 },
  code: { type: 'string', required: true, max: 100 },
  slug: { type: 'string', max: 150 },
  type: { type: 'string', required: true, values: CATEGORY_TYPES },
  siteplanImg: { type: 'string', nullable: true, max: 2000 },
  sortOrder: { type: 'number', integer: true, min: 0 },
  isActive: { type: 'boolean' },
};

const variantRules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 150 },
  code: { type: 'string', required: true, max: 100 },
  basePrice: { type: 'number', required: true, min: 0, max: 999999999999999 },
};

const productRules: Record<string, FieldRule> = {
  categoryId: { type: 'string', required: true, max: 36 },
  projectCategoryId: { type: 'string', nullable: true, max: 36 },
  name: { type: 'string', required: true, max: 200 },
  code: { type: 'string', required: true, max: 100 },
  description: { type: 'string', nullable: true, allowEmpty: true, max: 5000 },
  trackingType: { type: 'string', required: true, values: TRACKING_TYPES },
  isActive: { type: 'boolean' },
  variants: { type: 'array' },
};

const attributeRules: Record<string, FieldRule> = {
  variantId: { type: 'string', nullable: true, max: 36 },
  name: { type: 'string', required: true, max: 150 },
  code: { type: 'string', required: true, max: 100 },
  dataType: { type: 'string', required: true, values: DATA_TYPES },
  value: { type: 'string', required: true, max: 255 },
  unit: { type: 'string', nullable: true, allowEmpty: true, max: 30 },
};

const characteristicRules: Record<string, FieldRule> = {
  group: { type: 'string', required: true, max: 100 },
  code: { type: 'string', required: true, max: 100 },
  name: { type: 'string', required: true, max: 150 },
};

const mediaMetaRules: Record<string, FieldRule> = {
  title: { type: 'string', nullable: true, allowEmpty: true, max: 150 },
  variantId: { type: 'string', nullable: true, max: 36 },
  sortOrder: { type: 'number', integer: true, min: 0 },
  isPrimary: { type: 'boolean' },
};

export const validateCategory = (body: unknown, partial = false) =>
  validateBody(body, categoryRules, { partial }) as CategoryInput;

export const validateVariant = (body: unknown, partial = false) =>
  validateBody(body, variantRules, { partial }) as VariantInput;

export function validateProduct(body: unknown, partial = false) {
  const result = validateBody(body, productRules, { partial }) as ProductInput;
  if (partial && result.variants !== undefined) {
    throw new Error('variants must be managed through the variant endpoints');
  }
  if (result.variants !== undefined) {
    result.variants = (result.variants as unknown[]).map((v) => validateVariant(v));
  }
  return result;
}

export const validateAttribute = (body: unknown, partial = false) =>
  validateBody(body, attributeRules, { partial }) as AttributeInput;

export const validateCharacteristic = (body: unknown, partial = false) =>
  validateBody(body, characteristicRules, { partial }) as CharacteristicInput;

export const validateMediaMeta = (body: unknown) =>
  validateBody(body, mediaMetaRules, { partial: true }) as MediaMetaInput;

export const validateMediaLink = (body: unknown) =>
  validateBody(
    body,
    { ...mediaMetaRules, fileUrl: { type: 'string', required: true, max: 2000 } },
  ) as MediaLinkInput;

/** Multipart fields arrive as strings; convert them before validation. */
export function validateUploadFields(body: Record<string, unknown> | undefined) {
  const source = body ?? {};
  const converted: Record<string, unknown> = {};
  if (typeof source.title === 'string' && source.title !== '') converted.title = source.title;
  if (typeof source.variantId === 'string' && source.variantId !== '') {
    converted.variantId = source.variantId;
  }
  if (source.isPrimary !== undefined) converted.isPrimary = source.isPrimary === 'true';
  if (source.sortOrder !== undefined && source.sortOrder !== '') {
    converted.sortOrder = Number(source.sortOrder);
  }
  return Object.keys(converted).length ? validateMediaMeta(converted) : {};
}

export function parseCategoryFilters(query: Record<string, unknown>) {
  const filters: { type?: ProductCategoryType; parentId?: string } = {};
  if (query.type !== undefined) {
    if (typeof query.type !== 'string' || !(CATEGORY_TYPES as readonly string[]).includes(query.type)) {
      throw new Error(`type must be one of: ${CATEGORY_TYPES.join(', ')}`);
    }
    filters.type = query.type as ProductCategoryType;
  }
  if (typeof query.parentId === 'string' && query.parentId) filters.parentId = query.parentId;
  return filters;
}

export function parseProductFilters(query: Record<string, unknown>) {
  const filters: {
    categoryId?: string;
    projectCategoryId?: string;
    trackingType?: TrackingType;
    isActive?: boolean;
  } = {};
  if (typeof query.categoryId === 'string' && query.categoryId) filters.categoryId = query.categoryId;
  if (typeof query.projectCategoryId === 'string' && query.projectCategoryId) {
    filters.projectCategoryId = query.projectCategoryId;
  }
  if (query.trackingType !== undefined) {
    if (
      typeof query.trackingType !== 'string' ||
      !(TRACKING_TYPES as readonly string[]).includes(query.trackingType)
    ) {
      throw new Error(`trackingType must be one of: ${TRACKING_TYPES.join(', ')}`);
    }
    filters.trackingType = query.trackingType as TrackingType;
  }
  if (query.isActive !== undefined) {
    if (query.isActive !== 'true' && query.isActive !== 'false') {
      throw new Error('isActive must be true or false');
    }
    filters.isActive = query.isActive === 'true';
  }
  return filters;
}

export type { AttributeDataType };
