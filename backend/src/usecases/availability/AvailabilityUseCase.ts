import type { Prisma, PrismaClient, ProductCategoryType, ProductUnitStatus } from '@prisma/client';
import { expireOverdueReservations } from '../reservation/reservationStatus.js';
import {
  availabilityIntegrity,
  buildSafeAvailabilityHierarchy,
  type AvailabilityCategory,
} from './availabilityHierarchy.js';

const unitInclude = (tenantId: string) =>
  ({
    category: { select: { id: true, parentId: true, name: true, type: true } },
    variant: {
      select: {
        id: true,
        name: true,
      },
    },
    typeVariant: {
      select: {
        id: true,
        name: true,
        basePrice: true,
        currentPrice: true,
        attributes: {
          where: { tenantId, attribute: { tenantId } },
          include: { attribute: { select: { code: true, name: true, unit: true } } },
        },
      },
    },
    media: {
      where: { tenantId, mediaType: 'IMAGE' as const },
      orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
      select: { fileUrl: true, isPrimary: true, sortOrder: true },
    },
    reservations: {
      where: { tenantId, status: { in: ['ACTIVE', 'PAYMENT_PENDING', 'COMPLETED'] } },
      orderBy: { reservedAt: 'desc' },
      take: 1,
      select: { status: true, customerName: true },
    },
  }) satisfies Prisma.ProductUnitInclude;

type AvailabilityUnit = Prisma.ProductUnitGetPayload<{ include: ReturnType<typeof unitInclude> }>;
type Summary = {
  total: number;
  available: number;
  processing: number;
  reserved: number;
  sold: number;
  blocked: number;
};

const emptySummary = (): Summary => ({
  total: 0,
  available: 0,
  processing: 0,
  reserved: 0,
  sold: 0,
  blocked: 0,
});

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function byCodeOrLegacyId<T extends { id: string; code: string }>(
  rows: Iterable<T>,
  reference: string
) {
  const items = [...rows];
  const code = reference.toLowerCase();
  return (
    items.find((item) => item.code.toLowerCase() === code) ??
    (isUuid(reference) ? items.find((item) => item.id === reference) : undefined)
  );
}

function statusKey(status: ProductUnitStatus): keyof Omit<Summary, 'total'> {
  switch (status) {
    case 'AVAILABLE':
      return 'available';
    case 'BOOKED':
      return 'processing';
    case 'RESERVED':
      return 'reserved';
    case 'SOLD':
      return 'sold';
    case 'BLOCKED':
      return 'blocked';
  }
}

function unitStatusKey(unit: Pick<AvailabilityUnit, 'status' | 'reservations'>) {
  if (unit.status === 'RESERVED' && unit.reservations[0]?.status === 'PAYMENT_PENDING') {
    return 'processing';
  }
  return statusKey(unit.status);
}

function summarize(units: readonly Pick<AvailabilityUnit, 'status' | 'reservations'>[]): Summary {
  const summary = emptySummary();
  for (const unit of units) {
    summary.total += 1;
    summary[unitStatusKey(unit)] += 1;
  }
  return summary;
}

function locationOf(product: {
  address: string | null;
  village: string | null;
  subdistrict: string | null;
  city: string | null;
  province: string | null;
}) {
  return [product.address, product.village, product.subdistrict, product.city, product.province]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(', ');
}

function priceOf(unit: AvailabilityUnit) {
  const legacyVariant = unit.variant as typeof unit.variant & { currentPrice?: bigint };
  return Number(unit.typeVariant?.currentPrice ?? legacyVariant.currentPrice ?? 0);
}

function ancestorsOf(categoryId: string, categories: Map<string, AvailabilityCategory>) {
  const ancestors: AvailabilityCategory[] = [];
  const visited = new Set<string>();
  let current = categories.get(categoryId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    ancestors.push(current);
    current = current.parentId ? categories.get(current.parentId) : undefined;
  }
  return ancestors;
}

function nearestCategory(
  categoryId: string,
  type: ProductCategoryType,
  categories: Map<string, AvailabilityCategory>
) {
  return ancestorsOf(categoryId, categories).find((category) => category.type === type);
}

function childCategories(parentId: string, categories: Map<string, AvailabilityCategory>) {
  return [...categories.values()].filter((category) => category.parentId === parentId);
}

function descendantCategoryIds(categoryId: string, categories: Map<string, AvailabilityCategory>) {
  const ids = new Set<string>([categoryId]);
  const queue = [categoryId];
  while (queue.length > 0) {
    const parentId = queue.shift() as string;
    for (const child of childCategories(parentId, categories)) {
      if (ids.has(child.id)) continue;
      ids.add(child.id);
      queue.push(child.id);
    }
  }
  return ids;
}

function unitsInCategoryTree(
  units: AvailabilityUnit[],
  categoryId: string,
  categories: Map<string, AvailabilityCategory>
) {
  const ids = descendantCategoryIds(categoryId, categories);
  return units.filter((unit) => ids.has(unit.categoryId));
}

function displayStatus(status: ProductUnitStatus) {
  if (status === 'BOOKED') return 'Processing';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export class AvailabilityUseCase {
  constructor(private prisma: PrismaClient) {}

  async overview(tenantId: string, projectId?: string) {
    await expireOverdueReservations(this.prisma, tenantId);
    const products = await this.prisma.product.findMany({
      where: { tenantId, ...(projectId ? { id: projectId } : {}) },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        categoryId: true,
        name: true,
        address: true,
        village: true,
        subdistrict: true,
        city: true,
        province: true,
        variants: {
          select: {
            id: true,
            typeVariants: { select: { stock: true } },
          },
        },
        media: {
          where: { tenantId, mediaType: 'IMAGE', variantId: null, unitId: null },
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
          select: { fileUrl: true },
        },
      },
    });

    const productByVariant = new Map<string, string>();
    for (const product of products) {
      for (const variant of product.variants) productByVariant.set(variant.id, product.id);
    }
    const categoryRows = products.length
      ? await this.prisma.productCategory.findMany({
          where: { tenantId },
          select: { id: true, code: true, parentId: true, name: true, type: true },
        })
      : [];
    const hierarchyByProduct = new Map(
      products.map((product) => [
        product.id,
        buildSafeAvailabilityHierarchy(product.categoryId, categoryRows),
      ])
    );
    const ignoredUnitsByProduct = new Map(products.map((product) => [product.id, 0]));
    const counts = new Map(products.map((product) => [product.id, emptySummary()]));
    const variantIds = [...productByVariant.keys()];
    if (variantIds.length > 0) {
      const rows = await this.prisma.productUnit.groupBy({
        by: ['variantId', 'categoryId', 'status'],
        where: { tenantId, variantId: { in: variantIds } },
        _count: { _all: true },
      });
      for (const row of rows) {
        const productId = productByVariant.get(row.variantId) as string;
        const summary = counts.get(productId);
        if (!summary) continue;
        const count = row._count._all;
        if (!hierarchyByProduct.get(productId)?.categories.has(row.categoryId)) {
          ignoredUnitsByProduct.set(productId, (ignoredUnitsByProduct.get(productId) ?? 0) + count);
          continue;
        }
        summary.total += count;
        summary[statusKey(row.status)] += count;
      }

      const paymentPendingUnits = await this.prisma.productUnit.groupBy({
        by: ['variantId', 'categoryId'],
        where: {
          tenantId,
          variantId: { in: variantIds },
          status: 'RESERVED',
          reservations: { some: { tenantId, status: 'PAYMENT_PENDING' } },
        },
        _count: { _all: true },
      });
      for (const row of paymentPendingUnits) {
        const productId = productByVariant.get(row.variantId) as string;
        const summary = counts.get(productId);
        if (!summary) continue;
        if (!hierarchyByProduct.get(productId)?.categories.has(row.categoryId)) continue;
        summary.reserved -= row._count._all;
        summary.processing += row._count._all;
      }
    }

    const summary = emptySummary();
    const projectRows = products.map((product) => {
      const projectSummary = counts.get(product.id) ?? emptySummary();
      for (const key of Object.keys(summary) as (keyof Summary)[]) {
        summary[key] += projectSummary[key];
      }
      return {
        id: product.id,
        code: product.code,
        name: product.name,
        location: locationOf(product),
        image: product.media[0]?.fileUrl ?? null,
        ...projectSummary,
        total: projectSummary.total,
        integrity: availabilityIntegrity(
          ignoredUnitsByProduct.get(product.id) ?? 0,
          hierarchyByProduct.get(product.id)?.skippedCycleEdges ?? 0
        ),
      };
    });

    return { summary, projects: projectRows };
  }

  private async loadProject(tenantId: string, projectReference: string) {
    await expireOverdueReservations(this.prisma, tenantId);
    const projectSelect = {
      id: true,
      code: true,
      categoryId: true,
      name: true,
      address: true,
      village: true,
      subdistrict: true,
      city: true,
      province: true,
      variants: {
        select: { typeVariants: { select: { stock: true } } },
      },
      media: {
        where: { tenantId, mediaType: 'IMAGE' as const, variantId: null, unitId: null },
        orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
        take: 1,
        select: { fileUrl: true },
      },
    } satisfies Prisma.ProductSelect;
    const product =
      (await this.prisma.product.findUnique({
        where: { tenantId_code: { tenantId, code: projectReference } },
        select: projectSelect,
      })) ??
      (isUuid(projectReference)
        ? await this.prisma.product.findFirst({
            where: { id: projectReference, tenantId },
            select: projectSelect,
          })
        : null);
    if (!product) return null;

    const categoryRows = await this.prisma.productCategory.findMany({
      where: { tenantId },
      select: { id: true, code: true, parentId: true, name: true, type: true },
    });
    const hierarchy = buildSafeAvailabilityHierarchy(product.categoryId, categoryRows);
    if (!hierarchy) return null;

    const projectUnits = await this.prisma.productUnit.findMany({
      where: { tenantId, variant: { productId: product.id, tenantId } },
      orderBy: { code: 'asc' },
      include: unitInclude(tenantId),
    });
    const units = projectUnits.filter((unit) => hierarchy.categories.has(unit.categoryId));
    const integrity = availabilityIntegrity(
      projectUnits.length - units.length,
      hierarchy.skippedCycleEdges
    );

    return { product, categories: hierarchy.categories, units, integrity };
  }

  async project(tenantId: string, projectId: string) {
    const data = await this.loadProject(tenantId, projectId);
    if (!data) return null;

    const location = locationOf(data.product);
    const summary = summarize(data.units);
    const root = data.categories.get(data.product.categoryId);
    const groups = root ? childCategories(root.id, data.categories) : [];
    const mapGroup = (group: AvailabilityCategory) => {
      const groupUnits = unitsInCategoryTree(data.units, group.id, data.categories);
      const unitSummary = summarize(groupUnits);
      return {
        id: group.id,
        code: group.code,
        name: group.name,
        level: group.type,
        units: unitSummary.total,
        children: childCategories(group.id, data.categories).length,
        blocks: childCategories(group.id, data.categories).length,
        available: unitSummary.available,
        processing: unitSummary.processing,
        reserved: unitSummary.reserved,
        sold: unitSummary.sold,
        blocked: unitSummary.blocked,
      };
    };
    const groupRows = groups.map(mapGroup);
    const hierarchyGroups = [...data.categories.values()]
      .filter((category) => category.id !== root?.id)
      .map(mapGroup);

    const directUnits = root
      ? this.mapUnits(
          data.units.filter((unit) => unit.categoryId === root.id),
          data.categories
        )
      : [];

    return {
      project: {
        id: data.product.id,
        code: data.product.code,
        name: data.product.name,
        location,
        image: data.product.media[0]?.fileUrl ?? null,
        totalUnits: summary.total,
        available: summary.available,
        processing: summary.processing,
        reserved: summary.reserved,
        sold: summary.sold,
        blocked: summary.blocked,
      },
      root: root
        ? { id: root.id, code: root.code, name: data.product.name, level: root.type }
        : null,
      hasCluster: [...data.categories.values()].some((category) => category.type === 'CLUSTER'),
      hierarchyLevel: groups[0]?.type ?? null,
      groups: groupRows,
      hierarchyGroups,
      // Alias sementara agar consumer lama tetap kompatibel selama route hierarchy dimigrasikan.
      clusters: groupRows,
      units: directUnits,
      integrity: data.integrity,
    };
  }

  private mapUnits(units: AvailabilityUnit[], categories: Map<string, AvailabilityCategory>) {
    return units.map((unit) => {
      const location = categories.get(unit.categoryId);
      const block = nearestCategory(unit.categoryId, 'BLOCK', categories);
      const status = unitStatusKey(unit);
      return {
        id: unit.id,
        code: unit.code,
        isHook: unit.isHook,
        type: unit.variant.name,
        variant: unit.typeVariant?.name ?? 'Default',
        price: priceOf(unit),
        basePrice: Number(unit.typeVariant?.basePrice ?? 0),
        location: location?.name ?? '—',
        locationLevel: location?.type ?? 'CATEGORY',
        locationPathIds: ancestorsOf(unit.categoryId, categories).map((category) => category.id),
        // Dipertahankan untuk kompatibilitas tampilan lama; hierarchy baru memakai location.
        block: block?.name ?? location?.name ?? '—',
        image: unit.media[0]?.fileUrl ?? null,
        status,
        customer:
          status === 'available' || status === 'blocked'
            ? null
            : (unit.reservations[0]?.customerName ?? null),
        discount: false,
      };
    });
  }

  async hierarchyNode(tenantId: string, projectReference: string, nodeReference: string) {
    const data = await this.loadProject(tenantId, projectReference);
    const node = data && byCodeOrLegacyId(data.categories.values(), nodeReference);
    if (!data || !node || !data.categories.has(node.id)) return null;

    const categoryUnits = unitsInCategoryTree(data.units, node.id, data.categories);
    const summary = summarize(categoryUnits);
    const children = childCategories(node.id, data.categories);
    const childRows = children.map((child) => {
      const childSummary = summarize(unitsInCategoryTree(data.units, child.id, data.categories));
      return {
        id: child.id,
        code: child.code,
        name: child.name,
        level: child.type,
        units: childSummary.total,
        children: childCategories(child.id, data.categories).length,
        blocks: childCategories(child.id, data.categories).length,
        available: childSummary.available,
        processing: childSummary.processing,
        reserved: childSummary.reserved,
        sold: childSummary.sold,
        blocked: childSummary.blocked,
      };
    });
    // Unit pada wizard proyek ditempelkan ke lokasi leaf (mis. block/floor),
    // bukan selalu langsung ke cluster. Summary di atas sudah menghitung
    // seluruh subtree, jadi tabel juga harus memakai unit dari seluruh subtree
    // agar angka dan daftar unit konsisten dengan hierarchy Step 4.
    const nodeUnits = unitsInCategoryTree(data.units, node.id, data.categories);
    const units = this.mapUnits(nodeUnits, data.categories);
    // Lokasi setingkat (mis. blok lain di cluster yang sama) untuk navigasi antar-lokasi.
    // Akar pohon proyek tidak ditampilkan sebagai induk.
    const parentNode =
      node.parentId && node.parentId !== data.product.categoryId ? data.categories.get(node.parentId) : undefined;
    const siblings = node.parentId
      ? childCategories(node.parentId, data.categories)
          .map((item) => ({ code: item.code, name: item.name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }))
      : [];
    const blocks = [
      ...new Set(
        categoryUnits
          .map((unit) => nearestCategory(unit.categoryId, 'BLOCK', data.categories)?.name)
          .filter((name): name is string => Boolean(name))
      ),
    ];

    return {
      project: {
        id: data.product.id,
        code: data.product.code,
        name: data.product.name,
        location: locationOf(data.product),
      },
      node: {
        id: node.id,
        code: node.code,
        name: node.id === data.product.categoryId ? data.product.name : node.name,
        level: node.type,
      },
      // Alias kompatibilitas untuk halaman availability lama.
      cluster: {
        id: node.id,
        code: node.code,
        name: node.id === data.product.categoryId ? data.product.name : node.name,
        level: node.type,
      },
      summary: {
        total: summary.total,
        available: summary.available,
        processing: summary.processing,
        reserved: summary.reserved,
        sold: summary.sold,
      },
      blocks,
      parent: parentNode ? { code: parentNode.code, name: parentNode.name } : null,
      siblings,
      children: childRows,
      units,
      integrity: data.integrity,
    };
  }

  /** Compatibility wrapper for existing cluster-named routes and screens. */
  async cluster(tenantId: string, projectReference: string, clusterReference: string) {
    return this.hierarchyNode(tenantId, projectReference, clusterReference);
  }

  async unit(
    tenantId: string,
    projectReference: string,
    clusterReference: string,
    unitReference: string
  ) {
    const data = await this.loadProject(tenantId, projectReference);
    const cluster = data && byCodeOrLegacyId(data.categories.values(), clusterReference);
    if (!data || !cluster || !data.categories.has(cluster.id)) return null;
    const unit = byCodeOrLegacyId(
      unitsInCategoryTree(data.units, cluster.id, data.categories),
      unitReference
    );
    if (!unit) return null;

    const block = nearestCategory(unit.categoryId, 'BLOCK', data.categories);
    // Spesifikasi mengikuti varian unit, bukan tipenya.
    const unitAttributes = unit.typeVariant?.attributes ?? [];
    const attributes = new Map(
      unitAttributes.map(({ attribute, value }) => [attribute.code, { attribute, value }])
    );
    const attributeLabel = (code: string) => {
      const item = attributes.get(code);
      if (!item) return null;
      const suffix = item.attribute.unit ? ` ${item.attribute.unit}` : '';
      return `${item.value}${suffix}`;
    };
    const price = priceOf(unit);
    const specifications = unitAttributes.map(({ attribute, value }) => ({
      key: attribute.code,
      label: `${attribute.name}: ${value}${attribute.unit ? ` ${attribute.unit}` : ''}`,
    }));

    return {
      id: unit.id,
      code: unit.code,
      projectId: data.product.id,
      projectCode: data.product.code,
      clusterCode: cluster.code,
      number: unit.name ?? unit.code,
      status: unitStatusKey(unit) === 'processing' ? 'Processing' : displayStatus(unit.status),
      project: data.product.name,
      cluster: cluster.name,
      location: cluster.name,
      locationLevel: cluster.type,
      block: block?.name ?? '—',
      type: unit.variant.name,
      variant: unit.typeVariant?.name ?? 'Default',
      buildingArea: attributeLabel('building_area') ?? '—',
      landArea: attributeLabel('surface_area') ?? '—',
      price,
      basePrice: Number(unit.typeVariant?.basePrice ?? 0),
      promo: 0,
      finalPrice: price,
      images: unit.media.map((media) => media.fileUrl),
      floorPlan: null,
      specifications,
    };
  }
}
