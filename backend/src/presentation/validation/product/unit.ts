import type { ProductUnitStatus } from '@prisma/client';
import type { FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import { UNIT_STATUSES } from './constants.js';

export const unitRules: Record<string, FieldRule> = {
  code: { type: 'string', required: true, max: 100 },
  name: { type: 'string', nullable: true, allowEmpty: true, max: 150 },
  variantIndex: { type: 'number', required: true, integer: true, min: 0 },
  locationKey: { type: 'string', max: 64 },
  status: { type: 'string', values: UNIT_STATUSES },
};

export function parseUnitFilters(query: Record<string, unknown>) {
  const filters: {
    productId?: string;
    variantId?: string;
    categoryId?: string;
    status?: ProductUnitStatus;
  } = {};
  for (const key of ['productId', 'variantId', 'categoryId'] as const) {
    if (typeof query[key] === 'string' && query[key]) filters[key] = query[key] as string;
  }
  if (query.status !== undefined) {
    const status = typeof query.status === 'string' ? query.status.toUpperCase() : '';
    if (!(UNIT_STATUSES as readonly string[]).includes(status)) {
      throw new Error(`status must be one of: ${UNIT_STATUSES.join(', ')}`);
    }
    filters.status = status as ProductUnitStatus;
  }
  return filters;
}
