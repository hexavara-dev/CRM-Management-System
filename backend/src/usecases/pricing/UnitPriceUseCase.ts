import type { Prisma, PrismaClient, ProductUnitStatus } from '@prisma/client';
import { categoryWithDescendants } from '../product/catalogRules.js';
import {
  activeAdjustment,
  activeLogsForUnit,
  ancestorChain,
  sellingPrice,
  sumLogs,
  toDateValue,
  todayInPriceZone,
  type PriceLogRow,
} from './priceRules.js';

export type UnitPriceFilters = {
  page: number;
  limit: number;
  search?: string | undefined;
  productId?: string;
  variantId?: string;
  categoryId?: string;
  status?: ProductUnitStatus;
  date?: string;
};

export type Actor = { tenantId: string; userId: string };

const ZERO = BigInt(0);
const userSelect = { select: { id: true, name: true } } as const;

const unitInclude = {
  variant: {
    select: {
      id: true,
      name: true,
      basePrice: true,
      minPrice: true,
      product: { select: { id: true, name: true } },
    },
  },
  category: { select: { id: true, name: true, type: true } },
} satisfies Prisma.ProductUnitInclude;

type UnitWithVariant = Prisma.ProductUnitGetPayload<{ include: typeof unitInclude }>;

export class UnitPriceUseCase {
  constructor(private prisma: PrismaClient) {}

  private async parentMap(tenantId: string) {
    const rows = await this.prisma.productCategory.findMany({
      where: { tenantId },
      select: { id: true, parentId: true },
    });
    return new Map(rows.map((row) => [row.id, row.parentId]));
  }

  private async logsFor(tenantId: string, variantIds: string[]): Promise<PriceLogRow[]> {
    if (variantIds.length === 0) return [];
    return this.prisma.productVariantPriceLog.findMany({
      where: { tenantId, variantId: { in: variantIds } },
      select: {
        id: true,
        variantId: true,
        categoryId: true,
        adjustmentPrice: true,
        effectiveStart: true,
        endDate: true,
        reason: true,
      },
    });
  }

  private async approvedAdjustments(tenantId: string, unitIds: string[], day: string) {
    if (unitIds.length === 0) return [];
    return this.prisma.unitPriceAdjustment.findMany({
      where: {
        tenantId,
        unitId: { in: unitIds },
        status: 'APPROVED',
        effectiveDate: { lte: toDateValue(day) },
      },
      include: { requestedBy: userSelect, approvedBy: userSelect },
    });
  }

  /** Price breakdown of loaded units on the given day, using a few batched queries. */
  private async price(tenantId: string, units: UnitWithVariant[], day: string) {
    const [parents, logs, adjustments] = await Promise.all([
      this.parentMap(tenantId),
      this.logsFor(tenantId, [...new Set(units.map((u) => u.variantId))]),
      this.approvedAdjustments(tenantId, units.map((u) => u.id), day),
    ]);
    return units.map((unit) => {
      const chain = ancestorChain(unit.categoryId, parents);
      const activeLogs = activeLogsForUnit(logs, unit.variantId, chain, day);
      const adjustment = activeAdjustment(
        adjustments.filter((a) => a.unitId === unit.id),
        day
      );
      const logTotal = sumLogs(activeLogs);
      const amount = adjustment?.amount ?? ZERO;
      return {
        unit,
        activeLogs,
        adjustment,
        basePrice: unit.variant.basePrice,
        logTotal,
        amount,
        price: sellingPrice(unit.variant.basePrice, logTotal, amount),
      };
    });
  }

  private async findUnit(unitId: string, tenantId: string) {
    const unit = await this.prisma.productUnit.findFirst({
      where: { id: unitId, tenantId },
      include: unitInclude,
    });
    if (!unit) throw new Error('Unit not found');
    return unit;
  }

  async list(tenantId: string, filters: UnitPriceFilters) {
    const day = filters.date ?? todayInPriceZone();
    const where: Prisma.ProductUnitWhereInput = { tenantId };
    if (filters.search) where.code = { contains: filters.search };
    if (filters.productId) where.variant = { productId: filters.productId, tenantId };
    if (filters.variantId) where.variantId = filters.variantId;
    if (filters.status) where.status = filters.status;
    if (filters.categoryId) {
      where.categoryId = {
        in: await categoryWithDescendants(this.prisma, tenantId, filters.categoryId),
      };
    }

    const [units, total, pendingAdjustments] = await Promise.all([
      this.prisma.productUnit.findMany({
        where,
        include: unitInclude,
        orderBy: { code: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.productUnit.count({ where }),
      this.prisma.unitPriceAdjustment.count({ where: { tenantId, status: 'PENDING' } }),
    ]);

    const pendingUnits = new Set(
      (
        await this.prisma.unitPriceAdjustment.findMany({
          where: { tenantId, status: 'PENDING', unitId: { in: units.map((u) => u.id) } },
          select: { unitId: true },
        })
      ).map((row) => row.unitId)
    );

    const priced = await this.price(tenantId, units, day);
    const data = priced.map(({ unit, basePrice, logTotal, amount, price }) => ({
      unitId: unit.id,
      code: unit.code,
      name: unit.name,
      status: unit.status,
      product: unit.variant.product,
      variant: { id: unit.variant.id, name: unit.variant.name, minPrice: unit.variant.minPrice },
      location: unit.category,
      basePrice,
      priceLogTotal: logTotal,
      adjustment: amount,
      sellingPrice: price,
      hasPendingAdjustment: pendingUnits.has(unit.id),
    }));

    return {
      data,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
      summary: { totalUnits: total, pendingAdjustments, date: day },
    };
  }

  async detail(unitId: string, tenantId: string, date?: string) {
    const day = date ?? todayInPriceZone();
    const unit = await this.findUnit(unitId, tenantId);
    const [priced] = await this.price(tenantId, [unit], day);
    const pending = await this.prisma.unitPriceAdjustment.findFirst({
      where: { tenantId, unitId, status: 'PENDING' },
      include: { requestedBy: userSelect },
    });
    const { activeLogs, adjustment, basePrice, logTotal, amount, price } = priced!;
    return {
      unitId: unit.id,
      code: unit.code,
      status: unit.status,
      product: unit.variant.product,
      variant: { id: unit.variant.id, name: unit.variant.name, minPrice: unit.variant.minPrice },
      location: unit.category,
      date: day,
      basePrice,
      priceLogs: activeLogs,
      priceLogTotal: logTotal,
      activeAdjustment: adjustment,
      adjustment: amount,
      sellingPrice: price,
      pendingAdjustment: pending,
    };
  }
}
