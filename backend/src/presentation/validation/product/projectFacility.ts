import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import { FACILITY_ICONS } from '../../../usecases/product/projectFacilities.js';
import type { ProjectFacilityInput } from '../../../usecases/product/ProjectFacilityUseCase.js';

const rules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 150 },
  iconKey: { type: 'string', required: true, values: FACILITY_ICONS },
  description: { type: 'string', nullable: true, allowEmpty: true, max: 255 },
  isActive: { type: 'boolean' },
};

function validate(body: unknown, partial: boolean): ProjectFacilityInput {
  const data = validateBody(body, rules, { partial }) as ProjectFacilityInput;
  if (typeof data.name === 'string') data.name = data.name.trim();
  if (typeof data.description === 'string') data.description = data.description.trim() || null;
  return data;
}

export const validateProjectFacilityCreate = (body: unknown) => validate(body, false);
export const validateProjectFacilityUpdate = (body: unknown) => validate(body, true);

export function parseProjectFacilityFilters(query: Record<string, unknown>) {
  const filters: { search?: string; isActive?: boolean } = {};
  if (typeof query.search === 'string' && query.search.trim()) filters.search = query.search.trim().slice(0, 150);
  if (query.status !== undefined && query.status !== '') {
    if (query.status !== 'active' && query.status !== 'inactive') {
      throw new Error('status must be active or inactive');
    }
    filters.isActive = query.status === 'active';
  }
  return filters;
}
