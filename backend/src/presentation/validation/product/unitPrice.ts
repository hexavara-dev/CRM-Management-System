import { parseUnitFilters } from './unit.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: unknown, field: string) {
  if (typeof value !== 'string' || !DAY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${field} must be a date in YYYY-MM-DD format`);
  }
  return value;
}

export function parseUnitPriceFilters(query: Record<string, unknown>) {
  const filters: ReturnType<typeof parseUnitFilters> & { date?: string } = parseUnitFilters(query);
  if (query.date !== undefined) filters.date = parseDay(query.date, 'date');
  return filters;
}
