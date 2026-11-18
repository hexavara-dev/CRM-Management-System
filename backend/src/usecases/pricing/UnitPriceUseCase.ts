import type { PriceAdjustmentStatus, Prisma, PrismaClient, ProductUnitStatus } from '@prisma/client';
import { categoryWithDescendants } from '../product/catalogRules.js';
import {
  activeAdjustment,
  activeLogsForUnit,
  ancestorChain,
  needsApproval,
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

/** `price` adalah harga jual final yang diinginkan, bukan selisih. */
export type AdjustmentInput = { price: number; reason: string; effectiveDate: string };

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

    // Semua unit yang cocok dengan filter dihitung harganya sekali, agar ringkasan
    // (jumlah project, status, dan nilai harga jual) mencakup seluruh hasil filter,
    // lalu dipotong per halaman untuk tabel.
    const [allUnits, pendingAdjustments] = await Promise.all([
      this.prisma.productUnit.findMany({ where, include: unitInclude, orderBy: { code: 'asc' } }),
      this.prisma.unitPriceAdjustment.count({ where: { tenantId, status: 'PENDING' } }),
    ]);
    const total = allUnits.length;
    const pricedAll = await this.price(tenantId, allUnits, day);
    const start = (filters.page - 1) * filters.limit;
    const priced = pricedAll.slice(start, start + filters.limit);

    const pendingUnits = new Set(
      (
        await this.prisma.unitPriceAdjustment.findMany({
          where: { tenantId, status: 'PENDING', unitId: { in: priced.map((p) => p.unit.id) } },
          select: { unitId: true },
        })
      ).map((row) => row.unitId)
    );

    const byStatus: Record<ProductUnitStatus, number> = {
      AVAILABLE: 0,
      RESERVED: 0,
      BOOKED: 0,
      SOLD: 0,
      BLOCKED: 0,
    };
    let unsoldValue = ZERO;
    const projects = new Set<string>();
    for (const { unit, price } of pricedAll) {
      byStatus[unit.status] += 1;
      projects.add(unit.variant.product.id);
      if (unit.status !== 'SOLD') unsoldValue += price;
    }

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
      summary: {
        totalUnits: total,
        totalProjects: projects.size,
        byStatus,
        /** Jumlah harga jual unit yang belum terjual (status selain SOLD). */
        unsoldValue,
        pendingAdjustments,
        date: day,
      },
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

  async history(unitId: string, tenantId: string, page: number, limit: number) {
    await this.findUnit(unitId, tenantId);
    const where = { tenantId, unitId };
    const [data, total] = await Promise.all([
      this.prisma.unitPriceAdjustment.findMany({
        where,
        include: { requestedBy: userSelect, approvedBy: userSelect },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.unitPriceAdjustment.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async createAdjustment(unitId: string, actor: Actor, input: AdjustmentInput) {
    const today = todayInPriceZone();
    if (input.effectiveDate < today) throw new Error('effectiveDate must be today or later');

    const unit = await this.findUnit(unitId, actor.tenantId);
    if (unit.status === 'SOLD') throw new Error('Price of a sold unit cannot be adjusted (conflict)');

    const [priced] = await this.price(actor.tenantId, [unit], input.effectiveDate);
    const data = this.adjustmentData(priced!, actor, input);
    if (data.priceAfter === data.priceBefore) throw new Error('price must differ from the current selling price');

    return this.prisma.$transaction(async (tx) => {
      const pending = await tx.unitPriceAdjustment.count({
        where: { tenantId: actor.tenantId, unitId, status: 'PENDING' },
      });
      if (pending > 0) {
        throw new Error('This unit already has a pending adjustment (conflict)');
      }
      return tx.unitPriceAdjustment.create({
        data,
        include: { requestedBy: userSelect, approvedBy: userSelect },
      });
    });
  }

  /**
   * Baris penyesuaian untuk satu unit yang sudah dihitung harganya.
   * input.price adalah harga jual final yang diinginkan pada tanggal efektif. Yang
   * disimpan adalah total penyesuaian unit (harga final - harga dasar - kenaikan
   * tipe/blok aktif), sehingga rumus harga jual tetap berlaku.
   */
  private adjustmentData(
    priced: Awaited<ReturnType<UnitPriceUseCase['price']>>[number],
    actor: Actor,
    input: AdjustmentInput
  ) {
    const { unit, basePrice, logTotal, price } = priced;
    const priceAfter = BigInt(input.price);
    const amount = priceAfter - basePrice - logTotal;
    const minPrice = unit.variant.minPrice;
    const status: PriceAdjustmentStatus = needsApproval(priceAfter, minPrice) ? 'PENDING' : 'APPROVED';
    return {
      tenantId: actor.tenantId,
      unitId: unit.id,
      amount,
      priceBefore: price,
      priceAfter,
      minPrice,
      reason: input.reason,
      effectiveDate: toDateValue(input.effectiveDate),
      status,
      requestedById: actor.userId,
      ...(status === 'APPROVED' ? { approvedById: actor.userId, approvedAt: new Date() } : {}),
    };
  }

  /**
   * Menetapkan harga jual final yang sama untuk banyak unit dari satu project
   * sekaligus, dalam satu transaksi. Unit yang harganya sudah sama dilewati.
   */
  async createBulkAdjustment(unitIds: string[], actor: Actor, input: AdjustmentInput) {
    const today = todayInPriceZone();
    if (input.effectiveDate < today) throw new Error('effectiveDate must be today or later');

    const units = await this.prisma.productUnit.findMany({
      where: { id: { in: unitIds }, tenantId: actor.tenantId },
      include: unitInclude,
      orderBy: { code: 'asc' },
    });
    const found = new Set(units.map((u) => u.id));
    const missing = unitIds.filter((id) => !found.has(id));
    if (missing.length > 0) throw new Error(`Units not found: ${missing.join(', ')}`);

    if (new Set(units.map((u) => u.variant.product.id)).size > 1) {
      throw new Error('All units must be from the same project');
    }
    const sold = units.filter((u) => u.status === 'SOLD').map((u) => u.code);
    if (sold.length > 0) {
      throw new Error(`Price of a sold unit cannot be adjusted (conflict): ${sold.join(', ')}`);
    }

    const priced = await this.price(actor.tenantId, units, input.effectiveDate);
    const rows = priced
      .map((p) => this.adjustmentData(p, actor, input))
      .filter((r) => r.priceAfter !== r.priceBefore);
    if (rows.length === 0) throw new Error('price must differ from the current selling price of at least one unit');

    const created = await this.prisma.$transaction(async (tx) => {
      const pending = await tx.unitPriceAdjustment.findMany({
        where: { tenantId: actor.tenantId, unitId: { in: unitIds }, status: 'PENDING' },
        select: { unitId: true },
      });
      if (pending.length > 0) {
        const codes = units.filter((u) => pending.some((p) => p.unitId === u.id)).map((u) => u.code);
        throw new Error(`Units already have a pending adjustment (conflict): ${codes.join(', ')}`);
      }
      return Promise.all(rows.map((data) => tx.unitPriceAdjustment.create({ data })));
    });

    const codeOf = new Map(units.map((u) => [u.id, u.code]));
    return {
      count: created.length,
      data: created.map((row) => ({
        id: row.id,
        unitId: row.unitId,
        code: codeOf.get(row.unitId)!,
        priceBefore: row.priceBefore,
        priceAfter: row.priceAfter,
        minPrice: row.minPrice,
        status: row.status,
      })),
    };
  }

  async listAdjustments(
    tenantId: string,
    filters: { status?: PriceAdjustmentStatus; page: number; limit: number }
  ) {
    const where: Prisma.UnitPriceAdjustmentWhereInput = { tenantId };
    if (filters.status) where.status = filters.status;
    const [data, total] = await Promise.all([
      this.prisma.unitPriceAdjustment.findMany({
        where,
        include: {
          requestedBy: userSelect,
          approvedBy: userSelect,
          unit: {
            select: {
              id: true,
              code: true,
              variant: { select: { id: true, name: true, product: { select: { id: true, name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.unitPriceAdjustment.count({ where }),
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

  /** Approves or rejects a pending adjustment exactly once. */
  async review(id: string, actor: Actor, decision: 'APPROVED' | 'REJECTED', note?: string) {
    if (decision === 'REJECTED' && !note?.trim()) throw new Error('note is required to reject');
    const result = await this.prisma.unitPriceAdjustment.updateMany({
      where: { id, tenantId: actor.tenantId, status: 'PENDING' },
      data: {
        status: decision,
        approvedById: actor.userId,
        approvedAt: new Date(),
        reviewNote: note?.trim() || null,
      },
    });
    if (result.count === 0) {
      const exists = await this.prisma.unitPriceAdjustment.findFirst({
        where: { id, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!exists) throw new Error('Adjustment not found');
      throw new Error('Only pending adjustments can be reviewed (conflict)');
    }
    return this.prisma.unitPriceAdjustment.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { requestedBy: userSelect, approvedBy: userSelect },
    });
  }
}
