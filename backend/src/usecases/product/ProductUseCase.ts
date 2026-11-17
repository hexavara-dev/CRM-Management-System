import { randomUUID } from 'crypto';
import type { AttributeDataType, Prisma, PrismaClient } from '@prisma/client';
import { localStorage } from '../../infrastructure/storage/localStorage.js';
import { validateProductImage } from './ProductMediaUseCase.js';
import { assertCategory, categoryWithDescendants } from './catalogRules.js';
import {
  assertUnits,
  assertUnitsWithinStock,
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
  id?: string;
  name?: string;
  basePrice?: number;
  currentPrice?: number;
  /** Batas minimum harga jual unit; null menghapus batas. */
  minPrice?: number | null;
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
  mapsUrl?: string | null;
  isActive?: boolean;
  variants?: VariantInput[];
  locations?: LocationInput[];
  units?: UnitInput[];
  facilityAttributeIds?: string[];
  removeMediaIds?: string[];
  primaryMediaId?: string;
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
  constructor(private prisma: PrismaClient, private storage: typeof localStorage = localStorage) {}

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
            where: { mediaType: 'IMAGE', variantId: null, unitId: null },
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
        variants: {
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { units: true } } },
        },
        attributes: {
          orderBy: [{ variantId: 'asc' }, { attribute: { name: 'asc' } }],
          include: { attribute: true },
        },
        media: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!product) throw new Error('Product not found');
    const variants = (product.variants ?? []).map(({ _count, ...variant }) => ({
      ...variant,
      unitCount: _count?.units ?? 0,
    }));
    const summaries = await this.unitSummaries(
      tenantId,
      new Map([[product.id, variants.map((v) => v.id)]])
    );
    return { ...product, variants, unitSummary: summaries.get(product.id) };
  }

  /** Snapshot for the edit wizard; IDs retain existing variant, location and unit relations. */
  async getEdit(id: string, tenantId: string) {
    const product = await this.get(id, tenantId);
    const categories = await this.prisma.productCategory.findMany({
      where: { tenantId },
      select: { id: true, parentId: true, name: true, code: true, type: true },
    });
    const children = new Map<string, typeof categories>();
    for (const category of categories) {
      if (!category.parentId) continue;
      const siblings = children.get(category.parentId) ?? [];
      siblings.push(category);
      children.set(category.parentId, siblings);
    }
    const locations: typeof categories = [];
    const queue = [product.categoryId];
    const seen = new Set(queue);
    for (let index = 0; index < queue.length; index++) {
      const descendants = (children.get(queue[index] as string) ?? []).filter((child) => !seen.has(child.id));
      descendants.forEach((child) => seen.add(child.id));
      locations.push(...descendants);
      queue.push(...descendants.map((child) => child.id));
    }
    const units = await this.prisma.productUnit.findMany({
      where: { tenantId, variant: { productId: id, tenantId } },
      orderBy: { code: 'asc' },
      select: { id: true, categoryId: true, variantId: true, code: true, status: true, isHook: true },
    });
    return { ...product, locations, units };
  }

  /**
   * Creates a product with its variants (and their attributes). It can also create the
   * location tree and the units in the same transaction, so a project is saved as a whole.
   * Without `categoryId`, a PROJECT category with the same name and code becomes the tree root.
   */
  async create(tenantId: string, input: ProductInput, covers: Express.Multer.File[] = []) {
    if (!input.name || !input.code) throw new Error('name and code are required');
    const facilityIds = input.facilityAttributeIds ?? [];
    if (facilityIds.length) {
      const count = await this.prisma.attribute.count({
        where: { tenantId, id: { in: facilityIds }, source: 'PROJECT' },
      });
      if (count !== facilityIds.length) throw new Error('Invalid facility attribute IDs');
    }
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
    assertUnitsWithinStock(units, variants.map((variant) => ({ name: variant.name, stock: variant.stock ?? 0 })));
    await this.assertProductRelations(tenantId, input);

    if (covers.length > 10) throw new Error('Invalid cover count');
    const extensions = covers.map(validateProductImage);
    const productId = covers.length ? randomUUID() : undefined;
    const storedCovers: { file: Express.Multer.File; path: string; url: string }[] = [];

    let created: { id: string };
    try {
      for (const [index, file] of covers.entries()) {
        const path = `${tenantId}/product/${productId}/${randomUUID()}.${extensions[index]}`;
        // Track the path before writing so a partial filesystem write is cleaned up too.
        storedCovers.push({ file, path, url: this.storage.getPublicUrl(path).publicUrl });
        await this.storage.upload(path, file.buffer);
      }

      created = await this.prisma.$transaction(
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
            ...(productId ? { id: productId } : {}),
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
            mapsUrl: input.mapsUrl ?? null,
            isActive: input.isActive ?? true,
          },
        });

        if (facilityIds.length) {
          await tx.productAttribute.createMany({
            data: facilityIds.map((attributeId) => ({
              tenantId, productId: product.id, variantId: null, attributeId, value: 1,
            })),
          });
        }

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
              minPrice: variant.minPrice ?? null,
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
              isHook: u.isHook ?? false,
            })),
          });
        }
        if (storedCovers.length) {
          await tx.productMedia.createMany({
            data: storedCovers.map(({ file, url }, index) => ({
              tenantId,
              productId: product.id,
              variantId: null,
              mediaType: 'IMAGE',
              fileName: file.originalname.slice(0, 255),
              fileUrl: url,
              fileType: file.mimetype,
              fileSize: file.buffer.length,
              sortOrder: index,
              isPrimary: index === 0,
            })),
          });
        }
        return product;
      },
      { timeout: 30000 }
    );
    } catch (error) {
      await this.storage.remove(storedCovers.map((cover) => cover.path));
      throw error;
    }
    return this.get(created.id, tenantId);
  }

  async update(id: string, tenantId: string, input: ProductInput, covers: Express.Multer.File[] = []) {
    const project = await this.get(id, tenantId);
    await this.assertProductRelations(tenantId, input);
    const structureProvided = [input.variants, input.locations, input.units].some((part) => part !== undefined);
    if (structureProvided && (!input.variants || !input.locations || !input.units)) {
      throw new Error('variants, locations and units must be sent together');
    }
    if (structureProvided && (project.category.type !== 'PROJECT' || input.categoryId !== undefined)) {
      throw new Error('Invalid project category for wizard update');
    }
    const projectImages = project.media.filter((media) => media.mediaType === 'IMAGE' && !media.variantId && !media.unitId);
    const removeMediaIds = input.removeMediaIds ?? [];
    if (removeMediaIds.length > 10 || new Set(removeMediaIds).size !== removeMediaIds.length ||
      removeMediaIds.some((mediaId) => !projectImages.some((media) => media.id === mediaId))) {
      throw new Error('Invalid project media IDs');
    }
    if (input.primaryMediaId &&
      (!projectImages.some((media) => media.id === input.primaryMediaId) || removeMediaIds.includes(input.primaryMediaId))) {
      throw new Error('Invalid primary media ID');
    }
    const removedMedia = projectImages.filter((media) => removeMediaIds.includes(media.id));
    const facilityIds = input.facilityAttributeIds;
    if (facilityIds?.length) {
      const count = await this.prisma.attribute.count({ where: { tenantId, id: { in: facilityIds }, source: 'PROJECT' } });
      if (count !== facilityIds.length) throw new Error('Invalid facility attribute IDs');
    }

    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.name !== undefined) data.name = input.name;
    if (input.code !== undefined) data.code = input.code;
    if (input.description !== undefined) data.description = input.description;
    for (const field of ['province', 'city', 'subdistrict', 'village', 'address', 'postalCode'] as const) {
      if (input[field] !== undefined) data[field] = input[field];
    }
    if (input.mapsUrl !== undefined) data.mapsUrl = input.mapsUrl;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (covers.length > 10) throw new Error('Invalid cover count');
    const extensions = covers.map(validateProductImage);
    const storedCovers: { file: Express.Multer.File; path: string; url: string }[] = [];
    try {
      for (const [index, file] of covers.entries()) {
        const path = `${tenantId}/product/${id}/${randomUUID()}.${extensions[index]}`;
        storedCovers.push({ file, path, url: this.storage.getPublicUrl(path).publicUrl });
        await this.storage.upload(path, file.buffer);
      }
      await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data });
      if (input.name !== undefined || input.code !== undefined || input.isActive !== undefined) {
        await tx.productCategory.update({
          where: { id: project.categoryId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.code !== undefined ? { code: input.code } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
        });
      }
      if (facilityIds !== undefined) {
        await tx.productAttribute.deleteMany({
          where: { tenantId, productId: id, variantId: null, attribute: { source: 'PROJECT' } },
        });
        if (facilityIds.length) await tx.productAttribute.createMany({
          data: facilityIds.map((attributeId) => ({ tenantId, productId: id, variantId: null, attributeId, value: 1 })),
        });
      }
      if (structureProvided) await this.syncStructure(tx, id, tenantId, project.categoryId, input);
      if (removeMediaIds.length) {
        await tx.productMedia.deleteMany({ where: { tenantId, productId: id, id: { in: removeMediaIds } } });
      }
      if (storedCovers.length) {
        const existingImages = await tx.productMedia.count({
          where: { tenantId, productId: id, variantId: null, unitId: null, mediaType: 'IMAGE' },
        });
        await tx.productMedia.createMany({
          data: storedCovers.map(({ file, url }, index) => ({
            tenantId, productId: id, variantId: null, mediaType: 'IMAGE',
            fileName: file.originalname.slice(0, 255), fileUrl: url,
            fileType: file.mimetype, fileSize: file.buffer.length,
            sortOrder: index, isPrimary: existingImages === 0 && index === 0,
          })),
        });
      }
      if (input.primaryMediaId) {
        await tx.productMedia.updateMany({
          where: { tenantId, productId: id, variantId: null, unitId: null, mediaType: 'IMAGE', isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.productMedia.update({ where: { id: input.primaryMediaId }, data: { isPrimary: true } });
      } else if (removedMedia.some((media) => media.isPrimary)) {
        const replacement = await tx.productMedia.findFirst({
          where: { tenantId, productId: id, variantId: null, unitId: null, mediaType: 'IMAGE' },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true },
        });
        if (replacement) await tx.productMedia.update({ where: { id: replacement.id }, data: { isPrimary: true } });
      }
      }, { timeout: 30000 });
    } catch (error) {
      await this.storage.remove(storedCovers.map((cover) => cover.path));
      throw error;
    }
    const removedPaths = removedMedia.flatMap((media) => {
      try { return [this.storage.getFilePathFromPublicUrl(media.fileUrl)]; }
      catch { return []; }
    });
    if (removedPaths.length) await this.storage.remove(removedPaths);
    return this.get(id, tenantId);
  }

  /** Applies all wizard structure edits without replacing IDs that reservations and prices reference. */
  private async syncStructure(
    tx: Prisma.TransactionClient,
    productId: string,
    tenantId: string,
    rootId: string,
    input: ProductInput
  ) {
    const variants = input.variants as VariantInput[];
    const locations = orderLocations(input.locations as LocationInput[]);
    const units = input.units as UnitInput[];
    if (!variants.length) throw new Error('variants must contain at least one variant');
    assertUnits(units, variants.length, new Set(locations.map((location) => location.key)));

    const oldVariants = await tx.productVariant.findMany({
      where: { tenantId, productId }, select: { id: true, basePrice: true, currentPrice: true, stock: true },
    });
    const oldVariantIds = new Set(oldVariants.map((row) => row.id));
    const allCategories = await tx.productCategory.findMany({
      where: { tenantId }, select: { id: true, parentId: true, code: true },
    });
    const oldLocations = [] as typeof allCategories;
    const queue = [rootId];
    const seen = new Set(queue);
    for (let index = 0; index < queue.length; index++) {
      const children = allCategories.filter((row) => row.parentId === queue[index] && !seen.has(row.id));
      children.forEach((child) => seen.add(child.id));
      oldLocations.push(...children);
      queue.push(...children.map((child) => child.id));
    }
    const oldLocationIds = new Set(oldLocations.map((row) => row.id));
    const oldUnits = await tx.productUnit.findMany({
      where: { tenantId, variant: { productId, tenantId } },
      select: { id: true, variantId: true, categoryId: true, status: true, code: true, isHook: true },
    });
    const oldUnitIds = new Set(oldUnits.map((row) => row.id));
    const checkIds = (values: (string | undefined)[], known: Set<string>, label: string) => {
      const ids = values.filter((value): value is string => !!value);
      if (new Set(ids).size !== ids.length || ids.some((value) => !known.has(value))) {
        throw new Error(`Invalid ${label} IDs`);
      }
      return new Set(ids);
    };
    const keptVariantIds = checkIds(variants.map((row) => row.id), oldVariantIds, 'variant');
    const keptLocationIds = checkIds(locations.map((row) => row.id), oldLocationIds, 'location');
    const keptUnitIds = checkIds(units.map((row) => row.id), oldUnitIds, 'unit');
    // Stock tidak dikirim = pertahankan total slot tersimpan varian itu.
    assertUnitsWithinStock(units, variants.map((variant) => ({
      name: variant.name,
      stock: variant.stock ?? oldVariants.find((row) => row.id === variant.id)?.stock ?? 0,
    })));

    const removedUnits = oldUnits.filter((row) => !keptUnitIds.has(row.id));
    if (removedUnits.length) {
      const ids = removedUnits.map((row) => row.id);
      if (removedUnits.some((row) => row.status !== 'AVAILABLE') ||
        await tx.reservation.count({ where: { tenantId, unitId: { in: ids } } }) ||
        await tx.unitPriceAdjustment.count({ where: { tenantId, unitId: { in: ids } } }) ||
        await tx.productMedia.count({ where: { tenantId, unitId: { in: ids } } })) {
        throw new Error('Conflict: units with reservations, pricing history, media or non-available status must remain');
      }
      await tx.productUnit.deleteMany({ where: { tenantId, id: { in: ids } } });
    }

    const masterIds = new Map<string, string>();
    const masterOf = async (attribute: NewAttributeInput) => {
      const cached = masterIds.get(attribute.code as string);
      if (cached) return cached;
      const existing = await tx.attribute.findFirst({
        where: { tenantId, code: attribute.code as string }, select: { id: true },
      });
      const id = existing?.id ?? (await tx.attribute.create({
        data: { tenantId, code: attribute.code as string, name: attribute.name as string,
          dataType: attribute.dataType as AttributeDataType, unit: attribute.unit ?? null },
      })).id;
      masterIds.set(attribute.code as string, id);
      return id;
    };
    const variantIds: string[] = [];
    for (const variant of variants) {
      const old = oldVariants.find((row) => row.id === variant.id);
      const row = old
        ? await tx.productVariant.update({
            where: { id: old.id },
            data: {
              name: variant.name as string,
              basePrice: variant.basePrice as number,
              currentPrice: old.currentPrice === old.basePrice ? variant.basePrice as number : old.currentPrice,
              ...(variant.stock !== undefined ? { stock: variant.stock } : {}),
            },
          })
        : await tx.productVariant.create({
            data: { tenantId, productId, name: variant.name as string,
              basePrice: variant.basePrice as number, currentPrice: variant.basePrice as number, stock: variant.stock ?? 0 },
          });
      variantIds.push(row.id);
      for (const attribute of variant.attributes ?? []) {
        const attributeId = await masterOf(attribute);
        const existing = await tx.productAttribute.findFirst({
          where: { tenantId, productId, variantId: row.id, attributeId }, select: { id: true, value: true },
        });
        if (existing) {
          if (existing.value !== (attribute.value ?? 0)) {
            await tx.productAttribute.update({ where: { id: existing.id }, data: { value: attribute.value ?? 0 } });
          }
        } else {
          await tx.productAttribute.create({
            data: { tenantId, productId, variantId: row.id, attributeId, value: attribute.value ?? 0 },
          });
        }
      }
    }

    const locationIds = new Map<string, string>();
    for (const [index, location] of locations.entries()) {
      const parentId = location.parentKey ? locationIds.get(location.parentKey) : rootId;
      if (!parentId) throw new Error('Invalid location parent');
      const old = oldLocations.find((row) => row.id === location.id);
      const row = old
        ? await tx.productCategory.update({
            where: { id: old.id }, data: { parentId, name: location.name, type: location.type },
          })
        : await tx.productCategory.create({
            data: { tenantId, parentId, name: location.name, type: location.type,
              code: location.code ?? `${(input.code ?? '').slice(0, 75)}-${randomUUID().slice(0, 8)}-${index}` },
          });
      locationIds.set(location.key, row.id);
    }

    for (const unit of units) {
      const variantId = variantIds[unit.variantIndex] as string;
      const categoryId = unit.locationKey ? locationIds.get(unit.locationKey) : rootId;
      if (!categoryId) throw new Error('Invalid unit location');
      const old = oldUnits.find((row) => row.id === unit.id);
      if (old) {
        if ((old.variantId !== variantId || old.categoryId !== categoryId) &&
          await tx.reservation.count({ where: { tenantId, unitId: old.id } })) {
          throw new Error('Conflict: a unit with reservations must keep its type and location');
        }
        if (old.code !== unit.code || old.variantId !== variantId || old.categoryId !== categoryId || old.isHook !== (unit.isHook ?? false)) {
          await tx.productUnit.update({
            where: { id: old.id }, data: { code: unit.code, variantId, categoryId, isHook: unit.isHook ?? false },
          });
        }
      } else {
        await tx.productUnit.create({
          data: { tenantId, code: unit.code, variantId, categoryId,
            status: unit.status ?? 'AVAILABLE', isHook: unit.isHook ?? false },
        });
      }
    }

    const removedVariants = oldVariants.filter((row) => !keptVariantIds.has(row.id));
    for (const row of removedVariants) {
      if (await tx.productVariantPriceLog.count({ where: { tenantId, variantId: row.id } }) ||
        await tx.productMedia.count({ where: { tenantId, variantId: row.id } })) {
        throw new Error('Conflict: a type with pricing history or media must remain');
      }
      await tx.productVariant.delete({ where: { id: row.id } });
    }
    for (const row of oldLocations.reverse()) {
      if (keptLocationIds.has(row.id)) continue;
      if (await tx.productVariantPriceLog.count({ where: { tenantId, categoryId: row.id } })) {
        throw new Error('Conflict: a location with pricing history must remain');
      }
      await tx.productCategory.delete({ where: { id: row.id } });
    }
  }

  /** Deletes the product and returns the stored file URLs of its media for cleanup. */
  async remove(id: string, tenantId: string) {
    const product = await this.get(id, tenantId);
    const unitCount = await this.prisma.productUnit.count({ where: { tenantId, variant: { productId: id, tenantId } } });
    if (unitCount > 0) throw new Error('Project has units (conflict). Deactivate it instead.');
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
        minPrice: input.minPrice ?? null,
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
    if (input.minPrice !== undefined) data.minPrice = input.minPrice;
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
      select: { id: true, source: true },
    });
    if (!master) throw new Error('Attribute not found');
    if (master.source !== (variantId ? 'UNIT_TYPE' : 'PROJECT')) {
      throw new Error('Invalid attribute source for this level');
    }
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
    const master = await this.prisma.attribute.findFirst({
      where: { id: current.attributeId, tenantId }, select: { source: true },
    });
    if (!master || master.source !== (variantId ? 'UNIT_TYPE' : 'PROJECT')) {
      throw new Error('Invalid attribute source for this level');
    }
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
