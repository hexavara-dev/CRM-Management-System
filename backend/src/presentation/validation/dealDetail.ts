import type { DealPaymentStatus, DealPaymentType } from '@prisma/client';
import { validateBody } from '../../infrastructure/utils/RequestValidation.js';
import type { FinancingBankInput } from '../../usecases/deal/FinancingBankUseCase.js';
import type { PaymentInput } from '../../usecases/deal/DealDetailUseCase.js';

const paymentRules = {
  type: { type: 'string' as const, values: ['ITJ', 'DP', 'SETTLEMENT'] },
  amount: { type: 'number' as const, integer: true, min: 1, max: Number.MAX_SAFE_INTEGER },
  status: { type: 'string' as const, values: ['PENDING', 'PAID', 'CANCELLED'] },
  dueDate: { type: 'date' as const, nullable: true },
  paidAt: { type: 'date' as const, nullable: true },
  notes: { type: 'string' as const, max: 10000, nullable: true, allowEmpty: true },
};

export function validatePayment(input: unknown, partial = false): PaymentInput | Partial<PaymentInput> {
  const result = validateBody(
    input,
    partial
      ? paymentRules
      : {
          ...paymentRules,
          type: { ...paymentRules.type, required: true },
          amount: { ...paymentRules.amount, required: true },
        },
    { partial }
  );
  return {
    ...(result.type !== undefined ? { type: result.type as DealPaymentType } : {}),
    ...(result.amount !== undefined ? { amount: result.amount as number } : {}),
    ...(result.status !== undefined ? { status: result.status as DealPaymentStatus } : {}),
    ...(result.dueDate !== undefined ? { dueDate: result.dueDate as Date | null } : {}),
    ...(result.paidAt !== undefined ? { paidAt: result.paidAt as Date | null } : {}),
    ...(result.notes !== undefined ? { notes: result.notes as string | null } : {}),
  };
}

export function validateLostRequest(input: unknown) {
  const result = validateBody(input, {
    reason: { type: 'string', required: true, min: 1, max: 500 },
    chronology: { type: 'string', required: true, min: 1, max: 10000 },
  });
  return { reason: result.reason as string, chronology: result.chronology as string };
}

export function validateLostReview(input: unknown) {
  const result = validateBody(input, {
    reviewNotes: { type: 'string', max: 10000, allowEmpty: true, nullable: true },
  });
  return { reviewNotes: result.reviewNotes as string | null | undefined };
}

const bankRules = {
  name: { type: 'string' as const, min: 1, max: 150 },
  logoUrl: { type: 'string' as const, max: 2000, nullable: true, allowEmpty: true },
  isActive: { type: 'boolean' as const },
};

export function validateBank(input: unknown, partial = false): FinancingBankInput | Partial<FinancingBankInput> {
  const result = validateBody(
    input,
    partial ? bankRules : { ...bankRules, name: { ...bankRules.name, required: true } },
    { partial }
  );
  return {
    ...(result.name !== undefined ? { name: result.name as string } : {}),
    ...(result.logoUrl !== undefined ? { logoUrl: result.logoUrl as string | null } : {}),
    ...(result.isActive !== undefined ? { isActive: result.isActive as boolean } : {}),
  };
}
