import type { LeadLabelType } from '@prisma/client';
import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import { LEAD_LABEL_ICONS } from '../../../usecases/crm/leadLabelIcons.js';
import type { LeadLabelInput } from '../../../usecases/crm/LeadLabelUseCase.js';

export const LEAD_LABEL_TYPES = ['TEMPERATURE', 'TAG'] as const;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const baseRules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 100 },
  color: { type: 'string', required: true, max: 7 },
  icon: { type: 'string', required: true, values: LEAD_LABEL_ICONS },
  description: { type: 'string', nullable: true, allowEmpty: true, max: 500 },
  isRequired: { type: 'boolean' },
  isActive: { type: 'boolean' },
};

function finish(data: LeadLabelInput) {
  if (data.color !== undefined && !HEX_COLOR.test(data.color)) {
    throw new Error('color must be a hex color such as #EF4444');
  }
  if (typeof data.name === 'string') {
    data.name = data.name.trim();
    if (!data.name) throw new Error('name is required');
  }
  if (typeof data.description === 'string') data.description = data.description.trim() || null;
  return data;
}

export function validateLeadLabelCreate(body: unknown): LeadLabelInput {
  const rules = { ...baseRules, type: { type: 'string', required: true, values: LEAD_LABEL_TYPES } as FieldRule };
  return finish(validateBody(body, rules) as LeadLabelInput);
}

/** `type` tidak dapat diubah setelah label dibuat. */
export function validateLeadLabelUpdate(body: unknown): LeadLabelInput {
  return finish(validateBody(body, baseRules, { partial: true }) as LeadLabelInput);
}

export function parseLeadLabelType(query: Record<string, unknown>): LeadLabelType | undefined {
  if (query.type === undefined) return undefined;
  const type = typeof query.type === 'string' ? query.type.toUpperCase() : '';
  if (!(LEAD_LABEL_TYPES as readonly string[]).includes(type)) {
    throw new Error(`type must be one of: ${LEAD_LABEL_TYPES.join(', ')}`);
  }
  return type as LeadLabelType;
}
