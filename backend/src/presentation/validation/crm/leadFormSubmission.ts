import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import type { LeadFormSubmission } from '../../../usecases/crm/LeadFormSubmissionUseCase.js';

const MAX_VALUES = 60;

const rules: Record<string, FieldRule> = {
  templateVersionId: { type: 'string', required: true, max: 36 },
  values: { type: 'array' },
};

/**
 * Bentuk dasar isian form. Nilai per field divalidasi use case terhadap versi template,
 * karena aturan tiap field (tipe, wajib, pilihan) tersimpan di template.
 */
export function validateLeadFormSubmission(body: unknown): LeadFormSubmission {
  const { values, ...rest } = (body ?? {}) as Record<string, unknown>;
  const data = validateBody(rest, { templateVersionId: rules.templateVersionId as FieldRule }) as {
    templateVersionId: string;
  };
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error('values must be an object');
  }
  if (Object.keys(values).length > MAX_VALUES) throw new Error(`values must contain at most ${MAX_VALUES} fields`);
  return { templateVersionId: data.templateVersionId, values: values as Record<string, unknown> };
}
