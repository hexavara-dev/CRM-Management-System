import type { PriceAdjustmentStatus } from '@prisma/client';
import { validateBody } from '../../../infrastructure/utils/RequestValidation.js';
import type { AdjustmentInput } from '../../../usecases/pricing/UnitPriceUseCase.js';
import { PRICE_MAX } from './constants.js';
import { parseUnitFilters } from './unit.js';

export const ADJUSTMENT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: unknown, field: string) {
  if (typeof value !== 'string' || !DAY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${field} must be a date in YYYY-MM-DD format`);
  }
  return value;
}

export function validateAdjustment(body: unknown): AdjustmentInput {
  const data = validateBody(body, {
    amount: { type: 'number', required: true, integer: true, min: -PRICE_MAX, max: PRICE_MAX },
    reason: { type: 'string', required: true, min: 3, max: 500 },
    effectiveDate: { type: 'string', required: true, max: 10 },
  });
  return {
    amount: data.amount as number,
    reason: (data.reason as string).trim(),
    effectiveDate: parseDay(data.effectiveDate, 'effectiveDate'),
  };
}

export function validateReview(body: unknown, requireNote: boolean) {
  const data = validateBody(
    body ?? {},
    { note: { type: 'string', required: requireNote, allowEmpty: !requireNote, max: 500 } }
  );
  return (data.note as string | undefined)?.trim();
}

export function parseUnitPriceFilters(query: Record<string, unknown>) {
  const filters: ReturnType<typeof parseUnitFilters> & { date?: string } = parseUnitFilters(query);
  if (query.date !== undefined) filters.date = parseDay(query.date, 'date');
  return filters;
}

export function parseAdjustmentStatus(query: Record<string, unknown>) {
  if (query.status === undefined) return undefined;
  const status = typeof query.status === 'string' ? query.status.toUpperCase() : '';
  if (!(ADJUSTMENT_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`status must be one of: ${ADJUSTMENT_STATUSES.join(', ')}`);
  }
  return status as PriceAdjustmentStatus;
}
