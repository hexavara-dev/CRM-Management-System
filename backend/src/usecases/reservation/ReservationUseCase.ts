import { randomUUID } from 'node:crypto';
import { unitSellingPrices, type PricedUnit } from '../pricing/unitPrices.js';
import type { Prisma, PrismaClient, ReservationStatus } from '@prisma/client';
import type {
  CreateReservationDTO,
  ReservationListFilters,
  UpdateReservationDTO,
} from '../../presentation/dtos/ReservationDTO.js';
import { expireOverdueReservations, unitStatusForReservation } from './reservationStatus.js';

const reservationInclude = {
  unit: {
    include: {
      variant: {
        include: {
          product: { select: { id: true, name: true, code: true } },
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          parent: {
            select: {
              id: true,
              name: true,
              type: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  parent: {
                    select: {
                      id: true,
                      name: true,
                      type: true,
                      parent: {
                        select: {
                          id: true,
                          name: true,
                          type: true,
                          parent: { select: { id: true, name: true, type: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  sales: { select: { id: true, name: true, email: true } },
} as const satisfies Prisma.ReservationInclude;

type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

const statusLabels: Record<ReservationStatus, string> = {
  ACTIVE: 'Aktif',
  PAYMENT_PENDING: 'Menunggu Pembayaran',
  EXPIRED: 'Kedaluwarsa',
  CANCELLED: 'Dibatalkan',
  COMPLETED: 'Selesai',
};

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
];

function initials(name: string | null) {
  return (name ?? 'Sales')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function dayStart(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function periodOf(value: Date) {
  const today = dayStart(new Date());
  const date = dayStart(value);
  const daysAgo = Math.floor((today.getTime() - date.getTime()) / 86_400_000);
  if (daysAgo <= 0) return 'Hari ini' as const;
  if (daysAgo <= 6) return 'Minggu ini' as const;
  return 'Bulan ini' as const;
}

function rupiah(value: bigint) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Harga reservasi minimal harga jual resmi hari ini; harga lebih rendah diatur dulu lewat Pricing. */
async function assertReservationPrice(
  tx: Prisma.TransactionClient,
  tenantId: string,
  unit: PricedUnit & { code: string },
  price: number
) {
  const minimum = (await unitSellingPrices(tx, tenantId, [unit])).get(unit.id) ?? unit.typeVariant.basePrice;
  if (BigInt(price) < minimum) {
    throw new Error(`Harga jual unit ${unit.code} tidak boleh lebih rendah dari harga jual resmi ${rupiah(minimum)}.`);
  }
}

/** Unit project nonaktif tidak dapat direservasi; reservasi yang sudah ada tetap berjalan. */
function assertProjectActive(unit: { code: string; variant?: { product: { isActive: boolean } } }) {
  if (unit.variant?.product.isActive === false) {
    throw new Error(`Conflict: unit ${unit.code} berada di proyek yang tidak aktif.`);
  }
}

function responseOf(row: ReservationWithRelations) {
  const leaf = row.unit.category;
  type CategoryNode = {
    id: string;
    name: string;
    type: string;
    parent?: CategoryNode | null;
  };
  const hierarchy: CategoryNode[] = [];
  let current: CategoryNode | null | undefined = leaf as unknown as CategoryNode;
  while (current) {
    if (current.type !== 'PROJECT') hierarchy.unshift(current);
    current = current.parent;
  }
  const block = hierarchy.find((item) => item.type === 'BLOCK') ?? leaf;
  const cluster = hierarchy.find((item) => item.type === 'CLUSTER');
  const project = row.unit.variant.product;
  const colorIndex = row.sales.id.charCodeAt(0) % avatarColors.length;

  return {
    id: row.id,
    refCode: row.refCode,
    unit: row.unit.code,
    unitId: row.unit.id,
    project: project.name,
    projectId: project.id,
    cluster: cluster?.name ?? '',
    clusterId: cluster?.id ?? null,
    block: block.name,
    blockId: block.id,
    hierarchy: hierarchy.map((item) => ({ id: item.id, name: item.name, type: item.type })),
    customer: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    reservationDate: row.reservedAt,
    price: Number(row.price),
    sales: {
      id: row.sales.id,
      name: row.sales.name ?? row.sales.email,
      initials: initials(row.sales.name),
      color: avatarColors[colorIndex] ?? avatarColors[0],
    },
    status: statusLabels[row.status],
    statusCode: row.status,
    period: periodOf(row.reservedAt),
    expiresAt: row.expiresAt,
    notes: row.notes,
  };
}

export class ReservationUseCase {
  constructor(private prisma: PrismaClient) {}

  private buildWhere(tenantId: string, filters: ReservationListFilters) {
    const where: Prisma.ReservationWhereInput = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { refCode: { contains: filters.search } },
        { customerName: { contains: filters.search } },
        { unit: { code: { contains: filters.search } } },
        { unit: { name: { contains: filters.search } } },
        { sales: { name: { contains: filters.search } } },
      ];
    }

    const unitWhere: Prisma.ProductUnitWhereInput = {};
    if (filters.project) {
      unitWhere.variant = { product: { name: filters.project } };
    }
    const categoryWhere: Prisma.ProductCategoryWhereInput = {};
    if (filters.block) categoryWhere.name = filters.block;
    if (filters.cluster) categoryWhere.parent = { name: filters.cluster };
    if (Object.keys(categoryWhere).length > 0) unitWhere.category = categoryWhere;
    if (Object.keys(unitWhere).length > 0) where.unit = unitWhere;

    if (filters.period) {
      const start = dayStart(new Date());
      if (filters.period === 'today') {
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        where.reservedAt = { gte: start, lt: end };
      } else if (filters.period === 'week') {
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() - 6);
        where.reservedAt = { gte: weekStart };
      } else {
        start.setDate(1);
        where.reservedAt = { gte: start };
      }
    }

    return where;
  }

  private async filterOptions(tenantId: string) {
    const [projects, clusters, blocks] = await Promise.all([
      this.prisma.productCategory.findMany({
        where: { tenantId, type: 'PROJECT', isActive: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.productCategory.findMany({
        where: { tenantId, type: 'CLUSTER', isActive: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.productCategory.findMany({
        where: { tenantId, type: 'BLOCK', isActive: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      projects: [...new Set(projects.map((item) => item.name))],
      clusters: [...new Set(clusters.map((item) => item.name))],
      blocks: [...new Set(blocks.map((item) => item.name))],
    };
  }

  async list(tenantId: string, filters: ReservationListFilters) {
    await expireOverdueReservations(this.prisma, tenantId);
    const where = this.buildWhere(tenantId, filters);
    const [rows, total, summaryRows, filterOptions] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: reservationInclude,
        orderBy: { reservedAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.filterOptions(tenantId),
    ]);

    const summary = { total: 0, active: 0, paymentPending: 0, expired: 0 };
    for (const row of summaryRows) {
      const count = row._count._all;
      summary.total += count;
      if (row.status === 'ACTIVE') summary.active = count;
      if (row.status === 'PAYMENT_PENDING') summary.paymentPending = count;
      if (row.status === 'EXPIRED') summary.expired = count;
    }

    return {
      data: rows.map(responseOf),
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
      summary,
      filters: filterOptions,
    };
  }

  async get(id: string, tenantId: string) {
    const row = await this.prisma.reservation.findFirst({
      where: { id, tenantId },
      include: reservationInclude,
    });
    if (!row) throw new Error('Reservation not found');
    return responseOf(row);
  }

  async create(dto: CreateReservationDTO, tenantId: string, actorId: string) {
    const salesId = dto.salesId ?? actorId;
    const reservedAt = dto.reservedAt ?? new Date();
    const status = dto.status ?? 'ACTIVE';
    if (dto.expiresAt && dto.expiresAt <= reservedAt) {
      throw new Error('expiresAt must be after reservedAt');
    }

    const id = await this.prisma.$transaction(async (tx) => {
      const [unit, sales] = await Promise.all([
        tx.productUnit.findFirst({
          where: { id: dto.unitId, tenantId },
          select: { id: true, code: true, categoryId: true, typeVariantId: true, typeVariant: { select: { basePrice: true } }, variant: { select: { product: { select: { isActive: true } } } } },
        }),
        tx.user.findFirst({ where: { id: salesId, tenantId }, select: { id: true } }),
      ]);
      if (!unit) throw new Error('Unit not found');
      if (!sales) throw new Error('Sales user not found');
      assertProjectActive(unit);
      await assertReservationPrice(tx, tenantId, unit, dto.price);

      const claimed = await tx.productUnit.updateMany({
        where: { id: dto.unitId, tenantId, status: 'AVAILABLE' },
        data: { status: unitStatusForReservation(status) },
      });
      if (claimed.count !== 1) throw new Error('Unit is not available');

      const reservation = await tx.reservation.create({
        data: {
          tenant: { connect: { id: tenantId } },
          unit: { connect: { id: dto.unitId } },
          sales: { connect: { id: salesId } },
          refCode: dto.refCode ?? `RSV-${randomUUID().slice(0, 8).toUpperCase()}`,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail ?? null,
          customerPhone: dto.customerPhone ?? null,
          reservedAt,
          expiresAt: dto.expiresAt ?? null,
          price: BigInt(dto.price),
          status,
          notes: dto.notes ?? null,
        },
        select: { id: true },
      });
      return reservation.id;
    });

    return this.get(id, tenantId);
  }

  async update(id: string, tenantId: string, dto: UpdateReservationDTO) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findFirst({
        where: { id, tenantId },
        select: { id: true, unitId: true, status: true, price: true },
      });
      if (!current) throw new Error('Reservation not found');

      const wasActive = current.status === 'ACTIVE' || current.status === 'PAYMENT_PENDING';
      const nextStatus = dto.status ?? current.status;
      const becomesActive = nextStatus === 'ACTIVE' || nextStatus === 'PAYMENT_PENDING';
      const currentUnitStatus = unitStatusForReservation(current.status);
      const nextUnitStatus = unitStatusForReservation(nextStatus);

      if (current.status === 'COMPLETED' || (!wasActive && nextStatus === 'COMPLETED')) {
        throw new Error('Reservation status conflict');
      }

      if (dto.unitId !== undefined && dto.unitId !== current.unitId) {
        if (!wasActive || !becomesActive) {
          throw new Error('Only active reservations can change units');
        }

        const claimed = await tx.productUnit.updateMany({
          where: { id: dto.unitId, tenantId, status: 'AVAILABLE' },
          data: { status: nextUnitStatus },
        });
        if (claimed.count !== 1) throw new Error('Unit is not available');

        const released = await tx.productUnit.updateMany({
          where: { id: current.unitId, tenantId, status: currentUnitStatus },
          data: { status: 'AVAILABLE' },
        });
        if (released.count !== 1) throw new Error('Unit reservation conflict');
      }

      if (dto.salesId) {
        const sales = await tx.user.findFirst({
          where: { id: dto.salesId, tenantId },
          select: { id: true },
        });
        if (!sales) throw new Error('Sales user not found');
      }

      // Harga yang sudah disepakati tetap berlaku walau harga resmi naik; diperiksa hanya bila harga atau unit berubah.
      const price = dto.price ?? Number(current.price);
      const priceUnitId = dto.unitId ?? current.unitId;
      if (price !== Number(current.price) || priceUnitId !== current.unitId) {
        const priceUnit = await tx.productUnit.findFirst({
          where: { id: priceUnitId, tenantId },
          select: { id: true, code: true, categoryId: true, typeVariantId: true, typeVariant: { select: { basePrice: true } }, variant: { select: { product: { select: { isActive: true } } } } },
        });
        if (!priceUnit) throw new Error('Unit not found');
        if (priceUnitId !== current.unitId) assertProjectActive(priceUnit);
        await assertReservationPrice(tx, tenantId, priceUnit, price);
      }

      const saved = await tx.reservation.updateMany({
        where: { id, tenantId, status: current.status },
        data: {
          ...(dto.unitId !== undefined ? { unitId: dto.unitId } : {}),
          ...(dto.salesId !== undefined ? { salesId: dto.salesId } : {}),
          ...(dto.customerName !== undefined ? { customerName: dto.customerName.trim() } : {}),
          ...(dto.customerEmail !== undefined ? { customerEmail: dto.customerEmail || null } : {}),
          ...(dto.customerPhone !== undefined ? { customerPhone: dto.customerPhone || null } : {}),
          ...(dto.price !== undefined ? { price: BigInt(dto.price) } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        },
      });
      if (saved.count !== 1) throw new Error('Reservation status conflict');

      if (dto.status && dto.status !== current.status) {
        const unitChanged = dto.unitId !== undefined && dto.unitId !== current.unitId;
        if (!unitChanged && currentUnitStatus !== nextUnitStatus) {
          const changed = await tx.productUnit.updateMany({
            where: { id: current.unitId, tenantId, status: currentUnitStatus },
            data: { status: nextUnitStatus },
          });
          if (changed.count !== 1) throw new Error('Unit reservation conflict');
        }
      }

    });

    return this.get(id, tenantId);
  }

  async updateStatus(id: string, tenantId: string, status: ReservationStatus) {
    return this.update(id, tenantId, { status });
  }
}
