import type { Prisma, PrismaClient } from '@prisma/client';
import type { LeadLabelIcon } from './leadLabelIcons.js';

/** Preset warna jenis aktivitas; label tampilannya ada di frontend. */
export const ACTIVITY_COLORS = ['blue', 'purple', 'green', 'orange', 'gray', 'red', 'yellow', 'pink'] as const;
export type ActivityColor = (typeof ACTIVITY_COLORS)[number];

export type LeadActivityTypeInput = {
  name?: string;
  icon?: string;
  color?: string;
  description?: string | null;
  isActive?: boolean;
};

export type LeadActivityTypeFilters = {
  search?: string;
  isActive?: boolean;
  page: number;
  limit: number;
};

/** Jenis aktivitas awal untuk company baru; dapat diubah atau dihapus owner. */
export const DEFAULT_LEAD_ACTIVITY_TYPES: {
  name: string;
  icon: LeadLabelIcon;
  color: ActivityColor;
  description: string;
}[] = [
  { name: 'Follow Up (FU)', icon: 'phone', color: 'blue', description: 'Tindak lanjut komunikasi dengan prospek.' },
  { name: 'Penawaran', icon: 'file-text', color: 'purple', description: 'Pengiriman penawaran harga atau promo.' },
  { name: 'Visit / Survey', icon: 'map-pin', color: 'green', description: 'Kunjungan lokasi atau survey unit.' },
  { name: 'Meeting', icon: 'calendar', color: 'blue', description: 'Pertemuan langsung atau online dengan customer.' },
  {
    name: 'Presentasi',
    icon: 'presentation',
    color: 'orange',
    description: 'Presentasi produk, unit, atau skema pembiayaan.',
  },
  { name: 'Catatan', icon: 'sticky-note', color: 'gray', description: 'Catatan umum terkait perkembangan leads.' },
];

/** Data createMany jenis aktivitas awal untuk satu company. */
export function defaultLeadActivityTypes(tenantId: string): Prisma.LeadActivityTypeCreateManyInput[] {
  return DEFAULT_LEAD_ACTIVITY_TYPES.map((type, index) => ({ ...type, tenantId, sortOrder: index }));
}

const select = {
  id: true,
  name: true,
  icon: true,
  color: true,
  description: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LeadActivityTypeSelect;

/** Jenis aktivitas Lead milik satu company. */
export class LeadActivityTypeUseCase {
  constructor(private prisma: PrismaClient) {}

  async list(tenantId: string, filters: LeadActivityTypeFilters) {
    const where: Prisma.LeadActivityTypeWhereInput = { tenantId };
    if (filters.search) where.name = { contains: filters.search };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    const [data, total] = await Promise.all([
      this.prisma.leadActivityType.findMany({
        where,
        select,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.leadActivityType.count({ where }),
    ]);
    return {
      data,
      meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  private async find(id: string, tenantId: string) {
    const type = await this.prisma.leadActivityType.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!type) throw new Error('Lead activity type not found');
    return type;
  }

  /** Nama unik per company; kolasi database tidak membedakan huruf besar/kecil. */
  private async assertUniqueName(tenantId: string, name: string, exceptId?: string) {
    const existing = await this.prisma.leadActivityType.findFirst({
      where: { tenantId, name, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new Error(`Lead activity type "${name}" already exists`);
  }

  async create(tenantId: string, input: LeadActivityTypeInput) {
    const name = input.name as string;
    await this.assertUniqueName(tenantId, name);
    const last = await this.prisma.leadActivityType.aggregate({ where: { tenantId }, _max: { sortOrder: true } });
    return this.prisma.leadActivityType.create({
      data: {
        tenantId,
        name,
        icon: input.icon as string,
        color: input.color as string,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
      select,
    });
  }

  async update(id: string, tenantId: string, input: LeadActivityTypeInput) {
    await this.find(id, tenantId);
    if (input.name !== undefined) await this.assertUniqueName(tenantId, input.name, id);
    const data: Prisma.LeadActivityTypeUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.color !== undefined) data.color = input.color;
    if (input.description !== undefined) data.description = input.description;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return this.prisma.leadActivityType.update({ where: { id }, data, select });
  }

  /**
   * Hapus permanen. Setelah aktivitas Lead terhubung ke jenis ini (tahap integrasi),
   * jenis yang sudah dipakai ditolak dan cukup dinonaktifkan.
   */
  async remove(id: string, tenantId: string) {
    await this.find(id, tenantId);
    await this.prisma.leadActivityType.delete({ where: { id } });
  }
}
