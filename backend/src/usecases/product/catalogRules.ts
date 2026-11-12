import type { ProductCategoryType, Prisma, PrismaClient } from '@prisma/client';

export type Db = PrismaClient | Prisma.TransactionClient;

/** Loads a category of the tenant and checks its type. */
export async function assertCategory(
  db: Db,
  tenantId: string,
  id: string,
  allowed?: ProductCategoryType[],
  label = 'Category'
) {
  const category = await db.productCategory.findFirst({
    where: { id, tenantId },
    select: { id: true, type: true },
  });
  if (!category) throw new Error(`${label} not found`);
  if (allowed && !allowed.includes(category.type)) {
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
