import type { AttributeDataType, ProductCategoryType, Prisma, PrismaClient } from '@prisma/client';

export type Db = PrismaClient | Prisma.TransactionClient;

export const MAX_CATEGORY_DEPTH = 5;

export const LOCATION_TYPES: ProductCategoryType[] = [
  'PROJECT',
  'CLUSTER',
  'BLOCK',
  'WAREHOUSE',
  'RACK',
  'BIN',
];

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 150);
}

/** Loads a category of the tenant and checks its type. */
export async function assertCategory(
  db: Db,
  tenantId: string,
  id: string,
  allowed: ProductCategoryType[],
  label = 'Category'
) {
  const category = await db.productCategory.findFirst({
    where: { id, tenantId },
    select: { id: true, type: true },
  });
  if (!category) throw new Error(`${label} not found`);
  if (!allowed.includes(category.type)) {
    throw new Error(`${label} must be of type ${allowed.join(' or ')}`);
  }
  return category;
}

/** Returns the id and every descendant id of a category. */
export async function categoryWithDescendants(db: Db, tenantId: string, rootId: string) {
  const rows = await db.productCategory.findMany({
    where: { tenantId },
    select: { id: true, parentId: true },
  });
  const childrenOf = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    childrenOf.set(row.parentId, [...(childrenOf.get(row.parentId) ?? []), row.id]);
  }
  const result: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (result.includes(id)) continue;
    result.push(id);
    queue.push(...(childrenOf.get(id) ?? []));
  }
  return result;
}

export function validateAttributeValue(dataType: AttributeDataType, value: string) {
  if (dataType === 'NUMBER' && (value.trim() === '' || !Number.isFinite(Number(value)))) {
    throw new Error('value must be a number for NUMBER attributes');
  }
  if (dataType === 'BOOLEAN' && value !== 'true' && value !== 'false') {
    throw new Error('value must be true or false for BOOLEAN attributes');
  }
}
