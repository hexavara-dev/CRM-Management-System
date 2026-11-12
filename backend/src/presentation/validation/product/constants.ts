export const CATEGORY_TYPES = [
  'CATEGORY',
  'PROJECT',
  'CLUSTER',
  'BLOCK',
  'WAREHOUSE',
  'RACK',
  'BIN',
  'ZONE',
  'TOWER',
  'FLOOR',
] as const;
export const DATA_TYPES = ['NUMBER', 'STRING'] as const;
export const UNIT_STATUSES = ['AVAILABLE', 'RESERVED', 'BOOKED', 'SOLD', 'BLOCKED'] as const;
export const INT_MAX = 2147483647; // MySQL INT (stock, attribute value)
export const PRICE_MAX = Number.MAX_SAFE_INTEGER; // BIGINT columns, kept JSON-safe
export const MAX_VARIANTS = 100;
export const MAX_LOCATIONS = 1000;
export const MAX_UNITS = 5000;
