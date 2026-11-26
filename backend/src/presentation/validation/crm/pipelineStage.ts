import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import {
  EVIDENCE_FILE_TYPES,
  EVIDENCE_PAYMENT_METHODS,
  PIPELINE_ENTITIES,
  type EvidenceInput,
  type EvidencePaymentMethod,
  type PipelineEntity,
  type PipelineStageInput,
} from '../../../usecases/crm/PipelineStageUseCase.js';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const MAX_EVIDENCES = 20;

const stageRules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 100 },
  description: { type: 'string', nullable: true, allowEmpty: true, max: 500 },
  probability: { type: 'number', required: true, integer: true, min: 0, max: 100 },
  color: { type: 'string', required: true, max: 7 },
  isActive: { type: 'boolean' },
  isDefaultStage: { type: 'boolean' },
  isTerminalStage: { type: 'boolean' },
  isWonStage: { type: 'boolean' },
  evidences: { type: 'array' },
};

const evidenceRules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 150 },
  fileTypes: { type: 'array', required: true },
  isRequired: { type: 'boolean' },
  description: { type: 'string', nullable: true, allowEmpty: true, max: 255 },
  paymentMethods: { type: 'array', nullable: true },
};

/** Kosong atau mencakup semua jenis pembayaran disimpan sebagai null. */
function evidencePayments(value: unknown[] | null | undefined): EvidencePaymentMethod[] | null {
  if (!value) return null;
  if (value.some((method) => !(EVIDENCE_PAYMENT_METHODS as readonly unknown[]).includes(method))) {
    throw new Error(`paymentMethods must be one of: ${EVIDENCE_PAYMENT_METHODS.join(', ')}`);
  }
  const methods = EVIDENCE_PAYMENT_METHODS.filter((method) => value.includes(method));
  return methods.length === 0 || methods.length === EVIDENCE_PAYMENT_METHODS.length ? null : methods;
}

export function parsePipelineEntity(value: unknown): PipelineEntity {
  if (typeof value !== 'string' || !(PIPELINE_ENTITIES as readonly string[]).includes(value)) {
    throw new Error(`entity must be one of: ${PIPELINE_ENTITIES.join(', ')}`);
  }
  return value as PipelineEntity;
}

function validateEvidences(value: unknown[]): EvidenceInput[] {
  if (value.length > MAX_EVIDENCES) throw new Error(`evidences must contain at most ${MAX_EVIDENCES} items`);
  const evidences = value.map((item) => {
    const data = validateBody(item, evidenceRules) as {
      name: string;
      fileTypes: unknown[];
      isRequired?: boolean;
      description?: string | null;
      paymentMethods?: unknown[] | null;
    };
    const types = [...new Set(data.fileTypes)];
    if (types.length === 0 || types.some((t) => !(EVIDENCE_FILE_TYPES as readonly unknown[]).includes(t))) {
      throw new Error(`fileTypes must contain at least one of: ${EVIDENCE_FILE_TYPES.join(', ')}`);
    }
    return {
      name: data.name.trim(),
      fileTypes: types as EvidenceInput['fileTypes'],
      isRequired: data.isRequired ?? true,
      description: data.description?.trim() || null,
      paymentMethods: evidencePayments(data.paymentMethods),
    };
  });
  const names = evidences.map((e) => e.name.toLowerCase());
  if (new Set(names).size !== names.length) throw new Error('evidence names must be unique within a stage');
  return evidences;
}

function finish(data: PipelineStageInput & { evidences?: unknown }): PipelineStageInput {
  if (data.color !== undefined && !HEX_COLOR.test(data.color)) {
    throw new Error('color must be a hex color such as #3B82F6');
  }
  if (typeof data.name === 'string') data.name = data.name.trim();
  if (typeof data.description === 'string') data.description = data.description.trim() || null;
  if (data.evidences !== undefined) data.evidences = validateEvidences(data.evidences as unknown[]);
  return data as PipelineStageInput;
}

export function validatePipelineStageCreate(body: unknown): PipelineStageInput & { entity: PipelineEntity } {
  const { entity, ...rest } = (body ?? {}) as Record<string, unknown>;
  return { entity: parsePipelineEntity(entity), ...finish(validateBody(rest, stageRules) as PipelineStageInput) };
}

export function validatePipelineStageUpdate(body: unknown): PipelineStageInput {
  return finish(validateBody(body, stageRules, { partial: true }) as PipelineStageInput);
}

export function validatePipelineReorder(body: unknown): { entity: PipelineEntity; ids: string[] } {
  const { entity, ids } = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string' || !id || id.length > 36)) {
    throw new Error('ids must be a non-empty array of stage ids');
  }
  if (new Set(ids).size !== ids.length) throw new Error('ids must not contain duplicates');
  return { entity: parsePipelineEntity(entity), ids: ids as string[] };
}
