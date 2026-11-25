import type { Prisma, PrismaClient, ProductUnitStatus } from '@prisma/client';
import { categoryWithDescendants } from './catalogRules.js';
import { expireOverdueReservations } from '../reservation/reservationStatus.js';

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

export type UnitPhotoFilters = Pick<UnitListFilters, 'page' | 'limit' | 'search' | 'variantId'> & { typeVariantId?: string };

export class ProductUnitUseCase {
  constructor(private prisma: PrismaClient) {}

  /** Units of a project that have photos, one page at a time. */
  async photos(tenantId: string, productId: string, filters: UnitPhotoFilters) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId }, select: { id: true } });
    if (!product) throw new Error('Product not found');
    const photo = { tenantId, mediaType: 'IMAGE' as const };
    const where: Prisma.ProductUnitWhereInput = {
      tenantId,
      variant: { productId, tenantId },
      media: { some: photo },
      ...(filters.search ? { code: { contains: filters.search } } : {}),
      ...(filters.variantId ? { variantId: filters.variantId } : {}),
      ...(filters.typeVariantId ? { typeVariantId: filters.typeVariantId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.productUnit.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          code: true,
          variant: { select: { name: true } },
          typeVariant: { select: { name: true } },
          media: {
            where: photo,
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, fileUrl: true },
          },
        },
      }),
      this.prisma.productUnit.count({ where }),
    ]);
    return {
      data: data.map(({ variant, typeVariant, media, ...unit }) => ({
        ...unit, type: variant.name, variant: typeVariant.name, photos: media,
      })),
      meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  async list(tenantId: string, filters: UnitListFilters) {
    await expireOverdueReservations(this.prisma, tenantId);
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

    const [rows, total] = await Promise.all([
      this.prisma.productUnit.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { code: 'asc' },
        include: {
          variant: { select: { id: true, name: true, product: { select: { id: true, name: true } } } },
          typeVariant: { select: { id: true, name: true, basePrice: true, currentPrice: true } },
          category: { select: { id: true, name: true, type: true } },
        },
      }),
      this.prisma.productUnit.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        ...row,
        // Keep the existing reservation contract while exposing the dynamic child variant.
        variant: { ...row.variant, currentPrice: row.typeVariant.currentPrice },
      })),
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }
}
