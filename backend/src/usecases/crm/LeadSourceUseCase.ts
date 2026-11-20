import type { Prisma, PrismaClient } from '@prisma/client';

/** Hanya source bertipe `lead`; tipe `viewing` dikelola terpisah (Visit Sources). */
const LEAD = 'lead';

export type LeadSourceInput = {
  name?: string;
  description?: string | null;
  color?: string;
  isActive?: boolean;
};

export type LeadSourceFilters = {
  search?: string;
  isActive?: boolean;
  page: number;
  limit: number;
};

const select = {
  id: true,
  name: true,
  description: true,
  color: true,
  isActive: true,
  createdAt: true,
  _count: { select: { campaigns: true } },
} satisfies Prisma.SourceSelect;

type SourceRow = Prisma.SourceGetPayload<{ select: typeof select }>;

/** `_count` diratakan menjadi `campaignCount`. */
function present({ _count, ...source }: SourceRow) {
  return { ...source, campaignCount: _count.campaigns };
}

/** Sumber Leads milik satu company. */
export class LeadSourceUseCase {
  constructor(private prisma: PrismaClient) {}

  async list(tenantId: string, filters: LeadSourceFilters) {
    const where: Prisma.SourceWhereInput = { tenantId, type: LEAD };
    if (filters.search) where.name = { contains: filters.search };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    const [data, total] = await Promise.all([
      this.prisma.source.findMany({
        where,
        select,
        orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.source.count({ where }),
    ]);
    return {
      data: data.map(present),
      meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  private async find(id: string, tenantId: string) {
    const source = await this.prisma.source.findFirst({ where: { id, tenantId, type: LEAD }, select: { id: true } });
    if (!source) throw new Error('Lead source not found');
    return source;
  }

  /** Nama unik per company; kolasi database tidak membedakan huruf besar/kecil. */
  private async assertUniqueName(tenantId: string, name: string, exceptId?: string) {
    const existing = await this.prisma.source.findFirst({
      where: { tenantId, type: LEAD, name, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new Error(`Lead source "${name}" already exists`);
  }

  async create(tenantId: string, input: LeadSourceInput) {
    const name = input.name as string;
    await this.assertUniqueName(tenantId, name);
    const created = await this.prisma.source.create({
      data: {
        tenantId,
        type: LEAD,
        name,
        description: input.description ?? null,
        color: (input.color as string).toUpperCase(),
        isActive: input.isActive ?? true,
      },
      select,
    });
    return present(created);
  }

  async update(id: string, tenantId: string, input: LeadSourceInput) {
    await this.find(id, tenantId);
    if (input.name !== undefined) await this.assertUniqueName(tenantId, input.name, id);
    const data: Prisma.SourceUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.color !== undefined) data.color = input.color.toUpperCase();
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return present(await this.prisma.source.update({ where: { id }, data, select }));
  }

  /** Source yang sudah dipakai Lead tidak boleh dihapus; nonaktifkan saja. */
  async remove(id: string, tenantId: string) {
    await this.find(id, tenantId);
    const used = await this.prisma.lead.count({ where: { tenantId, sourceId: id } });
    if (used > 0) {
      throw new Error(`Lead source is used by ${used} leads and cannot be deleted; deactivate it instead (conflict)`);
    }
    await this.prisma.source.delete({ where: { id } });
  }
}
