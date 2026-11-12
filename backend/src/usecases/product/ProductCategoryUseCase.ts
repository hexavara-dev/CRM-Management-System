import type { Prisma, PrismaClient, ProductCategoryType } from '@prisma/client';
import { categoryWithDescendants } from './catalogRules.js';

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
    return { data };
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
    return this.prisma.productCategory.create({
      data: {
        tenantId,
        parentId: input.parentId ?? null,
        name: input.name,
        code: input.code,
        type: input.type,
        siteplanImg: input.siteplanImg ?? null,
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
    if (input.type !== undefined) data.type = input.type;
    if (input.siteplanImg !== undefined) data.siteplanImg = input.siteplanImg;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return this.prisma.productCategory.update({ where: { id }, data });
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
