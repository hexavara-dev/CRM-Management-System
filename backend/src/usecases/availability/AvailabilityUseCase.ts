import type { Prisma, PrismaClient, ProductCategoryType, ProductUnitStatus } from '@prisma/client';
import { expireOverdueReservations } from '../reservation/reservationStatus.js';

const unitInclude = (tenantId: string) =>
  ({
  category: { select: { id: true, parentId: true, name: true, type: true } },
  variant: {
    select: {
      id: true,
      name: true,
      attributes: {
        where: { tenantId, attribute: { tenantId } },
        include: { attribute: { select: { code: true, name: true, unit: true } } },
      },
    },
  },
  typeVariant: { select: { id: true, name: true, basePrice: true, currentPrice: true } },
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
type AvailabilityCategory = {
  id: string;
  code: string;
  parentId: string | null;
  name: string;
  type: ProductCategoryType;
};

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

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function byCodeOrLegacyId<T extends { id: string; code: string }>(rows: Iterable<T>, reference: string) {
  const items = [...rows];
  const code = reference.toLowerCase();
  return items.find((item) => item.code.toLowerCase() === code) ??
    (isUuid(reference) ? items.find((item) => item.id === reference) : undefined);
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
  if (
    unit.status === 'RESERVED' &&
    unit.reservations[0]?.status === 'PAYMENT_PENDING'
  ) {
    return 'processing';
  }
  return statusKey(unit.status);
}

function summarize(
  units: readonly Pick<AvailabilityUnit, 'status' | 'reservations'>[]
): Summary {
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
  const source = unit.typeVariant ?? (unit.variant as typeof unit.variant & { currentPrice?: bigint });
  return Number(source.currentPrice ?? 0);
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

function childCategories(
  parentId: string,
  categories: Map<string, AvailabilityCategory>
) {
  return [...categories.values()].filter((category) => category.parentId === parentId);
}

function descendantCategoryIds(
  categoryId: string,
  categories: Map<string, AvailabilityCategory>
) {
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
        name: true,
        address: true,
        village: true,
        subdistrict: true,
        city: true,
        province: true,
        variants: { select: { id: true, typeVariants: { select: { stock: true } } } },
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
    const counts = new Map(products.map((product) => [product.id, emptySummary()]));
    const variantIds = [...productByVariant.keys()];
    if (variantIds.length > 0) {
      const rows = await this.prisma.productUnit.groupBy({
        by: ['variantId', 'status'],
        where: { tenantId, variantId: { in: variantIds } },
        _count: { _all: true },
      });
      for (const row of rows) {
        const summary = counts.get(productByVariant.get(row.variantId) as string);
        if (!summary) continue;
        const count = row._count._all;
        summary.total += count;
        summary[statusKey(row.status)] += count;
      }

      const paymentPendingUnits = await this.prisma.productUnit.groupBy({
        by: ['variantId'],
        where: {
          tenantId,
          variantId: { in: variantIds },
          status: 'RESERVED',
          reservations: { some: { tenantId, status: 'PAYMENT_PENDING' } },
        },
        _count: { _all: true },
      });
      for (const row of paymentPendingUnits) {
        const summary = counts.get(productByVariant.get(row.variantId) as string);
        if (!summary) continue;
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
      variants: { select: { typeVariants: { select: { stock: true } } } },
      media: {
        where: { tenantId, mediaType: 'IMAGE' as const, variantId: null, unitId: null },
        orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
        take: 1,
        select: { fileUrl: true },
      },
    } satisfies Prisma.ProductSelect;
    const product = await this.prisma.product.findUnique({
      where: { tenantId_code: { tenantId, code: projectReference } },
      select: projectSelect,
    }) ?? (isUuid(projectReference)
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
    const allCategories = new Map(categoryRows.map((category) => [category.id, category]));
    if (!allCategories.has(product.categoryId)) return null;

    const children = new Map<string, string[]>();
    for (const category of categoryRows) {
      if (!category.parentId) continue;
      const childIds = children.get(category.parentId) ?? [];
      childIds.push(category.id);
      children.set(category.parentId, childIds);
    }
    const categoryIds: string[] = [];
    const queue = [product.categoryId];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      if (categoryIds.includes(id)) continue;
      categoryIds.push(id);
      queue.push(...(children.get(id) ?? []));
    }
    const categories = new Map(
      categoryIds.flatMap((id) => {
        const category = allCategories.get(id);
        return category ? [[id, category] as const] : [];
      })
    );

    const units = await this.prisma.productUnit.findMany({
      where: { tenantId, variant: { productId: product.id, tenantId } },
      orderBy: { code: 'asc' },
      include: unitInclude(tenantId),
    });

    return { product, categories, units };
  }

  async project(tenantId: string, projectId: string) {
    const data = await this.loadProject(tenantId, projectId);
    if (!data) return null;

    const location = locationOf(data.product);
    const summary = summarize(data.units);
    const root = data.categories.get(data.product.categoryId);
    const groups = root ? childCategories(root.id, data.categories) : [];
    const groupRows = groups.map((group) => {
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
    });

    const directUnits = root
      ? this.mapUnits(data.units.filter((unit) => unit.categoryId === root.id), data.categories)
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
      root: root ? { id: root.id, code: root.code, name: data.product.name, level: root.type } : null,
      hasCluster: [...data.categories.values()].some((category) => category.type === 'CLUSTER'),
      hierarchyLevel: groups[0]?.type ?? null,
      groups: groupRows,
      // Alias sementara agar consumer lama tetap kompatibel selama route hierarchy dimigrasikan.
      clusters: groupRows,
      units: directUnits,
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

  async cluster(tenantId: string, projectReference: string, clusterReference: string) {
    const data = await this.loadProject(tenantId, projectReference);
    const cluster = data && byCodeOrLegacyId(data.categories.values(), clusterReference);
    if (!data || !cluster || !data.categories.has(cluster.id)) return null;

    const categoryUnits = unitsInCategoryTree(data.units, cluster.id, data.categories);
    const summary = summarize(categoryUnits);
    const children = childCategories(cluster.id, data.categories);
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
    const directUnits = data.units.filter((unit) => unit.categoryId === cluster.id);
    const units = this.mapUnits(directUnits, data.categories);
    const blocks = [...new Set(categoryUnits.map((unit) =>
      nearestCategory(unit.categoryId, 'BLOCK', data.categories)?.name
    ).filter((name): name is string => Boolean(name)))];

    return {
      project: { id: data.product.id, code: data.product.code, name: data.product.name, location: locationOf(data.product) },
      cluster: { id: cluster.id, code: cluster.code, name: cluster.id === data.product.categoryId ? data.product.name : cluster.name, level: cluster.type },
      summary: {
        total: summary.total,
        available: summary.available,
        processing: summary.processing,
        reserved: summary.reserved,
        sold: summary.sold,
      },
      blocks,
      children: childRows,
      units,
    };
  }

  async unit(tenantId: string, projectReference: string, clusterReference: string, unitReference: string) {
    const data = await this.loadProject(tenantId, projectReference);
    const cluster = data && byCodeOrLegacyId(data.categories.values(), clusterReference);
    if (!data || !cluster || !data.categories.has(cluster.id)) return null;
    const unit = byCodeOrLegacyId(
      unitsInCategoryTree(data.units, cluster.id, data.categories),
      unitReference
    );
    if (!unit) return null;

    const block = nearestCategory(unit.categoryId, 'BLOCK', data.categories);
    const attributes = new Map(
      unit.variant.attributes.map(({ attribute, value }) => [attribute.code, { attribute, value }])
    );
    const attributeLabel = (code: string) => {
      const item = attributes.get(code);
      if (!item) return null;
      const suffix = item.attribute.unit ? ` ${item.attribute.unit}` : '';
      return `${item.value}${suffix}`;
    };
    const price = priceOf(unit);
    const specifications = unit.variant.attributes.map(({ attribute, value }) => ({
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
      status:
        unitStatusKey(unit) === 'processing'
          ? 'Processing'
          : displayStatus(unit.status),
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
