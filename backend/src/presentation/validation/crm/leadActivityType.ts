import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import { ACTIVITY_COLORS, type LeadActivityTypeInput } from '../../../usecases/crm/LeadActivityTypeUseCase.js';
import { LEAD_LABEL_ICONS } from '../../../usecases/crm/leadLabelIcons.js';

const rules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 100 },
  icon: { type: 'string', required: true, values: LEAD_LABEL_ICONS },
  color: { type: 'string', required: true, values: ACTIVITY_COLORS },
  description: { type: 'string', nullable: true, allowEmpty: true, max: 255 },
  isActive: { type: 'boolean' },
};

function validate(body: unknown, partial: boolean): LeadActivityTypeInput {
  const data = validateBody(body, rules, { partial }) as LeadActivityTypeInput;
  if (typeof data.name === 'string') data.name = data.name.trim();
  if (typeof data.description === 'string') data.description = data.description.trim() || null;
  return data;
}

export const validateLeadActivityTypeCreate = (body: unknown) => validate(body, false);
export const validateLeadActivityTypeUpdate = (body: unknown) => validate(body, true);

export function parseLeadActivityTypeFilters(query: Record<string, unknown>) {
  const filters: { search?: string; isActive?: boolean } = {};
  if (typeof query.search === 'string' && query.search.trim()) filters.search = query.search.trim().slice(0, 100);
  if (query.status !== undefined && query.status !== '') {
    if (query.status !== 'active' && query.status !== 'inactive') {
      throw new Error('status must be active or inactive');
    }
    filters.isActive = query.status === 'active';
  }
  return filters;
}
