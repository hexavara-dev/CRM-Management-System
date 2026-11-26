import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import type { CreateDealInput } from '../../../usecases/deal/CreateDealUseCase.js';
import { MAX_DEAL_DOCUMENTS, type DealDocumentInput } from '../../../usecases/deal/dealDocuments.js';

const rules: Record<string, FieldRule> = {
  leadId: { type: 'string', required: true, max: 36 },
  unitId: { type: 'string', required: true, max: 36 },
  // Batas kolom DECIMAL(14,2).
  amount: { type: 'number', required: true, integer: true, min: 1, max: 999_999_999_999 },
  paymentMethod: { type: 'string', required: true, values: ['CASH', 'KPR', 'KPR_SHARIA'] },
  financingBankId: { type: 'string', nullable: true, max: 36 },
  expectedClosingDate: { type: 'string', required: true, max: 10 },
  notes: { type: 'string', nullable: true, allowEmpty: true, max: 10000 },
  documents: { type: 'array' },
};

const documentRules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 150 },
  fileIndex: { type: 'number', required: true, integer: true, min: 0, max: MAX_DEAL_DOCUMENTS - 1 },
};

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Multipart mengirim data sebagai JSON di field `payload`; tanpa berkas boleh JSON biasa. */
export function parseCreateDeal(body: unknown): CreateDealInput {
  let source = (body ?? {}) as Record<string, unknown>;
  if (typeof source.payload === 'string') {
    try {
      source = JSON.parse(source.payload) as Record<string, unknown>;
    } catch {
      throw new Error('Invalid deal payload');
    }
  }
  const data = validateBody(source, rules) as Omit<CreateDealInput, 'documents'> & {
    documents?: unknown[];
  };
  if (!isDate(data.expectedClosingDate)) throw new Error('expectedClosingDate must be a valid date (YYYY-MM-DD)');
  const documents = data.documents ?? [];
  if (documents.length > MAX_DEAL_DOCUMENTS) throw new Error('Invalid deal documents');
  return { ...data, documents: documents.map((item) => validateBody(item, documentRules) as DealDocumentInput) };
}
