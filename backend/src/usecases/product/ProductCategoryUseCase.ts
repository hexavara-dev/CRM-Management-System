import type { Prisma, PrismaClient, ProductCategoryType } from '@prisma/client';
import { MAX_CATEGORY_DEPTH, categoryWithDescendants, slugify } from './catalogRules.js';

export type CategoryInput = {
  parentId?: string | null;
  name?: string;
  code?: string;
  slug?: string;
  type?: ProductCategoryType;
  siteplanImg?: string | null;
  sortOrder?: number;
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
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { children: true, products: true, projects: true } } },
    });
    return { data };
  }

  async get(id: string, tenantId: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, tenantId },
      include: { parent: true, children: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!category) throw new Error('Category not found');
    return category;
  }

  /** Depth of a category counted from the root (root = 1). */
  private async depthOf(id: string, tenantId: string) {
    let depth = 0;
    let current: string | null = id;
    while (current) {
      depth += 1;
      if (depth > MAX_CATEGORY_DEPTH + 1) break;
      const row: { parentId: string | null } | null =
        await this.prisma.productCategory.findFirst({
          where: { id: current, tenantId },
          select: { parentId: true },
        });
      if (!row) throw new Error('Parent category not found');
      current = row.parentId;
    }
    return depth;
  }

  private async subtreeHeight(id: string, tenantId: string): Promise<number> {
    const children = await this.prisma.productCategory.findMany({
      where: { parentId: id, tenantId },
      select: { id: true },
    });
    if (children.length === 0) return 1;
    const heights = await Promise.all(children.map((c) => this.subtreeHeight(c.id, tenantId)));
    return 1 + Math.max(...heights);
  }

  private async assertParent(tenantId: string, parentId: string, selfId?: string) {
    if (selfId) {
      const subtree = await categoryWithDescendants(this.prisma, tenantId, selfId);
      if (subtree.includes(parentId)) {
        throw new Error('parentId must not be the category itself or one of its descendants');
      }
    }
    const parentDepth = await this.depthOf(parentId, tenantId);
    const ownHeight = selfId ? await this.subtreeHeight(selfId, tenantId) : 1;
    if (parentDepth + ownHeight > MAX_CATEGORY_DEPTH) {
      throw new Error(`Category hierarchy must be at most ${MAX_CATEGORY_DEPTH} levels deep`);
    }
  }

  async create(tenantId: string, input: CategoryInput) {
    if (!input.name || !input.code || !input.type) {
      throw new Error('name, code, and type are required');
    }
    if (input.parentId) await this.assertParent(tenantId, input.parentId);
    return this.prisma.productCategory.create({
      data: {
        tenantId,
        parentId: input.parentId ?? null,
        name: input.name,
        code: input.code,
        slug: input.slug || slugify(input.code),
        type: input.type,
        siteplanImg: input.siteplanImg ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });
  }

  async update(id: string, tenantId: string, input: CategoryInput) {
    await this.get(id, tenantId);
    if (input.parentId) await this.assertParent(tenantId, input.parentId, id);
    const data: Prisma.ProductCategoryUncheckedUpdateInput = {};
    if (input.parentId !== undefined) data.parentId = input.parentId;
    if (input.name !== undefined) data.name = input.name;
    if (input.code !== undefined) data.code = input.code;
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.type !== undefined) data.type = input.type;
    if (input.siteplanImg !== undefined) data.siteplanImg = input.siteplanImg;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return this.prisma.productCategory.update({ where: { id }, data });
  }

  async remove(id: string, tenantId: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { children: true, products: true, projects: true } } },
    });
    if (!category) throw new Error('Category not found');
    const { children, products, projects } = category._count;
    if (children + products + projects > 0) {
      throw new Error('Category is still in use (conflict). Deactivate it instead.');
    }
    await this.prisma.productCategory.delete({ where: { id } });
  }
}
