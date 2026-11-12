import type { ProductCategoryType } from '@prisma/client';
import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import type { CategoryInput } from '../../../usecases/product/ProductCategoryUseCase.js';
import { CATEGORY_TYPES } from './constants.js';

const categoryRules: Record<string, FieldRule> = {
  parentId: { type: 'string', nullable: true, max: 36 },
  name: { type: 'string', required: true, max: 150 },
  code: { type: 'string', required: true, max: 100 },
  type: { type: 'string', required: true, values: CATEGORY_TYPES },
  siteplanImg: { type: 'string', nullable: true, max: 2000 },
  isActive: { type: 'boolean' },
};

export const validateCategory = (body: unknown, partial = false) =>
  validateBody(body, categoryRules, { partial }) as CategoryInput;

export function parseCategoryFilters(query: Record<string, unknown>) {
  const filters: { type?: ProductCategoryType; parentId?: string } = {};
  if (query.type !== undefined) {
    // Case-insensitive so `?type=project` and `?type=PROJECT` both work.
    const type = typeof query.type === 'string' ? query.type.toUpperCase() : '';
    if (!(CATEGORY_TYPES as readonly string[]).includes(type)) {
      throw new Error(`type must be one of: ${CATEGORY_TYPES.join(', ')}`);
    }
    filters.type = type as ProductCategoryType;
  }
  if (typeof query.parentId === 'string' && query.parentId) filters.parentId = query.parentId;
  return filters;
}
