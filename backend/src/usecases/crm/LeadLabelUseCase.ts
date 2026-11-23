import { Prisma, type LeadLabelType, type PrismaClient } from '@prisma/client';

export type LeadLabelInput = {
  type?: LeadLabelType;
  name?: string;
  color?: string;
  icon?: string;
  description?: string | null;
  isRequired?: boolean;
  isActive?: boolean;
};

export type LeadLabelFilters = { type?: LeadLabelType; page: number; limit: number };

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** Label lead (Temperature dan Tags) milik satu company. */
export class LeadLabelUseCase {
  constructor(private prisma: PrismaClient) {}

  async list(tenantId: string, filters: LeadLabelFilters) {
    const where: Prisma.LeadLabelWhereInput = { tenantId, ...(filters.type ? { type: filters.type } : {}) };
    const [data, total, grouped] = await Promise.all([
      this.prisma.leadLabel.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.leadLabel.count({ where }),
      this.prisma.leadLabel.groupBy({ by: ['type'], where: { tenantId }, _count: { _all: true } }),
    ]);
    const counts: Record<LeadLabelType, number> = { TEMPERATURE: 0, TAG: 0 };
    for (const row of grouped) counts[row.type] = row._count._all;
    return {
      data,
      meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) },
      counts,
    };
  }

  private async find(id: string, tenantId: string) {
    const label = await this.prisma.leadLabel.findFirst({ where: { id, tenantId } });
    if (!label) throw new Error('Lead label not found');
    return label;
  }

  private assertRequiredFlag(type: LeadLabelType, isRequired: boolean | undefined) {
    if (type === 'TAG' && isRequired) throw new Error('isRequired is only supported for temperature labels');
  }

  private duplicate(name: string | undefined) {
    return new Error(`Lead label "${name}" already exists`);
  }

  async create(tenantId: string, input: LeadLabelInput) {
    const type = input.type as LeadLabelType;
    this.assertRequiredFlag(type, input.isRequired);
    const last = await this.prisma.leadLabel.findFirst({
      where: { tenantId, type },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    try {
      return await this.prisma.leadLabel.create({
        data: {
          tenantId,
          type,
          name: input.name as string,
          color: (input.color as string).toUpperCase(),
          icon: input.icon as string,
          description: input.description ?? null,
          isRequired: type === 'TEMPERATURE' ? (input.isRequired ?? false) : false,
          isActive: input.isActive ?? true,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw this.duplicate(input.name);
      throw error;
    }
  }

  async update(id: string, tenantId: string, input: LeadLabelInput) {
    const label = await this.find(id, tenantId);
    this.assertRequiredFlag(label.type, input.isRequired);
    const data: Prisma.LeadLabelUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.color !== undefined) data.color = input.color.toUpperCase();
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.description !== undefined) data.description = input.description;
    if (input.isRequired !== undefined) data.isRequired = input.isRequired;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    try {
      return await this.prisma.leadLabel.update({ where: { id: label.id }, data });
    } catch (error) {
      if (isUniqueViolation(error)) throw this.duplicate(input.name);
      throw error;
    }
  }

  /**
   * Label yang sudah dipakai Lead tidak boleh dihapus. Relasi ke Lead belum ada,
   * jadi pengecekan pemakaian ditambahkan bersama fitur pemasangan label.
   */
  async remove(id: string, tenantId: string) {
    const label = await this.find(id, tenantId);
    const used = await this.prisma.lead.count({ where: { tenantId, temperatureLabelId: label.id } });
    if (used > 0) {
      throw new Error(`Lead label is used by ${used} leads and cannot be deleted; deactivate it instead (conflict)`);
    }
    await this.prisma.leadLabel.delete({ where: { id: label.id } });
  }
}
