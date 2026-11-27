import { validateBody, type FieldRule } from '../../infrastructure/utils/RequestValidation.js';
import { MAX_DEAL_DOCUMENTS, type DealDocumentInput } from '../../usecases/deal/dealDocuments.js';

const rules: Record<string, FieldRule> = {
  targetStageId: { type: 'string', required: true, max: 36 },
  expectedSourceStageId: { type: 'string', required: true, max: 36 },
  documents: { type: 'array' },
};

const documentRules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 150 },
  fileIndex: { type: 'number', required: true, integer: true, min: 0, max: MAX_DEAL_DOCUMENTS - 1 },
};

export type DealStageTransitionInput = {
  targetStageId: string;
  expectedSourceStageId: string;
  documents: DealDocumentInput[];
};

/** Transisi memakai multipart agar metadata evidence dan seluruh file tiba dalam satu request. */
export function parseDealStageTransition(body: unknown): DealStageTransitionInput {
  let source = (body ?? {}) as Record<string, unknown>;
  if (typeof source.payload === 'string') {
    try {
      source = JSON.parse(source.payload) as Record<string, unknown>;
    } catch {
      throw new Error('Invalid Deal stage transition payload');
    }
  }
  const data = validateBody(source, rules) as Omit<DealStageTransitionInput, 'documents'> & {
    documents?: unknown[];
  };
  const documents = data.documents ?? [];
  if (documents.length > MAX_DEAL_DOCUMENTS) throw new Error('Invalid deal documents');
  return {
    ...data,
    documents: documents.map((item) => validateBody(item, documentRules) as DealDocumentInput),
  };
}
