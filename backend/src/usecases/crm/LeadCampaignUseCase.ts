import type { Prisma, PrismaClient } from '@prisma/client';

export type LeadCampaignInput = {
  sourceId?: string;
  name?: string;
  description?: string | null;
  /** Tanggal `YYYY-MM-DD`; opsional karena campaign bisa disiapkan sebelum jadwalnya pasti. */
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
};

export type LeadCampaignFilters = {
  sourceId?: string;
  search?: string;
  isActive?: boolean;
  /** Hanya campaign aktif yang periodenya mencakup hari ini (untuk form Add Lead). */
  available?: boolean;
};

const MAX_ROWS = 500;

const select = {
  id: true,
  sourceId: true,
  name: true,
  description: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LeadCampaignSelect;

type CampaignRow = Prisma.LeadCampaignGetPayload<{ select: typeof select }>;

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const fromDate = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

/** Tanggal dikirim sebagai `YYYY-MM-DD` agar tidak bergeser karena zona waktu. */
function present(row: CampaignRow) {
  return { ...row, startDate: fromDate(row.startDate), endDate: fromDate(row.endDate) };
}

function assertPeriod(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (startDate && endDate && endDate < startDate) {
    throw new Error('endDate must be on or after startDate');
  }
}

/** Campaign Sumber Leads milik satu company. */
export class LeadCampaignUseCase {
  constructor(private prisma: PrismaClient) {}

  async list(tenantId: string, filters: LeadCampaignFilters, today = new Date()) {
    const where: Prisma.LeadCampaignWhereInput = { tenantId };
    if (filters.sourceId) where.sourceId = filters.sourceId;
    if (filters.search) where.name = { contains: filters.search };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.available) {
      const day = toDate(today.toISOString().slice(0, 10));
      where.isActive = true;
      where.source = { isActive: true };
      where.AND = [
        { OR: [{ startDate: null }, { startDate: { lte: day } }] },
        { OR: [{ endDate: null }, { endDate: { gte: day } }] },
      ];
    }
    const rows = await this.prisma.leadCampaign.findMany({
      where,
      select,
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
      take: MAX_ROWS,
    });
    return rows.map(present);
  }

  private async find(id: string, tenantId: string) {
    const campaign = await this.prisma.leadCampaign.findFirst({
      where: { id, tenantId },
      select: { id: true, sourceId: true, startDate: true, endDate: true },
    });
    if (!campaign) throw new Error('Lead campaign not found');
    return campaign;
  }

  /** Source harus Sumber Leads milik company yang sama. */
  private async assertSource(tenantId: string, sourceId: string) {
    const source = await this.prisma.source.findFirst({
      where: { id: sourceId, tenantId, type: 'lead' },
      select: { id: true },
    });
    if (!source) throw new Error('Lead source not found');
  }

  /** Nama unik per source; kolasi database tidak membedakan huruf besar/kecil. */
  private async assertUniqueName(sourceId: string, name: string, exceptId?: string) {
    const existing = await this.prisma.leadCampaign.findFirst({
      where: { sourceId, name, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new Error(`Campaign "${name}" already exists in this source`);
  }

  async create(tenantId: string, input: LeadCampaignInput) {
    const sourceId = input.sourceId as string;
    const name = input.name as string;
    assertPeriod(input.startDate, input.endDate);
    await this.assertSource(tenantId, sourceId);
    await this.assertUniqueName(sourceId, name);
    const row = await this.prisma.leadCampaign.create({
      data: {
        tenantId,
        sourceId,
        name,
        description: input.description ?? null,
        startDate: input.startDate ? toDate(input.startDate) : null,
        endDate: input.endDate ? toDate(input.endDate) : null,
        isActive: input.isActive ?? true,
      },
      select,
    });
    return present(row);
  }

  async update(id: string, tenantId: string, input: LeadCampaignInput) {
    const campaign = await this.find(id, tenantId);
    assertPeriod(
      input.startDate !== undefined ? input.startDate : fromDate(campaign.startDate),
      input.endDate !== undefined ? input.endDate : fromDate(campaign.endDate),
    );
    if (input.name !== undefined) await this.assertUniqueName(campaign.sourceId, input.name, id);
    const data: Prisma.LeadCampaignUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.startDate !== undefined) data.startDate = input.startDate ? toDate(input.startDate) : null;
    if (input.endDate !== undefined) data.endDate = input.endDate ? toDate(input.endDate) : null;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return present(await this.prisma.leadCampaign.update({ where: { id }, data, select }));
  }

  /**
   * Hapus permanen. Setelah Lead menyimpan campaign (tahap integrasi Add Lead),
   * campaign yang sudah dipakai ditolak dan cukup dinonaktifkan.
   */
  async remove(id: string, tenantId: string) {
    await this.find(id, tenantId);
    await this.prisma.leadCampaign.delete({ where: { id } });
  }
}
