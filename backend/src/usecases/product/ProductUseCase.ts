import type { AttributeDataType, Prisma, PrismaClient } from '@prisma/client';
import { assertCategory, categoryWithDescendants } from './catalogRules.js';
import {
  assertUnits,
  orderLocations,
  type LocationInput,
  type UnitInput,
} from './catalogStructure.js';

/** Value of a master attribute for a product or one of its variants (pivot row). */
export type AttributeInput = {
  variantId?: string | null;
  attributeId?: string;
  value?: number;
};

/** Attribute sent with a new product: the master row is found by code, or created. */
export type NewAttributeInput = {
  name?: string;
  code?: string;
  dataType?: AttributeDataType;
  value?: number;
  unit?: string | null;
};

export type VariantInput = {
  name?: string;
  basePrice?: number;
  currentPrice?: number;
  stock?: number;
  /** Only used when creating a product together with its variants. */
  attributes?: NewAttributeInput[];
};

export type ProductInput = {
  /** Omit to create a PROJECT category named after the product and use it as the root. */
  categoryId?: string;
  name?: string;
  code?: string;
  description?: string | null;
  province?: string | null;
  city?: string | null;
  subdistrict?: string | null;
  village?: string | null;
  address?: string | null;
  postalCode?: string | null;
  isActive?: boolean;
  variants?: VariantInput[];
  locations?: LocationInput[];
  units?: UnitInput[];
};

export type UnitSummary = {
  total: number;
  available: number;
  reserved: number;
  booked: number;
  sold: number;
  blocked: number;
};

export type ProductListFilters = {
  page: number;
  limit: number;
  search?: string | undefined;
  categoryId?: string;
  isActive?: boolean;
};

export class ProductUseCase {
  constructor(private prisma: PrismaClient) {}

  private async assertProductRelations(tenantId: string, input: ProductInput) {
    if (input.categoryId) {
      await assertCategory(this.prisma, tenantId, input.categoryId);
    }
  }

  /** Counts the units of each product by status, keyed by product id. */
  private async unitSummaries(tenantId: string, variantsByProduct: Map<string, string[]>) {
    const productOf = new Map<string, string>();
    for (const [productId, variantIds] of variantsByProduct) {
      for (const variantId of variantIds) productOf.set(variantId, productId);
    }
    const summaries = new Map<string, UnitSummary>();
    for (const productId of variantsByProduct.keys()) {
      summaries.set(productId, { total: 0, available: 0, reserved: 0, booked: 0, sold: 0, blocked: 0 });
    }
    if (productOf.size === 0) return summaries;

    const rows = await this.prisma.productUnit.groupBy({
      by: ['variantId', 'status'],
      where: { tenantId, variantId: { in: [...productOf.keys()] } },
      _count: { _all: true },
    });
    for (const row of rows) {
      const summary = summaries.get(productOf.get(row.variantId) as string) as UnitSummary;
      const count = row._count._all;
      summary.total += count;
      summary[row.status.toLowerCase() as keyof Omit<UnitSummary, 'total'>] += count;
    }
    return summaries;
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
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const [rows, total, active, inactive] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          variants: { select: { id: true, basePrice: true } },
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

    const summaries = await this.unitSummaries(
      tenantId,
      new Map(rows.map((row) => [row.id, row.variants.map((v) => v.id)]))
    );
    const data = rows.map(({ variants, media, ...product }) => {
      const prices = variants.map((v) => Number(v.basePrice));
      return {
        ...product,
        unitSummary: summaries.get(product.id),
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
        variants: { orderBy: { createdAt: 'asc' } },
        attributes: {
          orderBy: [{ variantId: 'asc' }, { attribute: { name: 'asc' } }],
          include: { attribute: true },
        },
        media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!product) throw new Error('Product not found');
    const variants = product.variants ?? [];
    const summaries = await this.unitSummaries(
      tenantId,
      new Map([[product.id, variants.map((v) => v.id)]])
    );
    return { ...product, unitSummary: summaries.get(product.id) };
  }

  /**
   * Creates a product with its variants (and their attributes). It can also create the
   * location tree and the units in the same transaction, so a project is saved as a whole.
   * Without `categoryId`, a PROJECT category with the same name and code becomes the tree root.
   */
  async create(tenantId: string, input: ProductInput) {
    if (!input.name || !input.code) throw new Error('name and code are required');
    const variants = input.variants ?? [];
    if (variants.length === 0) throw new Error('variants must contain at least one variant');
    for (const variant of variants) {
      const codes = (variant.attributes ?? []).map((a) => a.code);
      if (new Set(codes).size !== codes.length) {
        throw new Error(`Variant ${variant.name} has duplicate attribute codes`);
      }
    }
    const locations = orderLocations(input.locations ?? []);
    const units = input.units ?? [];
    assertUnits(units, variants.length, new Set(locations.map((l) => l.key)));
    await this.assertProductRelations(tenantId, input);

    const created = await this.prisma.$transaction(
      async (tx) => {
        const rootId =
          input.categoryId ??
          (
            await tx.productCategory.create({
              data: {
                tenantId,
                name: input.name as string,
                code: input.code as string,
                type: 'PROJECT',
                isActive: input.isActive ?? true,
              },
            })
          ).id;
        const product = await tx.product.create({
          data: {
            tenantId,
            categoryId: rootId,
            name: input.name as string,
            code: input.code as string,
            description: input.description ?? null,
            province: input.province ?? null,
            city: input.city ?? null,
            subdistrict: input.subdistrict ?? null,
            village: input.village ?? null,
            address: input.address ?? null,
            postalCode: input.postalCode ?? null,
            isActive: input.isActive ?? true,
          },
        });

        const masterIds = new Map<string, string>();
        const masterOf = async (a: NewAttributeInput) => {
          const known = masterIds.get(a.code as string);
          if (known) return known;
          const existing = await tx.attribute.findFirst({
            where: { tenantId, code: a.code as string },
            select: { id: true },
          });
          const id =
            existing?.id ??
            (
              await tx.attribute.create({
                data: {
                  tenantId,
                  code: a.code as string,
                  name: a.name as string,
                  dataType: a.dataType as AttributeDataType,
                  unit: a.unit ?? null,
                },
              })
            ).id;
          masterIds.set(a.code as string, id);
          return id;
        };

        const variantIds: string[] = [];
        for (const variant of variants) {
          const row = await tx.productVariant.create({
            data: {
              tenantId,
              productId: product.id,
              name: variant.name as string,
              basePrice: variant.basePrice as number,
              currentPrice: variant.currentPrice ?? (variant.basePrice as number),
              stock: variant.stock ?? 0,
            },
          });
          variantIds.push(row.id);
          if (variant.attributes?.length) {
            const pivots = [];
            for (const a of variant.attributes) {
              pivots.push({
                tenantId,
                productId: product.id,
                variantId: row.id,
                attributeId: await masterOf(a),
                value: a.value ?? 0,
              });
            }
            await tx.productAttribute.createMany({ data: pivots });
          }
        }

        // ponytail: node codes are generated as `<product code>-001`, `-002`, ...; a manual code with the same value conflicts (409).
        const locationIds = new Map<string, string>();
        let sequence = 0;
        for (const location of locations) {
          sequence += 1;
          const row = await tx.productCategory.create({
            data: {
              tenantId,
              parentId: location.parentKey ? (locationIds.get(location.parentKey) as string) : rootId,
              name: location.name,
              code: location.code ?? `${input.code}-${String(sequence).padStart(3, '0')}`,
              type: location.type,
            },
          });
          locationIds.set(location.key, row.id);
        }

        if (units.length > 0) {
          await tx.productUnit.createMany({
            data: units.map((u) => ({
              tenantId,
              variantId: variantIds[u.variantIndex] as string,
              categoryId: u.locationKey ? (locationIds.get(u.locationKey) as string) : rootId,
              code: u.code,
              name: u.name ?? null,
              status: u.status ?? 'AVAILABLE',
            })),
          });
        }
        return product;
      },
      { timeout: 30000 }
    );
    return this.get(created.id, tenantId);
  }

  async update(id: string, tenantId: string, input: ProductInput) {
    await this.get(id, tenantId);
    await this.assertProductRelations(tenantId, input);

    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.name !== undefined) data.name = input.name;
    if (input.code !== undefined) data.code = input.code;
    if (input.description !== undefined) data.description = input.description;
    for (const field of ['province', 'city', 'subdistrict', 'village', 'address', 'postalCode'] as const) {
      if (input[field] !== undefined) data[field] = input[field];
    }
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
        basePrice: input.basePrice as number,
        currentPrice: input.currentPrice ?? (input.basePrice as number),
        stock: input.stock ?? 0,
      },
    });
  }

  async updateVariant(productId: string, variantId: string, tenantId: string, input: VariantInput) {
    await this.assertVariant(productId, variantId, tenantId);
    const data: Prisma.ProductVariantUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.basePrice !== undefined) data.basePrice = input.basePrice;
    if (input.currentPrice !== undefined) data.currentPrice = input.currentPrice;
    if (input.stock !== undefined) data.stock = input.stock;
    return this.prisma.productVariant.update({ where: { id: variantId }, data });
  }

  async removeVariant(productId: string, variantId: string, tenantId: string) {
    await this.assertVariant(productId, variantId, tenantId);
    const count = await this.prisma.productVariant.count({ where: { productId, tenantId } });
    if (count <= 1) throw new Error('A product must keep at least one variant (conflict)');
    await this.prisma.productVariant.delete({ where: { id: variantId } });
  }

  // ---------- attributes (values; the definitions live in AttributeUseCase) ----------

  private async assertAttributeFree(
    productId: string,
    variantId: string | null,
    attributeId: string,
    exceptId?: string
  ) {
    const existing = await this.prisma.productAttribute.findFirst({
      where: { productId, variantId, attributeId, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new Error('This attribute already has a value at this level');
  }

  async addAttribute(productId: string, tenantId: string, input: AttributeInput) {
    await this.get(productId, tenantId);
    const variantId = input.variantId ?? null;
    if (variantId) await this.assertVariant(productId, variantId, tenantId);
    const master = await this.prisma.attribute.findFirst({
      where: { id: input.attributeId as string, tenantId },
      select: { id: true },
    });
    if (!master) throw new Error('Attribute not found');
    await this.assertAttributeFree(productId, variantId, master.id);
    return this.prisma.productAttribute.create({
      data: { tenantId, productId, variantId, attributeId: master.id, value: input.value ?? 0 },
      include: { attribute: true },
    });
  }

  async updateAttribute(
    productId: string,
    productAttributeId: string,
    tenantId: string,
    input: AttributeInput
  ) {
    const current = await this.prisma.productAttribute.findFirst({
      where: { id: productAttributeId, productId, tenantId },
    });
    if (!current) throw new Error('Attribute not found');
    const variantId = input.variantId !== undefined ? input.variantId : current.variantId;
    if (variantId) await this.assertVariant(productId, variantId, tenantId);
    await this.assertAttributeFree(productId, variantId, current.attributeId, productAttributeId);

    return this.prisma.productAttribute.update({
      where: { id: productAttributeId },
      data: { variantId, value: input.value ?? current.value },
      include: { attribute: true },
    });
  }

  async removeAttribute(productId: string, productAttributeId: string, tenantId: string) {
    const current = await this.prisma.productAttribute.findFirst({
      where: { id: productAttributeId, productId, tenantId },
      select: { id: true },
    });
    if (!current) throw new Error('Attribute not found');
    await this.prisma.productAttribute.delete({ where: { id: productAttributeId } });
  }
}
