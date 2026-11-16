import type { Prisma, PrismaClient, ProductCategoryType, ProductUnitStatus } from '@prisma/client';

const unitInclude = (tenantId: string) =>
  ({
  category: { select: { id: true, parentId: true, name: true, type: true } },
  variant: {
    select: {
      id: true,
      name: true,
      currentPrice: true,
      attributes: {
        include: { attribute: { select: { code: true, name: true, unit: true } } },
      },
    },
  },
  media: {
    where: { mediaType: 'IMAGE' as const },
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    select: { fileUrl: true, isPrimary: true, sortOrder: true },
  },
  reservations: {
    where: { tenantId, status: { in: ['ACTIVE', 'PAYMENT_PENDING'] } },
    orderBy: { reservedAt: 'desc' },
    take: 1,
    select: { status: true },
  },
  }) satisfies Prisma.ProductUnitInclude;

type AvailabilityUnit = Prisma.ProductUnitGetPayload<{ include: ReturnType<typeof unitInclude> }>;
type AvailabilityCategory = {
  id: string;
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
  return Number(unit.variant.currentPrice) + Number(unit.adjustmentAmount);
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

function displayStatus(status: ProductUnitStatus) {
  if (status === 'BOOKED') return 'Processing';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export class AvailabilityUseCase {
  constructor(private prisma: PrismaClient) {}

  async overview(tenantId: string, projectId?: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, ...(projectId ? { id: projectId } : {}) },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        village: true,
        subdistrict: true,
        city: true,
        province: true,
        variants: { select: { id: true } },
        media: {
          where: { mediaType: 'IMAGE', variantId: null, unitId: null },
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
        name: product.name,
        location: locationOf(product),
        image: product.media[0]?.fileUrl ?? null,
        ...projectSummary,
      };
    });

    return { summary, projects: projectRows };
  }

  private async loadProject(tenantId: string, projectId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: projectId, tenantId },
      select: {
        id: true,
        categoryId: true,
        name: true,
        address: true,
        village: true,
        subdistrict: true,
        city: true,
        province: true,
        media: {
          where: { mediaType: 'IMAGE', variantId: null, unitId: null },
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
          select: { fileUrl: true },
        },
      },
    });
    if (!product) return null;

    const categoryRows = await this.prisma.productCategory.findMany({
      where: { tenantId },
      select: { id: true, parentId: true, name: true, type: true },
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
      where: { tenantId, variant: { productId: projectId, tenantId } },
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
    const clusters = [...data.categories.values()].filter((category) => category.type === 'CLUSTER');
    const clusterRows = clusters.map((cluster) => {
      const clusterUnits = data.units.filter(
        (unit) => nearestCategory(unit.categoryId, 'CLUSTER', data.categories)?.id === cluster.id
      );
      const blocks = [...data.categories.values()].filter(
        (category) =>
          category.type === 'BLOCK' &&
          nearestCategory(category.id, 'CLUSTER', data.categories)?.id === cluster.id
      );
      const unitSummary = summarize(clusterUnits);
      return {
        id: cluster.id,
        name: cluster.name,
        units: unitSummary.total,
        blocks: blocks.length,
        available: unitSummary.available,
        processing: unitSummary.processing,
        reserved: unitSummary.reserved,
        sold: unitSummary.sold,
        blocked: unitSummary.blocked,
      };
    });

    return {
      project: {
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
      clusters: clusterRows,
    };
  }

  async cluster(tenantId: string, projectId: string, clusterId: string) {
    const data = await this.loadProject(tenantId, projectId);
    const cluster = data?.categories.get(clusterId);
    if (!data || cluster?.type !== 'CLUSTER') return null;

    const clusterUnits = data.units.filter(
      (unit) => nearestCategory(unit.categoryId, 'CLUSTER', data.categories)?.id === clusterId
    );
    const summary = summarize(clusterUnits);
    const blocks = [...data.categories.values()]
      .filter(
        (category) =>
          category.type === 'BLOCK' &&
          nearestCategory(category.id, 'CLUSTER', data.categories)?.id === clusterId
      )
      .map((category) => category.name);

    const units = clusterUnits.map((unit) => {
      const block = nearestCategory(unit.categoryId, 'BLOCK', data.categories);
      return {
        id: unit.id,
        code: unit.code,
        type: unit.variant.name,
        price: priceOf(unit),
        block: block?.name ?? '—',
        status: unitStatusKey(unit),
        discount: Number(unit.adjustmentAmount) < 0,
      };
    });

    return {
      project: { id: data.product.id, name: data.product.name, location: locationOf(data.product) },
      cluster: { id: cluster.id, name: cluster.name },
      summary: {
        total: summary.total,
        available: summary.available,
        processing: summary.processing,
        reserved: summary.reserved,
        sold: summary.sold,
      },
      blocks,
      units,
    };
  }

  async unit(tenantId: string, projectId: string, clusterId: string, unitId: string) {
    const data = await this.loadProject(tenantId, projectId);
    const cluster = data?.categories.get(clusterId);
    if (!data || cluster?.type !== 'CLUSTER') return null;
    const unit = data.units.find(
      (item) =>
        item.id === unitId &&
        nearestCategory(item.categoryId, 'CLUSTER', data.categories)?.id === clusterId
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
      number: unit.name ?? unit.code,
      status:
        unitStatusKey(unit) === 'processing'
          ? 'Processing'
          : displayStatus(unit.status),
      project: data.product.name,
      cluster: cluster.name,
      block: block?.name ?? '—',
      type: unit.variant.name,
      buildingArea: attributeLabel('building_area') ?? '—',
      landArea: attributeLabel('surface_area') ?? '—',
      price,
      promo: Math.max(0, -Number(unit.adjustmentAmount)),
      finalPrice: price,
      images: unit.media.map((media) => media.fileUrl),
      floorPlan: null,
      specifications,
    };
  }
}
