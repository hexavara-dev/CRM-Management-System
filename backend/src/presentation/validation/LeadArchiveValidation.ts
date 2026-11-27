import { validateBody, type FieldRule } from '../../infrastructure/utils/RequestValidation.js';

export const ARCHIVE_CATEGORIES = ['NOT_RESPOND', 'INVALID', 'NOT_QUALIFIED', 'DEAL_LOST'] as const;
export type LeadArchiveCategoryInput = (typeof ARCHIVE_CATEGORIES)[number];

const categoryRule: FieldRule = { type: 'string', values: ['NOT_RESPOND', 'INVALID', 'NOT_QUALIFIED'] };
const idPattern = /^[0-9a-f-]{36}$/i;

export const validateArchiveLead = (body: unknown) =>
  validateBody(body, {
    category: { ...categoryRule, required: true },
    reason: { type: 'string', max: 500, allowEmpty: true, nullable: true },
  }) as { category: Exclude<LeadArchiveCategoryInput, 'DEAL_LOST'>; reason?: string | null };

export const validateArchiveCategoryChange = validateArchiveLead;

export const validateArchiveBulkIds = (body: unknown) => {
  const parsed = validateBody(body, { ids: { type: 'array', required: true } }) as { ids: unknown[] };
  if (parsed.ids.length < 1 || parsed.ids.length > 100) throw new Error('ids must contain between 1 and 100 Lead IDs');
  if (!parsed.ids.every((value) => typeof value === 'string' && idPattern.test(value))) throw new Error('ids must contain valid Lead IDs');
  if (new Set(parsed.ids).size !== parsed.ids.length) throw new Error('ids must not contain duplicates');
  return parsed as { ids: string[] };
};

export const validateArchiveBulkCategoryChange = (body: unknown) => {
  const parsed = validateBody(body, {
    ids: { type: 'array', required: true },
    category: { ...categoryRule, required: true },
    reason: { type: 'string', max: 500, allowEmpty: true, nullable: true },
  }) as { ids: unknown[]; category: Exclude<LeadArchiveCategoryInput, 'DEAL_LOST'>; reason?: string | null };
  const ids = validateArchiveBulkIds({ ids: parsed.ids }).ids;
  return { ...parsed, ids };
};

function parseId(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !idPattern.test(value)) throw new Error(`${field} must be a valid ID`);
  return value;
}

function parseDate(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) throw new Error(`${field} must be a valid date`);
  return new Date(value);
}

export function parseArchiveListQuery(query: Record<string, unknown>) {
  const allowed = new Set(['page', 'limit', 'search', 'category', 'projectId', 'sourceId', 'assignedUserId', 'from', 'to', 'sort', 'direction']);
  const unknown = Object.keys(query).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`Unsupported query parameter(s): ${unknown.join(', ')}`);
  const category = query.category;
  if (category !== undefined && (typeof category !== 'string' || !ARCHIVE_CATEGORIES.includes(category as LeadArchiveCategoryInput))) throw new Error('category must be a valid archive category');
  const sort = query.sort ?? 'archivedAt';
  const direction = query.direction ?? 'desc';
  if (sort !== 'archivedAt' || !['asc', 'desc'].includes(String(direction))) throw new Error('Unsupported archive sort');
  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(query.to))) to.setHours(23, 59, 59, 999);
  if (from && to && from > to) throw new Error('from must be before or equal to to');
  return { category: category as LeadArchiveCategoryInput | undefined, projectId: parseId(query.projectId, 'projectId'), sourceId: parseId(query.sourceId, 'sourceId'), assignedUserId: parseId(query.assignedUserId, 'assignedUserId'), from, to, direction: direction as 'asc' | 'desc' };
}
