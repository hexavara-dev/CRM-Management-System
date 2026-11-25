import type { Prisma, PrismaClient } from '@prisma/client';
import { newFacilityCode } from './projectFacilities.js';

export type ProjectFacilityInput = {
  name?: string;
  iconKey?: string;
  description?: string | null;
  isActive?: boolean;
};

export type ProjectFacilityFilters = { search?: string; isActive?: boolean; page: number; limit: number };

const select = {
  id: true,
  code: true,
  name: true,
  iconKey: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { values: true } },
} satisfies Prisma.AttributeSelect;

/** usageCount = jumlah proyek yang memakai fasilitas. */
function responseOf({ _count, ...row }: Prisma.AttributeGetPayload<{ select: typeof select }>) {
  return { ...row, usageCount: _count.values };
}

/** Konfigurasi fasilitas proyek per company; disimpan sebagai attribute bersumber PROJECT. */
export class ProjectFacilityUseCase {
  constructor(private prisma: PrismaClient) {}

  async list(tenantId: string, filters: ProjectFacilityFilters) {
    const where: Prisma.AttributeWhereInput = { tenantId, source: 'PROJECT' };
    if (filters.search) where.name = { contains: filters.search };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    const [rows, total] = await Promise.all([
      this.prisma.attribute.findMany({
        where,
        select,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.attribute.count({ where }),
    ]);
    return {
      data: rows.map(responseOf),
      meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  private async assertExists(id: string, tenantId: string) {
    const row = await this.prisma.attribute.findFirst({
      where: { id, tenantId, source: 'PROJECT' },
      select: { id: true },
    });
    if (!row) throw new Error('Project facility not found');
  }

  /** Nama unik per company; kolasi database tidak membedakan huruf besar/kecil. */
  private async assertUniqueName(tenantId: string, name: string, exceptId?: string) {
    const existing = await this.prisma.attribute.findFirst({
      where: { tenantId, source: 'PROJECT', name, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new Error(`Project facility "${name}" already exists`);
  }

  async create(tenantId: string, input: ProjectFacilityInput) {
    const name = input.name as string;
    await this.assertUniqueName(tenantId, name);
    const row = await this.prisma.attribute.create({
      data: {
        tenantId,
        name,
        code: newFacilityCode(),
        dataType: 'NUMBER',
        source: 'PROJECT',
        iconKey: input.iconKey as string,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
      },
      select,
    });
    return responseOf(row);
  }

  async update(id: string, tenantId: string, input: ProjectFacilityInput) {
    await this.assertExists(id, tenantId);
    if (input.name !== undefined) await this.assertUniqueName(tenantId, input.name, id);
    const data: Prisma.AttributeUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.iconKey !== undefined) data.iconKey = input.iconKey;
    if (input.description !== undefined) data.description = input.description;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return responseOf(await this.prisma.attribute.update({ where: { id }, data, select }));
  }

  /** Fasilitas yang masih dipakai proyek tidak dihapus; cukup dinonaktifkan. */
  async remove(id: string, tenantId: string) {
    await this.assertExists(id, tenantId);
    const used = await this.prisma.productAttribute.count({ where: { attributeId: id, tenantId } });
    if (used > 0) throw new Error(`Conflict: fasilitas masih digunakan oleh ${used} proyek. Nonaktifkan saja.`);
    await this.prisma.attribute.delete({ where: { id } });
  }
}
