import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import type { LeadSourceInput } from '../../../usecases/crm/LeadSourceUseCase.js';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const rules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 255 },
  description: { type: 'string', nullable: true, allowEmpty: true, max: 500 },
  color: { type: 'string', required: true, max: 7 },
  isActive: { type: 'boolean' },
};

function validate(body: unknown, partial: boolean): LeadSourceInput {
  const data = validateBody(body, rules, { partial }) as LeadSourceInput;
  if (data.color !== undefined && !HEX_COLOR.test(data.color)) {
    throw new Error('color must be a hex color such as #3B82F6');
  }
  if (typeof data.name === 'string') data.name = data.name.trim();
  if (typeof data.description === 'string') data.description = data.description.trim() || null;
  return data;
}

export const validateLeadSourceCreate = (body: unknown) => validate(body, false);
export const validateLeadSourceUpdate = (body: unknown) => validate(body, true);

export function parseLeadSourceFilters(query: Record<string, unknown>) {
  const filters: { search?: string; isActive?: boolean } = {};
  if (typeof query.search === 'string' && query.search.trim()) filters.search = query.search.trim().slice(0, 255);
  if (query.status !== undefined && query.status !== '') {
    if (query.status !== 'active' && query.status !== 'inactive') {
      throw new Error('status must be active or inactive');
    }
    filters.isActive = query.status === 'active';
  }
  return filters;
}
