import type { Prisma, PrismaClient, ProductCategoryType } from '@prisma/client';
import { categoryWithDescendants } from './catalogRules.js';
import { byLocationName } from './catalogStructure.js';
import { retryUniqueCode, uniqueCode } from './uniqueCode.js';

export type CategoryInput = {
  parentId?: string | null;
  name?: string;
  code?: string;
  type?: ProductCategoryType;
  siteplanImg?: string | null;
  isActive?: boolean;
};

export class ProductCategoryUseCase {
  constructor(private prisma: PrismaClient) {}

  async list(tenantId: string, filters: { type?: ProductCategoryType; parentId?: string }) {
    const where: Prisma.ProductCategoryWhereInput = { tenantId };
    if (filters.type) where.type = filters.type;
    if (filters.parentId) where.parentId = filters.parentId;
    const data = await this.prisma.productCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { children: true, products: true } } },
    });
    return { data: data.sort(byLocationName) };
  }

  async get(id: string, tenantId: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, tenantId },
      include: { parent: true, children: { orderBy: { name: 'asc' } } },
    });
    if (!category) throw new Error('Category not found');
    return category;
  }

  private async assertParent(tenantId: string, parentId: string, selfId?: string) {
    const parent = await this.prisma.productCategory.findFirst({
      where: { id: parentId, tenantId },
      select: { id: true },
    });
    if (!parent) throw new Error('Parent category not found');
    if (selfId) {
      const subtree = await categoryWithDescendants(this.prisma, tenantId, selfId);
      if (subtree.includes(parentId)) {
        throw new Error('parentId must not be the category itself or one of its descendants');
      }
    }
  }

  async create(tenantId: string, input: CategoryInput) {
    if (!input.name || !input.code || !input.type) {
      throw new Error('name, code, and type are required');
    }
    if (input.parentId) await this.assertParent(tenantId, input.parentId);
    return retryUniqueCode(async () => {
    const code = await uniqueCode(input.code as string, 100, async (candidate) =>
      Boolean(await this.prisma.productCategory.findFirst({
        where: { tenantId, code: candidate }, select: { id: true },
      }))
    );
    return this.prisma.productCategory.create({
      data: {
        tenantId,
        parentId: input.parentId ?? null,
        name: input.name as string,
        code,
        type: input.type as ProductCategoryType,
        siteplanImg: input.siteplanImg ?? null,
        isActive: input.isActive ?? true,
      },
    });
    });
  }

  async update(id: string, tenantId: string, input: CategoryInput) {
    await this.get(id, tenantId);
    const projectRoots =
      input.parentId !== undefined || input.type !== undefined
        ? new Set(
            (
              await this.prisma.product.findMany({
                where: { tenantId },
                select: { categoryId: true },
              })
            ).map((product) => product.categoryId)
          )
        : new Set<string>();
    if (projectRoots.has(id) && input.parentId) {
      throw new Error('Conflict: a project root category cannot be assigned a parent');
    }
    if (projectRoots.has(id) && input.type !== undefined && input.type !== 'PROJECT') {
      throw new Error('Conflict: a project root category must keep the PROJECT type');
    }
    if (input.parentId) await this.assertParent(tenantId, input.parentId, id);
    if (input.parentId !== undefined && !projectRoots.has(id)) {
      const categories = await this.prisma.productCategory.findMany({
        where: { tenantId },
        select: { id: true, parentId: true },
      });
      const byId = new Map(categories.map((category) => [category.id, category]));
      const owningRoot = (categoryId: string | null) => {
        const visited = new Set<string>();
        let currentId = categoryId;
        while (currentId && !visited.has(currentId)) {
          if (projectRoots.has(currentId)) return currentId;
          visited.add(currentId);
          currentId = byId.get(currentId)?.parentId ?? null;
        }
        return null;
      };
      const currentRoot = owningRoot(id);
      const nextRoot = owningRoot(input.parentId ?? null);
      if (currentRoot && currentRoot !== nextRoot) {
        throw new Error('Conflict: a category subtree cannot be moved into another project tree');
      }
    }
    const data: Prisma.ProductCategoryUncheckedUpdateInput = {};
    if (input.parentId !== undefined) data.parentId = input.parentId;
    if (input.name !== undefined) data.name = input.name;
    if (input.code !== undefined) data.code = input.code;
    if (input.type !== undefined) data.type = input.type;
    if (input.siteplanImg !== undefined) data.siteplanImg = input.siteplanImg;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return retryUniqueCode(async () => {
      if (input.code !== undefined) data.code = await uniqueCode(input.code as string, 100, async (candidate) =>
        Boolean(await this.prisma.productCategory.findFirst({
          where: { tenantId, code: candidate, id: { not: id } }, select: { id: true },
        }))
      );
      return this.prisma.productCategory.update({ where: { id }, data });
    });
  }

  async remove(id: string, tenantId: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { children: true, products: true } } },
    });
    if (!category) throw new Error('Category not found');
    const { children, products } = category._count;
    if (children + products > 0) {
      throw new Error('Category is still in use (conflict). Deactivate it instead.');
    }
    await this.prisma.productCategory.delete({ where: { id } });
  }
}
