import { prisma } from '../infrastructure/database/prisma.js';

const categories = await prisma.productCategory.findMany({
  select: { id: true, tenantId: true, parentId: true, type: true },
});
const projects = await prisma.product.findMany({
  select: { id: true, tenantId: true, categoryId: true },
});
const units = await prisma.productUnit.findMany({
  select: {
    id: true,
    tenantId: true,
    variantId: true,
    categoryId: true,
    variant: { select: { productId: true, tenantId: true } },
    typeVariant: { select: { productVariantId: true, tenantId: true } },
    category: { select: { tenantId: true } },
  },
});

const categoryById = new Map(categories.map((category) => [category.id, category]));
const projectById = new Map(projects.map((project) => [project.id, project]));
const childrenByParent = new Map<string, string[]>();
for (const category of categories) {
  if (!category.parentId) continue;
  const children = childrenByParent.get(category.parentId) ?? [];
  children.push(category.id);
  childrenByParent.set(category.parentId, children);
}

function descendants(rootId: string) {
  const result = new Set<string>();
  const queue = [rootId];
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    if (!id || result.has(id)) continue;
    result.add(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

const cycleKeys = new Set<string>();
const completelyChecked = new Set<string>();
for (const category of categories) {
  if (completelyChecked.has(category.id)) continue;
  const path: string[] = [];
  const position = new Map<string, number>();
  let current = categoryById.get(category.id);
  while (current && !completelyChecked.has(current.id)) {
    const repeatedAt = position.get(current.id);
    if (repeatedAt !== undefined) {
      cycleKeys.add(path.slice(repeatedAt).sort().join('|'));
      break;
    }
    position.set(current.id, path.length);
    path.push(current.id);
    current = current.parentId ? categoryById.get(current.parentId) : undefined;
  }
  path.forEach((id) => completelyChecked.add(id));
}

let missingParent = 0;
let crossTenantParent = 0;
for (const category of categories) {
  if (!category.parentId) continue;
  const parent = categoryById.get(category.parentId);
  if (!parent) missingParent += 1;
  else if (parent.tenantId !== category.tenantId) crossTenantParent += 1;
}

let missingProjectRoot = 0;
let crossTenantProjectRoot = 0;
let projectRootHasParent = 0;
let projectRootWrongType = 0;
let sharedTreeCategories = 0;
const treeByProject = new Map<string, Set<string>>();
const firstProjectByCategory = new Map<string, string>();
for (const project of projects) {
  const root = categoryById.get(project.categoryId);
  if (!root) {
    missingProjectRoot += 1;
    continue;
  }
  if (root.tenantId !== project.tenantId) crossTenantProjectRoot += 1;
  if (root.parentId) projectRootHasParent += 1;
  if (root.type !== 'PROJECT') projectRootWrongType += 1;
  const tree = descendants(root.id);
  treeByProject.set(project.id, tree);
  for (const categoryId of tree) {
    const previousProject = firstProjectByCategory.get(categoryId);
    if (previousProject && previousProject !== project.id) sharedTreeCategories += 1;
    else firstProjectByCategory.set(categoryId, project.id);
  }
}

let unitOutsideProjectTree = 0;
let unitCategoryTenantMismatch = 0;
let unitVariantTenantMismatch = 0;
let unitTypeVariantTenantMismatch = 0;
let unitTypeVariantMismatch = 0;
let unitWithoutProject = 0;
for (const unit of units) {
  const project = projectById.get(unit.variant.productId);
  if (!project) {
    unitWithoutProject += 1;
    continue;
  }
  if (unit.category.tenantId !== unit.tenantId) unitCategoryTenantMismatch += 1;
  if (unit.variant.tenantId !== unit.tenantId) unitVariantTenantMismatch += 1;
  if (unit.typeVariant.tenantId !== unit.tenantId) unitTypeVariantTenantMismatch += 1;
  if (unit.typeVariant.productVariantId !== unit.variantId) unitTypeVariantMismatch += 1;
  if (!treeByProject.get(project.id)?.has(unit.categoryId)) unitOutsideProjectTree += 1;
}

const issueCounts = {
  missingParent,
  crossTenantParent,
  parentCycles: cycleKeys.size,
  missingProjectRoot,
  crossTenantProjectRoot,
  projectRootHasParent,
  projectRootWrongType,
  sharedTreeCategories,
  unitWithoutProject,
  unitOutsideProjectTree,
  unitCategoryTenantMismatch,
  unitVariantTenantMismatch,
  unitTypeVariantTenantMismatch,
  unitTypeVariantMismatch,
};

console.log(
  JSON.stringify(
    {
      scanned: {
        projects: projects.length,
        categories: categories.length,
        units: units.length,
      },
      issueCounts,
      healthy: Object.values(issueCounts).every((count) => count === 0),
    },
    null,
    2
  )
);

await prisma.$disconnect();
