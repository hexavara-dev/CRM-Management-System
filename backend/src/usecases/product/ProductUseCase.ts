import type {
  AttributeDataType,
  Prisma,
  PrismaClient,
  TrackingType,
} from '@prisma/client';
import {
  assertCategory,
  categoryWithDescendants,
  validateAttributeValue,
} from './catalogRules.js';

export type VariantInput = { name?: string; code?: string; basePrice?: number };

export type ProductInput = {
  categoryId?: string;
  projectCategoryId?: string | null;
  name?: string;
  code?: string;
  description?: string | null;
  trackingType?: TrackingType;
  isActive?: boolean;
  variants?: VariantInput[];
};

export type AttributeInput = {
  variantId?: string | null;
  name?: string;
  code?: string;
  dataType?: AttributeDataType;
  value?: string;
  unit?: string | null;
};

export type ProductListFilters = {
  page: number;
  limit: number;
  search?: string | undefined;
  categoryId?: string;
  projectCategoryId?: string;
  trackingType?: TrackingType;
  isActive?: boolean;
};

const MODE_ALLOWS: Record<string, TrackingType[]> = {
  QUANTITY_ONLY: ['QUANTITY'],
  UNIT_ONLY: ['UNIT'],
  BOTH: ['QUANTITY', 'UNIT'],
};

export class ProductUseCase {
  constructor(private prisma: PrismaClient) {}

  private async assertTrackingAllowed(tenantId: string, trackingType: TrackingType) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { inventoryTrackingMode: true },
    });
    if (!tenant) throw new Error('Tenant context missing');
    if (!MODE_ALLOWS[tenant.inventoryTrackingMode]?.includes(trackingType)) {
      throw new Error(
        `trackingType must match the company inventory tracking mode (${tenant.inventoryTrackingMode})`
      );
    }
  }

  private async assertProductRelations(tenantId: string, input: ProductInput) {
    if (input.categoryId) await assertCategory(this.prisma, tenantId, input.categoryId, ['CATEGORY']);
    if (input.projectCategoryId) {
      await assertCategory(this.prisma, tenantId, input.projectCategoryId, ['PROJECT'], 'Project');
    }
  }

  async list(tenantId: string, filters: ProductListFilters) {
    const where: Prisma.ProductWhereInput = { tenantId };
    if (filters.search) {
      where.OR = [{ name: { contains: filters.search } }, { code: { contains: filters.search } }];
    }
    if (filters.categoryId) {
      const ids = await categoryWithDescendants(this.prisma, tenantId, filters.categoryId);
      where.categoryId = { in: ids };
    }
    if (filters.projectCategoryId) where.projectCategoryId = filters.projectCategoryId;
    if (filters.trackingType) where.trackingType = filters.trackingType;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const [rows, total, active, inactive] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          projectCategory: { select: { id: true, name: true } },
          variants: { select: { basePrice: true } },
          media: {
            where: { mediaType: 'IMAGE', variantId: null },
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
            select: { fileUrl: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
      this.prisma.product.count({ where: { tenantId, isActive: true } }),
      this.prisma.product.count({ where: { tenantId, isActive: false } }),
    ]);

    const data = rows.map(({ variants, media, ...product }) => {
      const prices = variants.map((v) => Number(v.basePrice));
      return {
        ...product,
        variantCount: variants.length,
        minBasePrice: prices.length ? Math.min(...prices) : null,
        coverUrl: media[0]?.fileUrl ?? null,
      };
    });

    return {
      data,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
      summary: { total: active + inactive, active, inactive },
    };
  }

  async get(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true, type: true } },
        projectCategory: { select: { id: true, name: true, type: true } },
        variants: { orderBy: { createdAt: 'asc' } },
        attributes: { orderBy: [{ variantId: 'asc' }, { name: 'asc' }] },
        media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!product) throw new Error('Product not found');
    return product;
  }

  async create(tenantId: string, input: ProductInput) {
    if (!input.categoryId || !input.name || !input.code || !input.trackingType) {
      throw new Error('categoryId, name, code, and trackingType are required');
    }
    const variants = input.variants ?? [];
    if (variants.length === 0) throw new Error('variants must contain at least one variant');
    await this.assertTrackingAllowed(tenantId, input.trackingType);
    await this.assertProductRelations(tenantId, input);

    const created = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId,
          categoryId: input.categoryId as string,
          projectCategoryId: input.projectCategoryId ?? null,
          name: input.name as string,
          code: input.code as string,
          description: input.description ?? null,
          trackingType: input.trackingType as TrackingType,
          isActive: input.isActive ?? true,
        },
      });
      await tx.productVariant.createMany({
        data: variants.map((v) => ({
          tenantId,
          productId: product.id,
          name: v.name as string,
          code: v.code as string,
          basePrice: v.basePrice as number,
        })),
      });
      return product;
    });
    return this.get(created.id, tenantId);
  }

  async update(id: string, tenantId: string, input: ProductInput) {
    const current = await this.get(id, tenantId);
    // tracking_type akan dikunci saat inventory dan unit sudah tersedia (Fase 4 dan 5).
    if (input.trackingType && input.trackingType !== current.trackingType) {
      await this.assertTrackingAllowed(tenantId, input.trackingType);
    }
    await this.assertProductRelations(tenantId, input);

    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.projectCategoryId !== undefined) data.projectCategoryId = input.projectCategoryId;
    if (input.name !== undefined) data.name = input.name;
    if (input.code !== undefined) data.code = input.code;
    if (input.description !== undefined) data.description = input.description;
    if (input.trackingType !== undefined) data.trackingType = input.trackingType;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    await this.prisma.product.update({ where: { id }, data });
    return this.get(id, tenantId);
  }

  /** Deletes the product and returns the stored file URLs of its media for cleanup. */
  async remove(id: string, tenantId: string) {
    const product = await this.get(id, tenantId);
    await this.prisma.product.delete({ where: { id } });
    return product.media.filter((m) => m.mediaType !== 'VIDEO_LINK').map((m) => m.fileUrl);
  }

  // ---------- variants ----------

  private async assertVariant(productId: string, variantId: string, tenantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, tenantId },
    });
    if (!variant) throw new Error('Variant not found');
    return variant;
  }

  async addVariant(productId: string, tenantId: string, input: VariantInput) {
    await this.get(productId, tenantId);
    return this.prisma.productVariant.create({
      data: {
        tenantId,
        productId,
        name: input.name as string,
        code: input.code as string,
        basePrice: input.basePrice as number,
      },
    });
  }

  async updateVariant(productId: string, variantId: string, tenantId: string, input: VariantInput) {
    await this.assertVariant(productId, variantId, tenantId);
    const data: Prisma.ProductVariantUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.code !== undefined) data.code = input.code;
    if (input.basePrice !== undefined) data.basePrice = input.basePrice;
    return this.prisma.productVariant.update({ where: { id: variantId }, data });
  }

  async removeVariant(productId: string, variantId: string, tenantId: string) {
    await this.assertVariant(productId, variantId, tenantId);
    const count = await this.prisma.productVariant.count({ where: { productId, tenantId } });
    if (count <= 1) throw new Error('A product must keep at least one variant (conflict)');
    await this.prisma.productVariant.delete({ where: { id: variantId } });
  }

  // ---------- attributes ----------

  private async assertAttributeCodeFree(
    productId: string,
    variantId: string | null,
    code: string,
    exceptId?: string
  ) {
    const existing = await this.prisma.productAttribute.findFirst({
      where: { productId, variantId, code, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new Error('Attribute with this code already exists at this level');
  }

  async addAttribute(productId: string, tenantId: string, input: AttributeInput) {
    await this.get(productId, tenantId);
    const variantId = input.variantId ?? null;
    if (variantId) await this.assertVariant(productId, variantId, tenantId);
    validateAttributeValue(input.dataType as AttributeDataType, input.value as string);
    await this.assertAttributeCodeFree(productId, variantId, input.code as string);
    return this.prisma.productAttribute.create({
      data: {
        tenantId,
        productId,
        variantId,
        name: input.name as string,
        code: input.code as string,
        dataType: input.dataType as AttributeDataType,
        value: input.value as string,
        unit: input.unit ?? null,
      },
    });
  }

  async updateAttribute(
    productId: string,
    attributeId: string,
    tenantId: string,
    input: AttributeInput
  ) {
    const current = await this.prisma.productAttribute.findFirst({
      where: { id: attributeId, productId, tenantId },
    });
    if (!current) throw new Error('Attribute not found');
    const variantId = input.variantId !== undefined ? input.variantId : current.variantId;
    if (variantId) await this.assertVariant(productId, variantId, tenantId);
    const dataType = input.dataType ?? current.dataType;
    const value = input.value ?? current.value;
    validateAttributeValue(dataType, value);
    await this.assertAttributeCodeFree(productId, variantId, input.code ?? current.code, attributeId);

    const data: Prisma.ProductAttributeUncheckedUpdateInput = { variantId, dataType, value };
    if (input.name !== undefined) data.name = input.name;
    if (input.code !== undefined) data.code = input.code;
    if (input.unit !== undefined) data.unit = input.unit;
    return this.prisma.productAttribute.update({ where: { id: attributeId }, data });
  }

  async removeAttribute(productId: string, attributeId: string, tenantId: string) {
    const current = await this.prisma.productAttribute.findFirst({
      where: { id: attributeId, productId, tenantId },
      select: { id: true },
    });
    if (!current) throw new Error('Attribute not found');
    await this.prisma.productAttribute.delete({ where: { id: attributeId } });
  }
}
