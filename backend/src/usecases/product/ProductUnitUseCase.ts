import type { Prisma, PrismaClient, ProductUnitStatus } from '@prisma/client';
import { categoryWithDescendants } from './catalogRules.js';

export type UnitListFilters = {
  page: number;
  limit: number;
  search?: string | undefined;
  productId?: string;
  variantId?: string;
  /** Location node; units of its descendants are included. */
  categoryId?: string;
  status?: ProductUnitStatus;
};

export class ProductUnitUseCase {
  constructor(private prisma: PrismaClient) {}

  async list(tenantId: string, filters: UnitListFilters) {
    const where: Prisma.ProductUnitWhereInput = { tenantId };
    if (filters.search) {
      where.OR = [{ code: { contains: filters.search } }, { name: { contains: filters.search } }];
    }
    if (filters.productId) where.variant = { productId: filters.productId, tenantId };
    if (filters.variantId) where.variantId = filters.variantId;
    if (filters.categoryId) {
      where.categoryId = {
        in: await categoryWithDescendants(this.prisma, tenantId, filters.categoryId),
      };
    }
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.productUnit.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { code: 'asc' },
        include: {
          variant: { select: { id: true, name: true, currentPrice: true } },
          category: { select: { id: true, name: true, type: true } },
        },
      }),
      this.prisma.productUnit.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }
}
