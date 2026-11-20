import type { ProductCategoryType } from '@prisma/client';

export type AvailabilityCategory = {
  id: string;
  code: string;
  parentId: string | null;
  name: string;
  type: ProductCategoryType;
};

export type AvailabilityIntegrity = {
  status: 'healthy' | 'degraded';
  ignoredUnitCount: number;
  skippedCycleEdges: number;
};

export type SafeAvailabilityHierarchy = {
  root: AvailabilityCategory;
  categories: Map<string, AvailabilityCategory>;
  skippedCycleEdges: number;
};

/**
 * Builds the project-scoped tree without trusting persisted parent links blindly.
 * The project category is always treated as the root, and a back-edge to any
 * category already reached from that root is skipped so consumers cannot loop.
 */
export function buildSafeAvailabilityHierarchy(
  rootId: string,
  categoryRows: readonly AvailabilityCategory[]
): SafeAvailabilityHierarchy | null {
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  const persistedRoot = categoryById.get(rootId);
  if (!persistedRoot) return null;

  const childIdsByParent = new Map<string, string[]>();
  for (const category of categoryRows) {
    if (!category.parentId) continue;
    childIdsByParent.set(category.parentId, [
      ...(childIdsByParent.get(category.parentId) ?? []),
      category.id,
    ]);
  }

  const root = { ...persistedRoot, parentId: null };
  const categories = new Map<string, AvailabilityCategory>([[root.id, root]]);
  const visited = new Set<string>([root.id]);
  const queue = [root.id];
  let skippedCycleEdges = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const parentId = queue[index] as string;
    for (const childId of childIdsByParent.get(parentId) ?? []) {
      if (visited.has(childId)) {
        skippedCycleEdges += 1;
        continue;
      }
      const child = categoryById.get(childId);
      if (!child) continue;
      visited.add(child.id);
      categories.set(child.id, { ...child, parentId });
      queue.push(child.id);
    }
  }

  return { root, categories, skippedCycleEdges };
}

export function availabilityIntegrity(
  ignoredUnitCount: number,
  skippedCycleEdges: number
): AvailabilityIntegrity {
  return {
    status: ignoredUnitCount > 0 || skippedCycleEdges > 0 ? 'degraded' : 'healthy',
    ignoredUnitCount,
    skippedCycleEdges,
  };
}
