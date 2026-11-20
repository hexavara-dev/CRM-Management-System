import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import type { LeadCampaignFilters, LeadCampaignInput } from '../../../usecases/crm/LeadCampaignUseCase.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const baseRules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 255 },
  description: { type: 'string', nullable: true, allowEmpty: true, max: 500 },
  startDate: { type: 'string', nullable: true, allowEmpty: true, max: 10 },
  endDate: { type: 'string', nullable: true, allowEmpty: true, max: 10 },
  isActive: { type: 'boolean' },
};

const createRules: Record<string, FieldRule> = {
  sourceId: { type: 'string', required: true, max: 36 },
  ...baseRules,
};

/** `YYYY-MM-DD` yang benar-benar ada di kalender; kosong menjadi null. */
function parseDate(value: string | null, field: string): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (!DATE.test(trimmed) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) {
    throw new Error(`${field} must be a valid date in YYYY-MM-DD format`);
  }
  return trimmed;
}

function finish(data: LeadCampaignInput): LeadCampaignInput {
  if (typeof data.name === 'string') data.name = data.name.trim();
  if (typeof data.description === 'string') data.description = data.description.trim() || null;
  if (data.startDate !== undefined) data.startDate = parseDate(data.startDate, 'startDate');
  if (data.endDate !== undefined) data.endDate = parseDate(data.endDate, 'endDate');
  return data;
}

export const validateLeadCampaignCreate = (body: unknown) =>
  finish(validateBody(body, createRules) as LeadCampaignInput);

/** Source campaign tidak dapat dipindah; buat campaign baru di source lain. */
export const validateLeadCampaignUpdate = (body: unknown) =>
  finish(validateBody(body, baseRules, { partial: true }) as LeadCampaignInput);

export function parseLeadCampaignFilters(query: Record<string, unknown>): LeadCampaignFilters {
  const filters: LeadCampaignFilters = {};
  if (query.sourceId !== undefined && query.sourceId !== '') {
    if (typeof query.sourceId !== 'string' || query.sourceId.length > 36) throw new Error('sourceId is invalid');
    filters.sourceId = query.sourceId;
  }
  if (typeof query.search === 'string' && query.search.trim()) filters.search = query.search.trim().slice(0, 255);
  if (query.status !== undefined && query.status !== '') {
    if (query.status !== 'active' && query.status !== 'inactive') {
      throw new Error('status must be active or inactive');
    }
    filters.isActive = query.status === 'active';
  }
  if (query.available !== undefined && query.available !== '') {
    if (query.available !== 'true' && query.available !== 'false') throw new Error('available must be true or false');
    filters.available = query.available === 'true';
  }
  return filters;
}
