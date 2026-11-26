import { randomUUID } from 'crypto';
import type { AttributeDataType, Prisma, PrismaClient } from '@prisma/client';
import { localStorage } from '../../infrastructure/storage/localStorage.js';
import { validateProductImage } from './ProductMediaUseCase.js';
import { assertCategory, categoryWithDescendants } from './catalogRules.js';
import { saveOwnerImages, type StoredImage } from './typeImages.js';
import { retryUniqueCode, uniqueCode } from './uniqueCode.js';
import {
  assertUnits,
  assertLocationNames,
  assertUnitsOnLeaves,
  assertUnitsWithinStock,
  byLocationName,
  orderLocations,
  swappedNames,
  type LocationInput,
  type UnitInput,
} from './catalogStructure.js';

/** Value of a master attribute for a product (facility) or one of its type variants (specification). */
export type AttributeInput = {
  typeVariantId?: string | null;
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
  typeVariants?: TypeVariantInput[];
  /** Legacy single-variant input; normalized to a child named "Default". */
  basePrice?: number;
  currentPrice?: number;
  /** Batas minimum harga jual unit; null menghapus batas. */
  minPrice?: number | null;
  stock?: number;
  /** Urutan akhir foto tipe; lihat saveOwnerImages. */
  mediaOrder?: string[];
};

export type TypeVariantInput = {
  id?: string;
  name?: string;
  code?: string | null;
  basePrice?: number;
  currentPrice?: number;
  minPrice?: number | null;
  stock?: number;
  isActive?: boolean;
  /** Spesifikasi unit milik varian ini; yang tidak dikirim tidak diubah. */
  attributes?: NewAttributeInput[];
  /** Urutan akhir foto varian; lihat saveOwnerImages. */
  mediaOrder?: string[];
};

export type ProjectTypeImage = { variantIndex: number; file: Express.Multer.File };
export type ProjectTypeVariantImage = { variantIndex: number; typeVariantIndex: number; file: Express.Multer.File };
export type ProjectUnitImage = { unitIndex: number; file: Express.Multer.File };

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
  siteplanImg?: string | null;
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

/** Photos sent with one type: for the type itself and for its variants. */
export type TypeImageUploads = {
  type: Express.Multer.File[];
  variants: { typeVariantIndex: number; file: Express.Multer.File }[];
};
const NO_IMAGES: TypeImageUploads = { type: [], variants: [] };

/** A type that is still used elsewhere cannot be deleted; explains what is using it. */
async function assertTypeRemovable(tx: Prisma.TransactionClient, tenantId: string, variantId: string) {
  if (await tx.productUnit.count({ where: { tenantId, variantId } })) {
    throw new Error('Conflict: a type with units must remain');
  }
  if (await tx.productVariantPriceLog.count({ where: { tenantId, typeVariant: { productVariantId: variantId } } })) {
    throw new Error('Conflict: a type with pricing history must remain');
  }
  if (await tx.lead.count({ where: { tenantId, productVariantId: variantId } }) ||
    await tx.leadInterest.count({ where: { tenantId, variantId } })) {
    throw new Error('Conflict: a type used by leads must remain');
  }
}

/** Kode proyek unik per company, termasuk terhadap kode lokasi yang memakai ruang nama yang sama. */
async function assertProjectCode(
  tx: Prisma.TransactionClient,
  tenantId: string,
  code: string,
  self?: { productId: string; categoryId: string }
) {
  const taken =
    (await tx.product.findFirst({
      where: { tenantId, code, ...(self ? { id: { not: self.productId } } : {}) }, select: { id: true },
    })) ??
    (await tx.productCategory.findFirst({
      where: { tenantId, code, ...(self ? { id: { not: self.categoryId } } : {}) }, select: { id: true },
    }));
  if (taken) throw new Error(`Conflict: kode proyek "${code}" sudah dipakai. Gunakan kode lain.`);
}

/** Sama dengan MAX_PROJECT_COVERS di frontend. */
const MAX_PROJECT_COVERS = 5;

function assertCoverCount(total: number) {
  if (total > MAX_PROJECT_COVERS) throw new Error(`Invalid cover count: maksimal ${MAX_PROJECT_COVERS} gambar sampul.`);
}

function assertUniqueSpecifications(variants: VariantInput[]) {
  for (const variant of variants) {
    for (const option of variant.typeVariants ?? []) {
      const codes = (option.attributes ?? []).map((attribute) => attribute.code);
      if (new Set(codes).size !== codes.length) {
        throw new Error(`Invalid attributes: variant ${option.name} has duplicate attribute codes`);
      }
    }
  }
}

/** Finds (or creates) UNIT_TYPE attribute masters by code, cached for one transaction. */
function specificationMasters(tx: Prisma.TransactionClient, tenantId: string) {
  const ids = new Map<string, string>();
  return async (attribute: NewAttributeInput) => {
    const code = attribute.code as string;
    const known = ids.get(code);
    if (known) return known;
    const existing = await tx.attribute.findFirst({ where: { tenantId, code }, select: { id: true, source: true } });
    if (existing && existing.source !== 'UNIT_TYPE') throw new Error('Invalid attribute source for this level');
    const id =
      existing?.id ??
      (
        await tx.attribute.create({
          data: {
            tenantId,
            code,
            name: attribute.name as string,
            dataType: attribute.dataType as AttributeDataType,
            unit: attribute.unit ?? null,
          },
        })
      ).id;
    ids.set(code, id);
    return id;
  };
}

/** Nilai spesifikasi disimpan dua angka di belakang koma. */
const specValue = (value: number | undefined) => Math.round((value ?? 0) * 100) / 100;

/** Prisma mengirim Decimal; klien selalu menerima angka. */
const withNumber = <T extends { value: unknown }>(row: T) => ({ ...row, value: Number(row.value) });

/** Saves the specifications of one type variant; values that did not change are not written. */
async function saveSpecifications(
  tx: Prisma.TransactionClient,
  owner: { tenantId: string; productId: string; variantId: string; typeVariantId: string },
  attributes: NewAttributeInput[] | undefined,
  masterOf: (attribute: NewAttributeInput) => Promise<string>
) {
  if (!attributes?.length) return;
  const current = await tx.productAttribute.findMany({
    where: { tenantId: owner.tenantId, typeVariantId: owner.typeVariantId },
    select: { id: true, attributeId: true, value: true },
  });
  for (const attribute of attributes) {
    const attributeId = await masterOf(attribute);
    const value = specValue(attribute.value);
    const existing = current.find((row) => row.attributeId === attributeId);
    if (!existing) await tx.productAttribute.create({ data: { ...owner, attributeId, value } });
    else if (Number(existing.value) !== value) await tx.productAttribute.update({ where: { id: existing.id }, data: { value } });
  }
}

export class ProductUseCase {
  constructor(private prisma: PrismaClient, private storage: typeof localStorage = localStorage) {}

  private typeVariantsOf(variant: VariantInput): TypeVariantInput[] {
    if (variant.typeVariants?.length) return variant.typeVariants;
    return [{
      name: 'Default',
      basePrice: variant.basePrice ?? 0,
      currentPrice: variant.currentPrice ?? variant.basePrice ?? 0,
      minPrice: variant.minPrice ?? null,
      stock: variant.stock ?? 0,
      isActive: true,
    }];
  }

  /** Writes validated images to storage; paths are tracked in `stored` first so failures can be cleaned up. */
  private async storeImages<T extends { file: Express.Multer.File }>(
    tenantId: string,
    productId: string,
    images: T[],
    stored: (T & StoredImage)[]
  ) {
    const extensions = images.map((image) => validateProductImage(image.file));
    for (const [index, image] of images.entries()) {
      const path = `${tenantId}/product/${productId}/${randomUUID()}.${extensions[index]}`;
      stored.push({ ...image, path, url: this.storage.getPublicUrl(path).publicUrl });
      await this.storage.upload(path, image.file.buffer);
    }
  }

  private async removeStoredUrls(urls: string[]) {
    const paths = urls.flatMap((url) => {
      try { return [this.storage.getFilePathFromPublicUrl(url)]; }
      catch { return []; }
    });
    if (paths.length) await this.storage.remove(paths);
  }

  private assertTypeImages(
    variants: VariantInput[],
    typeImages: { variantIndex: number }[],
    typeVariantImages: { variantIndex: number; typeVariantIndex: number }[]
  ) {
    if (typeImages.some((image) => !variants[image.variantIndex])) throw new Error('Invalid type image indexes');
    if (typeVariantImages.some((image) => {
      const variant = variants[image.variantIndex];
      return !variant || !this.typeVariantsOf(variant)[image.typeVariantIndex];
    })) throw new Error('Invalid type variant image indexes');
  }

  /** Saves the photos of one type and all of its variants; returns the URLs of removed photos. */
  private async saveTypeImages(
    tx: Prisma.TransactionClient,
    owner: { tenantId: string; productId: string; variantId: string },
    variant: VariantInput,
    typeVariantIds: string[],
    typeImages: StoredImage[],
    typeVariantImages: (StoredImage & { typeVariantIndex: number })[]
  ) {
    const removed = await saveOwnerImages(tx, { ...owner, typeVariantId: null }, variant.mediaOrder, typeImages);
    for (const [index, option] of this.typeVariantsOf(variant).entries()) {
      removed.push(...await saveOwnerImages(
        tx,
        { ...owner, typeVariantId: typeVariantIds[index] as string },
        option.mediaOrder,
        typeVariantImages.filter((image) => image.typeVariantIndex === index)
      ));
    }
    return removed;
  }

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
          variants: { select: { id: true, typeVariants: { select: { basePrice: true, stock: true } } } },
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
      const prices = variants.flatMap((v) => {
        const legacy = v as typeof v & { basePrice?: bigint | number };
        return v.typeVariants?.length ? v.typeVariants.map((item) => Number(item.basePrice)) : [Number(legacy.basePrice ?? 0)];
      });
      return {
        ...product,
        unitSummary: summaries.get(product.id),
        totalSlots: variants.reduce((total, variant) => {
          const legacy = variant as typeof variant & { stock?: number };
          return total + (variant.typeVariants?.reduce((sum, item) => sum + item.stock, 0) ?? legacy.stock ?? 0);
        }, 0),
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
        category: { select: { id: true, name: true, type: true, siteplanImg: true } },
        variants: {
          orderBy: { createdAt: 'asc' },
          include: {
            typeVariants: { orderBy: { createdAt: 'asc' }, include: { _count: { select: { units: true } } } },
            _count: { select: { units: true } },
          },
        },
        attributes: {
          orderBy: [{ variantId: 'asc' }, { typeVariantId: 'asc' }, { attribute: { name: 'asc' } }],
          include: { attribute: true },
        },
        // Foto unit bisa ribuan; dimuat per halaman lewat ProductUnitUseCase.photos.
        media: { where: { unitId: null }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!product) throw new Error('Product not found');
    const variants = (product.variants ?? []).map(({ _count, typeVariants, ...variant }) => {
      const normalized = typeVariants.map(({ _count: optionCount, ...option }) => ({
        ...option,
        unitCount: optionCount.units,
      }));
      const first = normalized[0];
      return {
        ...variant,
        typeVariants: normalized,
        // Compatibility aggregates for existing read-only consumers.
        basePrice: first?.basePrice ?? BigInt(0),
        currentPrice: first?.currentPrice ?? BigInt(0),
        minPrice: first?.minPrice ?? null,
        stock: first?.stock ?? 0,
        unitCount: _count?.units ?? 0,
      };
    });
    const summaries = await this.unitSummaries(
      tenantId,
      new Map([[product.id, variants.map((v) => v.id)]])
    );
    return {
      ...product,
      attributes: (product.attributes ?? []).map(withNumber),
      variants,
      totalSlots: variants.reduce((total, variant) => total + variant.typeVariants.reduce((sum, option) => sum + option.stock, 0), 0),
      unitSummary: summaries.get(product.id),
    };
  }

  /** Snapshot for the edit wizard; IDs retain existing variant, location and unit relations. */
  async getEdit(id: string, tenantId: string) {
    const product = await this.get(id, tenantId);
    const categories = await this.prisma.productCategory.findMany({
      where: { tenantId },
      select: { id: true, parentId: true, name: true, code: true, type: true },
    });
    const children = new Map<string, typeof categories>();
    for (const category of [...categories].sort(byLocationName)) {
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
      select: { id: true, categoryId: true, variantId: true, typeVariantId: true, code: true, status: true, media: { select: { id: true, fileUrl: true, isPrimary: true, sortOrder: true } } },
    });
    return { ...product, locations, units };
  }

  /**
   * Creates a product with its variants (and their attributes). It can also create the
   * location tree and the units in the same transaction, so a project is saved as a whole.
   * Without `categoryId`, a PROJECT category with the same name and code becomes the tree root.
   */
  async create(tenantId: string, input: ProductInput, covers: Express.Multer.File[] = [], typeImages: ProjectTypeImage[] = [], siteplan?: Express.Multer.File, unitImages: ProjectUnitImage[] = [], typeVariantImages: ProjectTypeVariantImage[] = []) {
    if (!input.name || !input.code) throw new Error('name and code are required');
    const facilityIds = input.facilityAttributeIds ?? [];
    if (facilityIds.length) {
      const count = await this.prisma.attribute.count({
        where: { tenantId, id: { in: facilityIds }, source: 'PROJECT', isActive: true },
      });
      if (count !== facilityIds.length) throw new Error('Invalid facility attribute IDs');
    }
    const variants = input.variants ?? [];
    if (variants.length === 0) throw new Error('variants must contain at least one variant');
    this.assertTypeImages(variants, typeImages, typeVariantImages);
    assertUniqueSpecifications(variants);
    const locations = orderLocations(input.locations ?? []);
    const units = input.units ?? [];
    if (unitImages.some((image) => image.unitIndex < 0 || image.unitIndex >= units.length)) throw new Error('Invalid unit image indexes');
    const childVariants = variants.map((variant) => this.typeVariantsOf(variant));
    assertUnits(units, childVariants.map((items) => items.length), new Set(locations.map((l) => l.key)));
    assertUnitsOnLeaves(units, locations, { location: () => true, unit: () => true });
    assertLocationNames(locations, () => true);
    assertUnitsWithinStock(units, variants.map((variant, index) => ({
      name: variant.name,
      typeVariants: childVariants[index]!.map((item) => ({ name: item.name, stock: item.stock ?? 0 })),
    })));
    await this.assertProductRelations(tenantId, input);

    assertCoverCount(covers.length);
    const extensions = covers.map(validateProductImage);
    [...typeImages, ...typeVariantImages].forEach((image) => validateProductImage(image.file));
    const siteplanExtension = siteplan ? validateProductImage(siteplan) : undefined;
    const productId = covers.length || typeImages.length || typeVariantImages.length || siteplan || unitImages.length ? randomUUID() : undefined;
    const storedCovers: { file: Express.Multer.File; path: string; url: string }[] = [];
    const storedTypeImages: (ProjectTypeImage & StoredImage)[] = [];
    const storedTypeVariantImages: (ProjectTypeVariantImage & StoredImage)[] = [];
    let storedSiteplan: { file: Express.Multer.File; path: string; url: string } | undefined;
    const storedUnitImages: { file: Express.Multer.File; unitIndex: number; path: string; url: string }[] = [];

    let created: { id: string };
    try {
      for (const [index, file] of covers.entries()) {
        const path = `${tenantId}/product/${productId}/${randomUUID()}.${extensions[index]}`;
        // Track the path before writing so a partial filesystem write is cleaned up too.
        storedCovers.push({ file, path, url: this.storage.getPublicUrl(path).publicUrl });
        await this.storage.upload(path, file.buffer);
      }
      await this.storeImages(tenantId, productId as string, typeImages, storedTypeImages);
      await this.storeImages(tenantId, productId as string, typeVariantImages, storedTypeVariantImages);
      if (siteplan && siteplanExtension) {
        const path = `${tenantId}/product/${productId as string}/siteplan-${randomUUID()}.${siteplanExtension}`;
        storedSiteplan = { file: siteplan, path, url: this.storage.getPublicUrl(path).publicUrl };
        await this.storage.upload(path, siteplan.buffer);
      }
      for (const image of unitImages) {
        const extension = validateProductImage(image.file);
        const path = `${tenantId}/product/${productId as string}/unit-${image.unitIndex}-${randomUUID()}.${extension}`;
        storedUnitImages.push({ ...image, path, url: this.storage.getPublicUrl(path).publicUrl });
        await this.storage.upload(path, image.file.buffer);
      }

      created = await retryUniqueCode(() => this.prisma.$transaction(
      async (tx) => {
        const code = (input.code as string).trim();
        await assertProjectCode(tx, tenantId, code);
        const rootId =
          input.categoryId ??
          (
            await tx.productCategory.create({
              data: {
                tenantId,
                name: input.name as string,
                code,
                type: 'PROJECT',
                siteplanImg: storedSiteplan?.url ?? input.siteplanImg ?? null,
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
            code,
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

        const masterOf = specificationMasters(tx, tenantId);
        const variantIds: string[] = [];
        const typeVariantIds: string[][] = [];
        for (const [variantIndex, variant] of variants.entries()) {
          const row = await tx.productVariant.create({
            data: {
              tenantId,
              productId: product.id,
              name: variant.name as string,
            },
          });
          variantIds.push(row.id);
          const optionRows = [];
          for (const option of childVariants[variantIndex]!) {
            optionRows.push(await tx.productTypeVariant.create({
              data: {
                tenantId,
                productVariantId: row.id,
                name: option.name as string,
                code: option.code?.trim() || null,
                basePrice: option.basePrice ?? 0,
                currentPrice: option.currentPrice ?? option.basePrice ?? 0,
                minPrice: option.minPrice ?? null,
                stock: option.stock ?? 0,
                isActive: option.isActive ?? true,
              },
            }));
          }
          typeVariantIds.push(optionRows.map((option) => option.id));
          for (const [optionIndex, option] of childVariants[variantIndex]!.entries()) {
            await saveSpecifications(
              tx,
              { tenantId, productId: product.id, variantId: row.id, typeVariantId: optionRows[optionIndex]!.id },
              option.attributes,
              masterOf
            );
          }
        }

        // Location codes share one tenant-wide namespace with other categories.
        const locationIds = new Map<string, string>();
        let sequence = 0;
        for (const location of locations) {
          sequence += 1;
          const locationCode = await uniqueCode(location.code ?? `${code}-${String(sequence).padStart(3, '0')}`, 100, async (candidate) =>
            Boolean(await tx.productCategory.findFirst({ where: { tenantId, code: candidate }, select: { id: true } }))
          );
          const row = await tx.productCategory.create({
            data: {
              tenantId,
              parentId: location.parentKey ? (locationIds.get(location.parentKey) as string) : rootId,
              name: location.name,
              code: locationCode,
              type: location.type,
            },
          });
          locationIds.set(location.key, row.id);
        }

        if (units.length > 0) {
          const createdUnits = unitImages.length
            ? await Promise.all(units.map((u) => tx.productUnit.create({ data: {
              tenantId,
              variantId: variantIds[u.variantIndex] as string,
              typeVariantId: typeVariantIds[u.variantIndex]?.[u.typeVariantIndex ?? 0] as string,
              categoryId: u.locationKey ? (locationIds.get(u.locationKey) as string) : rootId,
              code: u.code,
              name: u.name ?? null,
              status: u.status ?? 'AVAILABLE',
              isHook: u.isHook ?? false,
            } })))
            : [];
          if (unitImages.length) {
            await tx.productMedia.createMany({
              data: storedUnitImages.map((image) => ({
                tenantId, productId: product.id, unitId: createdUnits[image.unitIndex]?.id ?? null,
                mediaType: 'IMAGE' as const, fileName: image.file.originalname.slice(0, 255), fileUrl: image.url,
                fileType: image.file.mimetype, fileSize: image.file.buffer.length,
                sortOrder: 0, isPrimary: image === storedUnitImages.find((item) => item.unitIndex === image.unitIndex),
              })).filter((media) => Boolean(media.unitId)),
            });
          } else {
            await tx.productUnit.createMany({ data: units.map((u) => ({
              tenantId, variantId: variantIds[u.variantIndex] as string,
              typeVariantId: typeVariantIds[u.variantIndex]?.[u.typeVariantIndex ?? 0] as string,
              categoryId: u.locationKey ? (locationIds.get(u.locationKey) as string) : rootId,
              code: u.code, name: u.name ?? null, status: u.status ?? 'AVAILABLE', isHook: u.isHook ?? false,
            })) });
          }
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
        for (const [variantIndex, variant] of variants.entries()) {
          await this.saveTypeImages(
            tx,
            { tenantId, productId: product.id, variantId: variantIds[variantIndex] as string },
            variant,
            typeVariantIds[variantIndex] as string[],
            storedTypeImages.filter((image) => image.variantIndex === variantIndex),
            storedTypeVariantImages.filter((image) => image.variantIndex === variantIndex)
          );
        }
        return product;
      },
      { timeout: 30000 }
    ));
    } catch (error) {
      await this.storage.remove([...storedCovers, ...storedTypeImages, ...storedTypeVariantImages, ...(storedSiteplan ? [storedSiteplan] : []), ...storedUnitImages].map((image) => image.path));
      throw error;
    }
    return this.get(created.id, tenantId);
  }

  async update(id: string, tenantId: string, input: ProductInput, covers: Express.Multer.File[] = [], typeImages: ProjectTypeImage[] = [], siteplan?: Express.Multer.File, unitImages: ProjectUnitImage[] = [], typeVariantImages: ProjectTypeVariantImage[] = []) {
    const project = await this.get(id, tenantId);
    if (input.categoryId !== undefined && input.categoryId !== project.categoryId) {
      throw new Error('Conflict: a project root category cannot be changed through a regular update');
    }
    await this.assertProductRelations(tenantId, input);
    const structureProvided = [input.variants, input.locations, input.units].some((part) => part !== undefined);
    let structureInput = input;
    if (structureProvided && (!input.variants || !input.locations || !input.units)) {
      const current = await this.getEdit(id, tenantId);
      const variantIndex = new Map(current.variants.map((variant, index) => [variant.id, index]));
      const existingVariants = current.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        typeVariants: variant.typeVariants.map((option) => ({
          id: option.id,
          name: option.name,
          code: option.code,
          basePrice: Number(option.basePrice),
          currentPrice: Number(option.currentPrice),
          minPrice: option.minPrice === null ? null : Number(option.minPrice),
          stock: option.stock,
          isActive: option.isActive,
        })),
      }));
      const typeVariantIndexes = new Map(current.variants.flatMap((variant, index) =>
        variant.typeVariants.map((option, optionIndex) => [option.id, [index, optionIndex] as const])
      ));
      const existingLocations = current.locations.map((location) => ({
        id: location.id,
        key: location.id,
        parentKey: location.parentId === current.category.id ? null : location.parentId,
        name: location.name,
        code: location.code,
        type: location.type,
      }));
      const existingUnits = current.units.map((unit) => ({
        id: unit.id,
        code: unit.code,
        variantIndex: variantIndex.get(unit.variantId) ?? -1,
        typeVariantIndex: typeVariantIndexes.get(unit.typeVariantId)?.[1] ?? 0,
        ...(unit.categoryId === current.category.id ? {} : { locationKey: unit.categoryId }),
      }));
      structureInput = {
        ...input,
        variants: input.variants ?? existingVariants,
        locations: input.locations ?? existingLocations,
        units: input.units ?? existingUnits,
      };
    }
    if (unitImages.some((image) => image.unitIndex < 0 || image.unitIndex >= (structureInput.units?.length ?? 0))) throw new Error('Invalid unit image indexes');
    if (structureProvided && (project.category.type !== 'PROJECT' || input.categoryId !== undefined)) {
      throw new Error('Invalid project category for wizard update');
    }
    if (typeImages.length && !structureProvided) throw new Error('Invalid type image indexes');
    if (typeVariantImages.length && !structureProvided) throw new Error('Invalid type variant image indexes');
    this.assertTypeImages(structureInput.variants ?? [], typeImages, typeVariantImages);
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
      // Fasilitas nonaktif hanya boleh dipertahankan bila sudah terpasang di proyek ini.
      const count = await this.prisma.attribute.count({
        where: {
          tenantId,
          id: { in: facilityIds },
          source: 'PROJECT',
          OR: [{ isActive: true }, { values: { some: { tenantId, productId: id } } }],
        },
      });
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
    // Proyek lama yang terlanjur lebih tetap dapat disimpan selama tidak menambah foto.
    if (covers.length) assertCoverCount(projectImages.length - removedMedia.length + covers.length);
    const extensions = covers.map(validateProductImage);
    [...typeImages, ...typeVariantImages].forEach((image) => validateProductImage(image.file));
    const siteplanExtension = siteplan ? validateProductImage(siteplan) : undefined;
    const storedCovers: { file: Express.Multer.File; path: string; url: string }[] = [];
    const storedTypeImages: (ProjectTypeImage & StoredImage)[] = [];
    const storedTypeVariantImages: (ProjectTypeVariantImage & StoredImage)[] = [];
    let storedSiteplan: { file: Express.Multer.File; path: string; url: string } | undefined;
    const storedUnitImages: { file: Express.Multer.File; unitIndex: number; path: string; url: string }[] = [];
    let removedTypeUrls: string[] = [];
    try {
      for (const [index, file] of covers.entries()) {
        const path = `${tenantId}/product/${id}/${randomUUID()}.${extensions[index]}`;
        storedCovers.push({ file, path, url: this.storage.getPublicUrl(path).publicUrl });
        await this.storage.upload(path, file.buffer);
      }
      await this.storeImages(tenantId, id, typeImages, storedTypeImages);
      await this.storeImages(tenantId, id, typeVariantImages, storedTypeVariantImages);
      if (siteplan && siteplanExtension) {
        const path = `${tenantId}/product/${id}/siteplan-${randomUUID()}.${siteplanExtension}`;
        storedSiteplan = { file: siteplan, path, url: this.storage.getPublicUrl(path).publicUrl };
        await this.storage.upload(path, siteplan.buffer);
      }
      for (const image of unitImages) {
        const extension = validateProductImage(image.file);
        const path = `${tenantId}/product/${id}/unit-${image.unitIndex}-${randomUUID()}.${extension}`;
        storedUnitImages.push({ ...image, path, url: this.storage.getPublicUrl(path).publicUrl });
        await this.storage.upload(path, image.file.buffer);
      }
      await retryUniqueCode(() => this.prisma.$transaction(async (tx) => {
      if (input.code !== undefined) {
        data.code = input.code.trim();
        await assertProjectCode(tx, tenantId, data.code, { productId: id, categoryId: project.categoryId });
      }
      await tx.product.update({ where: { id }, data });
      if (storedSiteplan) {
        await tx.productCategory.update({ where: { id: project.categoryId }, data: { siteplanImg: storedSiteplan.url } });
      }
      if (input.name !== undefined || input.code !== undefined || input.isActive !== undefined) {
        await tx.productCategory.update({
          where: { id: project.categoryId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.code !== undefined ? { code: data.code as string } : {}),
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
      removedTypeUrls = [];
      let unitIds: string[] = [];
      if (structureProvided) {
        const synced = await this.syncStructure(tx, id, tenantId, project.categoryId, structureInput);
        unitIds = synced.unitIds;
        removedTypeUrls.push(...synced.removedUrls);
        for (const [variantIndex, variant] of (structureInput.variants ?? []).entries()) {
          removedTypeUrls.push(...await this.saveTypeImages(
            tx,
            { tenantId, productId: id, variantId: synced.variantIds[variantIndex] as string },
            variant,
            synced.typeVariantIds[variantIndex] as string[],
            storedTypeImages.filter((image) => image.variantIndex === variantIndex),
            storedTypeVariantImages.filter((image) => image.variantIndex === variantIndex)
          ));
        }
      }
      if (storedUnitImages.length && structureInput.units) {
        await tx.productMedia.createMany({
          data: storedUnitImages.map((image) => ({
            tenantId, productId: id, unitId: unitIds[image.unitIndex] ?? null,
            mediaType: 'IMAGE' as const, fileName: image.file.originalname.slice(0, 255), fileUrl: image.url,
            fileType: image.file.mimetype, fileSize: image.file.buffer.length, sortOrder: 0, isPrimary: false,
          })).filter((media) => Boolean(media.unitId)),
        });
      }
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
      }, { timeout: 30000 }));
    } catch (error) {
      await this.storage.remove([...storedCovers, ...storedTypeImages, ...storedTypeVariantImages, ...(storedSiteplan ? [storedSiteplan] : []), ...storedUnitImages].map((image) => image.path));
      throw error;
    }
    await this.removeStoredUrls([...removedMedia.map((media) => media.fileUrl), ...removedTypeUrls]);
    if (storedSiteplan && project.category.siteplanImg) {
      try {
        await this.storage.remove([this.storage.getFilePathFromPublicUrl(project.category.siteplanImg)]);
      } catch {
        // Existing siteplan may be managed by an external storage provider.
      }
    }
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
    assertUniqueSpecifications(variants);
    const normalizedVariants = variants.map((variant) => this.typeVariantsOf(variant));
    assertUnits(units, normalizedVariants.map((items) => items.length), new Set(locations.map((location) => location.key)));

    const oldVariants = await tx.productVariant.findMany({
      where: { tenantId, productId },
      select: { id: true, typeVariants: { select: { id: true, name: true, code: true, basePrice: true, currentPrice: true, minPrice: true, stock: true, isActive: true } } },
    });
    const oldVariantIds = new Set(oldVariants.map((row) => row.id));
    const allCategories = await tx.productCategory.findMany({
      where: { tenantId }, select: { id: true, parentId: true, code: true, name: true },
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
      select: { id: true, variantId: true, typeVariantId: true, categoryId: true, status: true, code: true },
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
    assertUnitsWithinStock(units, variants.map((variant, index) => ({
      name: variant.name,
      typeVariants: normalizedVariants[index]!.map((option) => ({ name: option.name, stock: option.stock ?? 0 })),
    })));

    // Foto unit, tipe, dan varian yang dihapus ikut terhapus; berkasnya dibersihkan setelah transaksi berhasil.
    const removedUrls: string[] = [];
    const collectUrls = async (where: Prisma.ProductMediaWhereInput) => {
      const media = await tx.productMedia.findMany({
        where: { tenantId, productId, mediaType: { not: 'VIDEO_LINK' }, ...where }, select: { fileUrl: true },
      });
      removedUrls.push(...media.map((item) => item.fileUrl));
    };
    const removedUnits = oldUnits.filter((row) => !keptUnitIds.has(row.id));
    if (removedUnits.length) {
      const ids = removedUnits.map((row) => row.id);
      if (removedUnits.some((row) => row.status !== 'AVAILABLE') ||
        await tx.reservation.count({ where: { tenantId, unitId: { in: ids } } }) ||
        await tx.unitPriceAdjustment.count({ where: { tenantId, unitId: { in: ids } } }) ||
        await tx.deal.count({ where: { tenantId, unitId: { in: ids } } })) {
        throw new Error('Conflict: units with reservations, deals, pricing history or non-available status must remain');
      }
      await collectUrls({ unitId: { in: ids } });
      await tx.productUnit.deleteMany({ where: { tenantId, id: { in: ids } } });
    }

    const parentIdOf = (location: LocationInput) => {
      if (!location.parentKey) return rootId;
      return locations.find((item) => item.key === location.parentKey)?.id;
    };
    assertLocationNames(locations, (location) => {
      const old = oldLocations.find((row) => row.id === location.id);
      return !old || old.name !== location.name || old.parentId !== parentIdOf(location);
    });
    assertUnitsOnLeaves(units, locations, {
      location: (location) => {
        const old = oldLocations.find((row) => row.id === location.id);
        return !old || old.parentId !== parentIdOf(location);
      },
      unit: (unit) => {
        const old = oldUnits.find((row) => row.id === unit.id);
        return !old || old.categoryId !== locations.find((item) => item.key === unit.locationKey)?.id;
      },
    });

    const masterOf = specificationMasters(tx, tenantId);
    const variantIds: string[] = [];
    const typeVariantIds: string[][] = [];
    const unitIds: string[] = [];
    for (const [variantIndex, variant] of variants.entries()) {
      const old = oldVariants.find((row) => row.id === variant.id);
      const row = old
        ? await tx.productVariant.update({
            where: { id: old.id },
            data: { name: variant.name as string },
          })
        : await tx.productVariant.create({
            data: { tenantId, productId, name: variant.name as string },
          });
      variantIds.push(row.id);
      const oldOptions = old?.typeVariants ?? [];
      const incomingOptions = normalizedVariants[variantIndex]!;
      const knownOptionIds = new Set(oldOptions.map((option) => option.id));
      const incomingOptionIds = incomingOptions.flatMap((option) => option.id ? [option.id] : []);
      if (new Set(incomingOptionIds).size !== incomingOptionIds.length || incomingOptionIds.some((optionId) => !knownOptionIds.has(optionId))) {
        throw new Error('Invalid type variant IDs');
      }
      // Varian yang dihapus lebih dulu, agar namanya dapat dipakai varian baru.
      const removedOptions = oldOptions.filter((option) => !incomingOptionIds.includes(option.id));
      for (const option of removedOptions) {
        if (await tx.productUnit.count({ where: { tenantId, typeVariantId: option.id } }) ||
          await tx.productVariantPriceLog.count({ where: { tenantId, typeVariantId: option.id } })) {
          throw new Error('Conflict: a variant with units or pricing history must remain');
        }
        await collectUrls({ typeVariantId: option.id });
        await tx.productTypeVariant.delete({ where: { id: option.id } });
      }
      for (const optionId of swappedNames(oldOptions, incomingOptions)) {
        await tx.productTypeVariant.update({ where: { id: optionId }, data: { name: optionId } });
      }
      const optionIds: string[] = [];
      for (const option of incomingOptions) {
        const oldOption = oldOptions.find((item) => item.id === option.id);
        const optionRow = oldOption
          ? await tx.productTypeVariant.update({
              where: { id: oldOption.id },
              data: {
                name: option.name as string,
                code: option.code?.trim() || null,
                basePrice: option.basePrice ?? Number(oldOption.basePrice),
                currentPrice: oldOption.currentPrice === oldOption.basePrice
                  ? option.basePrice ?? Number(oldOption.currentPrice)
                  : option.currentPrice ?? Number(oldOption.currentPrice),
                minPrice: option.minPrice === undefined ? oldOption.minPrice : option.minPrice,
                stock: option.stock ?? oldOption.stock,
                isActive: option.isActive ?? oldOption.isActive,
              },
            })
          : await tx.productTypeVariant.create({
              data: {
                tenantId,
                productVariantId: row.id,
                name: option.name as string,
                code: option.code?.trim() || null,
                basePrice: option.basePrice ?? 0,
                currentPrice: option.currentPrice ?? option.basePrice ?? 0,
                minPrice: option.minPrice ?? null,
                stock: option.stock ?? 0,
                isActive: option.isActive ?? true,
              },
            });
        optionIds.push(optionRow.id);
        await saveSpecifications(
          tx,
          { tenantId, productId, variantId: row.id, typeVariantId: optionRow.id },
          option.attributes,
          masterOf
        );
      }
      typeVariantIds.push(optionIds);
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
              code: await uniqueCode(location.code ?? `${(input.code ?? '').slice(0, 75)}-${randomUUID().slice(0, 8)}-${index}`, 100, async (candidate) =>
                Boolean(await tx.productCategory.findFirst({ where: { tenantId, code: candidate }, select: { id: true } }))
              ) },
          });
      locationIds.set(location.key, row.id);
    }

    for (const unit of units) {
      const variantId = variantIds[unit.variantIndex] as string;
      const typeVariantId = typeVariantIds[unit.variantIndex]?.[unit.typeVariantIndex ?? 0] as string;
      const categoryId = unit.locationKey ? locationIds.get(unit.locationKey) : rootId;
      if (!categoryId) throw new Error('Invalid unit location');
      const old = oldUnits.find((row) => row.id === unit.id);
      if (old) {
        unitIds.push(old.id);
        if (unit.status && unit.status !== old.status) {
          throw new Error(`Conflict: the status of unit ${old.code} can only change through a reservation. Reload the project.`);
        }
        if ((old.variantId !== variantId || old.typeVariantId !== typeVariantId || old.categoryId !== categoryId) &&
          (await tx.reservation.count({ where: { tenantId, unitId: old.id } }) ||
            await tx.deal.count({ where: { tenantId, unitId: old.id } }))) {
          throw new Error(`Conflict: unit ${old.code} with reservations or deals must keep its type and location`);
        }
        if (old.code !== unit.code || old.variantId !== variantId || old.typeVariantId !== typeVariantId || old.categoryId !== categoryId) {
          await tx.productUnit.update({
            where: { id: old.id }, data: { code: unit.code, variantId, typeVariantId, categoryId },
          });
        }
      } else {
        const created = await tx.productUnit.create({
          data: { tenantId, code: unit.code, variantId, typeVariantId, categoryId,
            status: 'AVAILABLE' },
        });
        unitIds.push(created.id);
      }
    }

    const removedVariants = oldVariants.filter((row) => !keptVariantIds.has(row.id));
    for (const row of removedVariants) {
      await assertTypeRemovable(tx, tenantId, row.id);
      await collectUrls({ variantId: row.id });
      await tx.productVariant.delete({ where: { id: row.id } });
    }
    for (const row of oldLocations.reverse()) {
      if (keptLocationIds.has(row.id)) continue;
      if (await tx.productVariantPriceLog.count({ where: { tenantId, categoryId: row.id } })) {
        throw new Error('Conflict: a location with pricing history must remain');
      }
      await tx.productCategory.delete({ where: { id: row.id } });
    }
    return { variantIds, typeVariantIds, unitIds, removedUrls };
  }

  /** Deletes the product and returns the stored file URLs of its media for cleanup. */
  async remove(id: string, tenantId: string) {
    const product = await this.get(id, tenantId);
    const unitCount = await this.prisma.productUnit.count({ where: { tenantId, variant: { productId: id, tenantId } } });
    if (unitCount > 0) throw new Error('Project has units (conflict). Deactivate it instead.');
    if (await this.prisma.lead.count({ where: { tenantId, projectId: id } }) ||
      await this.prisma.leadInterest.count({ where: { tenantId, productId: id } })) {
      throw new Error('Conflict: a project used by leads must remain. Deactivate it instead.');
    }
    const fileUrls = product.media.filter((m) => m.mediaType !== 'VIDEO_LINK').map((m) => m.fileUrl);
    await this.prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id } });
      fileUrls.push(...await this.removeLocationTree(tx, tenantId, product.categoryId));
    });
    return fileUrls;
  }

  /**
   * Removes the location tree left behind by a deleted project; returns its siteplan URLs.
   * The tree stays when any of its locations is still used by another product or unit.
   */
  private async removeLocationTree(tx: Prisma.TransactionClient, tenantId: string, rootId: string): Promise<string[]> {
    const categories = await tx.productCategory.findMany({
      where: { tenantId }, select: { id: true, parentId: true, type: true, siteplanImg: true },
    });
    const root = categories.find((category) => category.id === rootId);
    if (root?.type !== 'PROJECT') return [];
    const tree = [root];
    for (let index = 0; index < tree.length; index += 1) {
      tree.push(...categories.filter((category) => category.parentId === tree[index]!.id && !tree.includes(category)));
    }
    const ids = tree.map((category) => category.id);
    const where = { tenantId, categoryId: { in: ids } };
    if (await tx.product.count({ where }) || await tx.productUnit.count({ where }) || await tx.productVariantPriceLog.count({ where })) {
      return [];
    }
    for (const id of ids.reverse()) await tx.productCategory.delete({ where: { id } });
    return tree.flatMap((category) => (category.siteplanImg ? [category.siteplanImg] : []));
  }

  // ---------- variants ----------

  private async assertVariant(productId: string, variantId: string, tenantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, tenantId },
    });
    if (!variant) throw new Error('Variant not found');
    return variant;
  }

  /** Stores the photos of one type, runs the write, and cleans up files of the losing side. */
  private async withTypeImages<T>(
    tenantId: string,
    productId: string,
    input: VariantInput,
    images: TypeImageUploads,
    write: (stored: { type: StoredImage[]; variants: (StoredImage & { typeVariantIndex: number })[] }, removedUrls: string[]) => Promise<T>
  ): Promise<T> {
    const type: (StoredImage & { file: Express.Multer.File })[] = [];
    const variants: (StoredImage & { typeVariantIndex: number })[] = [];
    const removedUrls: string[] = [];
    this.assertTypeImages([input], [], images.variants.map((image) => ({ ...image, variantIndex: 0 })));
    [...images.type, ...images.variants.map((image) => image.file)].forEach(validateProductImage);
    let result: T;
    try {
      await this.storeImages(tenantId, productId, images.type.map((file) => ({ file })), type);
      await this.storeImages(tenantId, productId, images.variants, variants);
      result = await write({ type, variants }, removedUrls);
    } catch (error) {
      await this.storage.remove([...type, ...variants].map((image) => image.path));
      throw error;
    }
    await this.removeStoredUrls(removedUrls);
    return result;
  }

  async addVariant(productId: string, tenantId: string, input: VariantInput, images: TypeImageUploads = NO_IMAGES) {
    await this.get(productId, tenantId);
    assertUniqueSpecifications([input]);
    return this.withTypeImages(tenantId, productId, input, images, (stored) => this.prisma.$transaction(async (tx) => {
      const masterOf = specificationMasters(tx, tenantId);
      const type = await tx.productVariant.create({ data: { tenantId, productId, name: input.name as string } });
      const options = this.typeVariantsOf(input);
      const typeVariants = [];
      for (const option of options) {
        typeVariants.push(await tx.productTypeVariant.create({ data: {
          tenantId, productVariantId: type.id, name: option.name as string,
          code: option.code?.trim() || null, basePrice: option.basePrice ?? 0,
          currentPrice: option.currentPrice ?? option.basePrice ?? 0,
          minPrice: option.minPrice ?? null, stock: option.stock ?? 0, isActive: option.isActive ?? true,
        } }));
        await saveSpecifications(
          tx,
          { tenantId, productId, variantId: type.id, typeVariantId: typeVariants[typeVariants.length - 1]!.id },
          option.attributes,
          masterOf
        );
      }
      await this.saveTypeImages(
        tx, { tenantId, productId, variantId: type.id }, input, typeVariants.map((option) => option.id), stored.type, stored.variants
      );
      return { ...type, typeVariants };
    }, { timeout: 30000 }));
  }

  async updateVariant(productId: string, variantId: string, tenantId: string, input: VariantInput, images: TypeImageUploads = NO_IMAGES) {
    await this.assertVariant(productId, variantId, tenantId);
    assertUniqueSpecifications([input]);
    return this.withTypeImages(tenantId, productId, input, images, (stored, removedUrls) => this.prisma.$transaction(async (tx) => {
      const masterOf = specificationMasters(tx, tenantId);
      const type = await tx.productVariant.update({ where: { id: variantId }, data: input.name === undefined ? {} : { name: input.name } });
      const current = await tx.productTypeVariant.findMany({ where: { tenantId, productVariantId: variantId }, orderBy: { createdAt: 'asc' } });
      if (!current.length) throw new Error('Type variant not found');
      const requested: TypeVariantInput[] = input.typeVariants?.length ? input.typeVariants : [{
        id: current[0]!.id, name: current[0]!.name, code: current[0]!.code,
        basePrice: input.basePrice ?? Number(current[0]!.basePrice),
        currentPrice: input.currentPrice ?? Number(current[0]!.currentPrice),
        minPrice: input.minPrice === undefined ? current[0]!.minPrice === null ? null : Number(current[0]!.minPrice) : input.minPrice,
        stock: input.stock ?? current[0]!.stock, isActive: current[0]!.isActive,
      }];
      const known = new Set(current.map((item) => item.id));
      const requestedIds = requested.flatMap((item) => item.id ? [item.id] : []);
      if (new Set(requestedIds).size !== requestedIds.length || requestedIds.some((id) => !known.has(id))) throw new Error('Invalid type variant IDs');
      // Varian yang dihapus lebih dulu, agar namanya dapat dipakai varian baru.
      for (const option of current.filter((item) => !requestedIds.includes(item.id))) {
        if (await tx.productUnit.count({ where: { tenantId, typeVariantId: option.id } }) ||
          await tx.productVariantPriceLog.count({ where: { tenantId, typeVariantId: option.id } })) {
          throw new Error('Conflict: a variant with units or pricing history must remain');
        }
        const media = await tx.productMedia.findMany({ where: { tenantId, typeVariantId: option.id }, select: { fileUrl: true } });
        removedUrls.push(...media.map((item) => item.fileUrl));
        await tx.productTypeVariant.delete({ where: { id: option.id } });
      }
      for (const optionId of swappedNames(current, requested)) {
        await tx.productTypeVariant.update({ where: { id: optionId }, data: { name: optionId } });
      }
      const typeVariants = [];
      for (const option of requested) {
        const existing = current.find((item) => item.id === option.id);
        if (existing) {
          const unitCount = await tx.productUnit.count({ where: { typeVariantId: existing.id, tenantId } });
          if ((option.stock ?? existing.stock) < unitCount) throw new Error(`Invalid stock: ${option.name} must be at least ${unitCount}.`);
          typeVariants.push(await tx.productTypeVariant.update({ where: { id: existing.id }, data: {
            name: option.name as string, code: option.code?.trim() || null,
            basePrice: option.basePrice ?? existing.basePrice,
            currentPrice: option.currentPrice ?? option.basePrice ?? existing.currentPrice,
            minPrice: option.minPrice === undefined ? existing.minPrice : option.minPrice,
            stock: option.stock ?? existing.stock, isActive: option.isActive ?? existing.isActive,
          } }));
        } else {
          typeVariants.push(await tx.productTypeVariant.create({ data: {
            tenantId, productVariantId: variantId, name: option.name as string, code: option.code?.trim() || null,
            basePrice: option.basePrice ?? 0, currentPrice: option.currentPrice ?? option.basePrice ?? 0,
            minPrice: option.minPrice ?? null, stock: option.stock ?? 0, isActive: option.isActive ?? true,
          } }));
        }
        await saveSpecifications(
          tx,
          { tenantId, productId, variantId, typeVariantId: typeVariants[typeVariants.length - 1]!.id },
          option.attributes,
          masterOf
        );
      }
      removedUrls.push(...await this.saveTypeImages(
        tx, { tenantId, productId, variantId }, input, typeVariants.map((option) => option.id), stored.type, stored.variants
      ));
      return { ...type, typeVariants };
    }, { timeout: 30000 }));
  }

  async removeVariant(productId: string, variantId: string, tenantId: string) {
    await this.assertVariant(productId, variantId, tenantId);
    const count = await this.prisma.productVariant.count({ where: { productId, tenantId } });
    if (count <= 1) throw new Error('A product must keep at least one variant (conflict)');
    const urls = await this.prisma.$transaction(async (tx) => {
      await assertTypeRemovable(tx, tenantId, variantId);
      const media = await tx.productMedia.findMany({
        where: { tenantId, variantId, mediaType: { not: 'VIDEO_LINK' } }, select: { fileUrl: true },
      });
      await tx.productVariant.delete({ where: { id: variantId } });
      return media.map((item) => item.fileUrl);
    });
    await this.removeStoredUrls(urls);
  }

  // ---------- attributes (values; the definitions live in AttributeUseCase) ----------

  async addAttribute(productId: string, tenantId: string, input: AttributeInput) {
    await this.get(productId, tenantId);
    const typeVariant = input.typeVariantId
      ? await this.prisma.productTypeVariant.findFirst({
          where: { id: input.typeVariantId, tenantId, productVariant: { productId, tenantId } },
          select: { id: true, productVariantId: true },
        })
      : null;
    if (input.typeVariantId && !typeVariant) throw new Error('Type variant not found');
    const master = await this.prisma.attribute.findFirst({
      where: { id: input.attributeId as string, tenantId },
      select: { id: true, source: true, isActive: true },
    });
    if (!master) throw new Error('Attribute not found');
    if (master.source !== (typeVariant ? 'UNIT_TYPE' : 'PROJECT')) {
      throw new Error('Invalid attribute source for this level');
    }
    if (master.source === 'PROJECT' && !master.isActive) throw new Error('Invalid facility: it is inactive');
    const typeVariantId = typeVariant?.id ?? null;
    const existing = await this.prisma.productAttribute.findFirst({
      where: { tenantId, productId, typeVariantId, attributeId: master.id, ...(typeVariantId ? {} : { variantId: null }) },
      select: { id: true },
    });
    if (existing) throw new Error('A value for this attribute already exists at this level');
    return withNumber(await this.prisma.productAttribute.create({
      data: {
        tenantId,
        productId,
        variantId: typeVariant?.productVariantId ?? null,
        typeVariantId,
        attributeId: master.id,
        value: specValue(input.value),
      },
      include: { attribute: true },
    }));
  }

  /** Only the value can change; a value cannot move to another variant. */
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
    if (input.typeVariantId !== undefined && input.typeVariantId !== current.typeVariantId) {
      throw new Error('Invalid typeVariantId: an attribute value cannot move to another variant');
    }
    return withNumber(await this.prisma.productAttribute.update({
      where: { id: productAttributeId },
      data: { value: input.value === undefined ? current.value : specValue(input.value) },
      include: { attribute: true },
    }));
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
