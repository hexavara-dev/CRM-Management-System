import type { ReservationStatus } from '@prisma/client';
import { validateBody, type FieldRule } from '../../infrastructure/utils/RequestValidation.js';

const reservationStatuses = [
  'ACTIVE',
  'PAYMENT_PENDING',
] as const satisfies readonly ReservationStatus[];

const reservationRules: Record<string, FieldRule> = {
  unitId: { type: 'string', required: true, max: 36 },
  salesId: { type: 'string', max: 36 },
  refCode: { type: 'string', max: 80 },
  customerName: { type: 'string', required: true, max: 150 },
  customerEmail: { type: 'string', nullable: true, allowEmpty: true, max: 255 },
  customerPhone: { type: 'string', nullable: true, allowEmpty: true, max: 30 },
  reservedAt: { type: 'date' },
  expiresAt: { type: 'date', nullable: true },
  price: { type: 'number', required: true, integer: true, min: 0, max: Number.MAX_SAFE_INTEGER },
  status: { type: 'string', values: reservationStatuses },
  notes: { type: 'string', nullable: true, allowEmpty: true, max: 10000 },
};

export const validateReservationCreate = (body: unknown) => validateBody(body, reservationRules);

export const validateReservationStatus = (body: unknown) =>
  validateBody(body, {
    status: {
      type: 'string',
      required: true,
      values: ['ACTIVE', 'PAYMENT_PENDING', 'EXPIRED', 'CANCELLED', 'COMPLETED'],
    },
  });

export function parseReservationStatus(value: unknown): ReservationStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('status must be a string');
  const status = value.toUpperCase();
  const allowed: readonly ReservationStatus[] = [
    'ACTIVE',
    'PAYMENT_PENDING',
    'EXPIRED',
    'CANCELLED',
    'COMPLETED',
  ];
  if (!allowed.includes(status as ReservationStatus)) {
    throw new Error(`status must be one of: ${allowed.join(', ')}`);
  }
  return status as ReservationStatus;
}

export function parseReservationTextFilter(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (normalized.length > 150) throw new Error(`${field} must contain at most 150 characters`);
  return normalized || undefined;
}

export function parseReservationPeriod(value: unknown) {
  if (value === undefined) return undefined;
  if (value !== 'today' && value !== 'week' && value !== 'month') {
    throw new Error('period must be one of: today, week, month');
  }
  return value;
}
