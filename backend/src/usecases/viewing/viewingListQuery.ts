import type { Prisma } from '@prisma/client';

export type ViewingActor = { userId: string; role?: string };

export const VIEWING_SORT_FIELDS = [
  'scheduledAt',
  'customerName',
  'phone',
  'sales',
  'status',
] as const;
type ViewingSortField = (typeof VIEWING_SORT_FIELDS)[number];

const SORT_ORDERS = ['asc', 'desc'] as const;
type SortOrder = (typeof SORT_ORDERS)[number];

const DIRECT_FILTERS = ['statusId', 'customerId', 'sourceId', 'locationId', 'actorId'] as const;
const MAX_SEARCH_LENGTH = 100;

function readString(query: Record<string, unknown>, key: string): string | undefined {
  const value = query[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function readDate(query: Record<string, unknown>, key: string): Date | undefined {
  const raw = readString(query, key);
  if (raw === undefined) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error(`${key} must be a valid date`);
  return date;
}

function readOneOf<T extends string>(
  query: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const raw = readString(query, key);
  if (raw === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new Error(`${key} must be one of: ${allowed.join(', ')}`);
  }
  return raw as T;
}

function sortClause(
  field: ViewingSortField,
  order: SortOrder
): Prisma.ViewingOrderByWithRelationInput {
  switch (field) {
    case 'customerName':
      return { customer: { firstName: order } };
    case 'phone':
      return { customer: { phoneNumber: order } };
    case 'sales':
      return { actor: { name: order } };
    case 'status':
      return { status: { name: order } };
    default:
      return { scheduledAt: order };
  }
}

/**
 * Builds the Prisma filter and ordering for the viewing list from untrusted query parameters.
 * Only whitelisted parameters are read; the tenant always comes from the caller, never the query.
 */
export function buildViewingListQuery(
  tenantId: string,
  query: Record<string, unknown>,
  actor?: ViewingActor
): {
  where: Prisma.ViewingWhereInput;
  orderBy: Prisma.ViewingOrderByWithRelationInput[];
} {
  // Prisma drops an undefined filter value, so a missing tenant must never reach the query.
  if (!tenantId) throw new Error('Tenant context is required');

  const where: Prisma.ViewingWhereInput = { tenantId };
  const and: Prisma.ViewingWhereInput[] = [];

  for (const key of DIRECT_FILTERS) {
    const value = readString(query, key);
    if (value !== undefined) where[key] = value;
  }

  const projectId = readString(query, 'projectId');
  if (projectId !== undefined) and.push({ unit: { variant: { productId: projectId } } });

  const assignedUserId = readString(query, 'assignedUserId');
  if (assignedUserId !== undefined) and.push({ actorId: assignedUserId });

  const search = readString(query, 'search')?.trim();
  if (search) {
    if (search.length > MAX_SEARCH_LENGTH) {
      throw new Error(`search must be at most ${MAX_SEARCH_LENGTH} characters`);
    }
    const contains = { contains: search };
    and.push({
      OR: [
        { name: contains },
        { customer: { firstName: contains } },
        { customer: { lastName: contains } },
        { customer: { phoneNumber: contains } },
        { actor: { name: contains } },
        { unit: { variant: { product: { name: contains } } } },
      ],
    });
  }

  const startDate = readDate(query, 'startDate');
  const endDate = readDate(query, 'endDate');
  if (startDate && endDate && startDate > endDate) {
    throw new Error('startDate must be on or before endDate');
  }
  if (startDate || endDate) {
    where.scheduledAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    };
  }

  if (actor && actor.role !== 'owner') {
    // An empty id must never widen access: Prisma ignores an undefined filter value.
    and.push(actor.userId ? { actorId: actor.userId } : { id: { in: [] } });
  }

  if (and.length > 0) where.AND = and;

  const sortBy = readOneOf(query, 'sortBy', VIEWING_SORT_FIELDS) ?? 'scheduledAt';
  const sortOrder = readOneOf(query, 'sortOrder', SORT_ORDERS) ?? 'desc';

  return { where, orderBy: [sortClause(sortBy, sortOrder), { id: 'asc' }] };
}
