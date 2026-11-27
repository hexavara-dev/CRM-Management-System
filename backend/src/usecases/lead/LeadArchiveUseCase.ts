import type { LeadArchiveCategory, Prisma, PrismaClient } from '@prisma/client';

type Filters = {
  page: number; limit: number; search?: string | undefined; category?: LeadArchiveCategory | undefined;
  projectId?: string | undefined; sourceId?: string | undefined; assignedUserId?: string | undefined; from?: Date | undefined; to?: Date | undefined; direction: 'asc' | 'desc';
};

const userSelect = { id: true, name: true, email: true, role: true, createdAt: true } as const;
const include = {
  customer: { select: { firstName: true, lastName: true, phoneNumber: true } },
  project: { select: { id: true, name: true, code: true } },
  source: { select: { id: true, name: true, color: true } },
  stage: { select: { id: true, name: true, color: true } },
  assignedUser: { select: userSelect },
  archivedBy: { select: userSelect },
  _count: { select: { deals: true } },
} satisfies Prisma.LeadInclude;

export class LeadArchiveUseCase {
  constructor(private prisma: PrismaClient) {}

  private scope(tenantId: string, role?: string, userId?: string): Prisma.LeadWhereInput {
    return { tenantId, isDeleted: false, ...(role && role !== 'owner' && userId ? { assignedUserId: userId } : {}) };
  }

  private async requireArchived(tx: Prisma.TransactionClient, id: string, tenantId: string, role?: string, userId?: string) {
    const lead = await tx.lead.findFirst({ where: { id, ...this.scope(tenantId, role, userId), archivedAt: { not: null } }, select: { id: true, customerId: true, archiveCategory: true, archiveReason: true } });
    if (!lead) throw new Error('Archived Lead not found');
    return lead;
  }

  private async history(tx: Prisma.TransactionClient, lead: { id: string; customerId: string }, tenantId: string, actorId: string | undefined, activityType: string, action: string, changes: Prisma.InputJsonValue) {
    await Promise.all([
      tx.leadActivity.create({ data: { tenantId, leadId: lead.id, customerId: lead.customerId, actorId: actorId ?? null, activityType } }),
      tx.auditLog.create({ data: { tenantId, entityId: lead.id, entityType: 'lead', actorId: actorId ?? null, action, changes } }),
    ]);
  }

  async list(tenantId: string, filters: Filters, role?: string, userId?: string) {
    const period = filters.from || filters.to ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } : undefined;
    const where: Prisma.LeadWhereInput = {
      ...this.scope(tenantId, role, userId), archivedAt: { not: null, ...period },
      ...(filters.category ? { archiveCategory: filters.category } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
      ...(filters.assignedUserId ? { assignedUserId: filters.assignedUserId } : {}),
      ...(filters.search ? { OR: [
        { customer: { is: { firstName: { contains: filters.search } } } },
        { customer: { is: { lastName: { contains: filters.search } } } },
        { customer: { is: { phoneNumber: { contains: filters.search } } } },
      ] } : {}),
    };
    const summaryWhere = { ...this.scope(tenantId, role, userId), archivedAt: { not: null } };
    const [rows, total, groups] = await Promise.all([
      this.prisma.lead.findMany({ where, include, orderBy: { archivedAt: filters.direction }, skip: (filters.page - 1) * filters.limit, take: filters.limit }),
      this.prisma.lead.count({ where }),
      this.prisma.lead.groupBy({ by: ['archiveCategory'], where: summaryWhere, _count: { _all: true } }),
    ]);
    const summary = { total: 0, notRespond: 0, invalid: 0, notQualified: 0, dealLost: 0 };
    for (const group of groups) {
      const count = group._count._all; summary.total += count;
      if (group.archiveCategory === 'NOT_RESPOND') summary.notRespond = count;
      if (group.archiveCategory === 'INVALID') summary.invalid = count;
      if (group.archiveCategory === 'NOT_QUALIFIED') summary.notQualified = count;
      if (group.archiveCategory === 'DEAL_LOST') summary.dealLost = count;
    }
    return { data: rows.map(({ _count, ...row }) => ({ ...row, name: [row.customer.firstName, row.customer.lastName].filter(Boolean).join(' '), hasDeals: _count.deals > 0 })), meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) }, summary };
  }

  async archive(id: string, tenantId: string, actorId: string | undefined, input: { category: LeadArchiveCategory; reason?: string | null }, role?: string) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id, ...this.scope(tenantId, role, actorId), archivedAt: null }, select: { id: true, customerId: true } });
      if (!lead) throw new Error('Active Lead not found');
      const archivedAt = new Date(); const reason = input.reason?.trim() || null;
      const updated = await tx.lead.update({ where: { id }, data: { archiveCategory: input.category, archiveReason: reason, archivedAt, ...(actorId ? { archivedBy: { connect: { id: actorId } } } : {}) } });
      await this.history(tx, lead, tenantId, actorId, 'archive', 'archive', { category: input.category, reason, archivedAt: archivedAt.toISOString() });
      return updated;
    });
  }

  private async reactivateInTransaction(tx: Prisma.TransactionClient, id: string, tenantId: string, actorId?: string, role?: string) {
    const lead = await this.requireArchived(tx, id, tenantId, role, actorId);
    if (lead.archiveCategory === 'DEAL_LOST') throw new Error('A Lead from a Lost Deal cannot be reactivated directly');
    const updated = await tx.lead.update({ where: { id }, data: { archiveCategory: null, archiveReason: null, archivedAt: null, archivedBy: { disconnect: true } } });
    await this.history(tx, lead, tenantId, actorId, 'reactivation', 'reactivate', { category: lead.archiveCategory, reason: lead.archiveReason });
    return updated;
  }

  async reactivate(id: string, tenantId: string, actorId?: string, role?: string) {
    return this.prisma.$transaction((tx) => this.reactivateInTransaction(tx, id, tenantId, actorId, role));
  }

  private async categoryInTransaction(tx: Prisma.TransactionClient, id: string, tenantId: string, actorId: string | undefined, input: { category: LeadArchiveCategory; reason?: string | null }, role?: string) {
    const lead = await this.requireArchived(tx, id, tenantId, role, actorId); const reason = input.reason?.trim() || null;
    if (lead.archiveCategory === 'DEAL_LOST' || input.category === 'DEAL_LOST') throw new Error('Deal Lost is managed by the Lost Deal workflow');
    const updated = await tx.lead.update({ where: { id }, data: { archiveCategory: input.category, archiveReason: reason } });
    await this.history(tx, lead, tenantId, actorId, 'archive-category-change', 'archive-category-change', { oldCategory: lead.archiveCategory, newCategory: input.category, oldReason: lead.archiveReason, newReason: reason });
    return updated;
  }

  async changeCategory(id: string, tenantId: string, actorId: string | undefined, input: { category: LeadArchiveCategory; reason?: string | null }, role?: string) {
    return this.prisma.$transaction((tx) => this.categoryInTransaction(tx, id, tenantId, actorId, input, role));
  }

  async permanentDelete(ids: string[], tenantId: string, role?: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.lead.findMany({ where: { id: { in: ids }, ...this.scope(tenantId, role, userId), archivedAt: { not: null } }, select: { id: true } });
      if (rows.length !== ids.length) throw new Error('One or more archived Leads were not found');
      const linkedDealCount = await tx.deal.count({ where: { tenantId, leadId: { in: ids } } });
      if (linkedDealCount > 0) {
        throw new Error('Lead with an existing Deal cannot be permanently deleted');
      }
      await tx.lead.deleteMany({ where: { id: { in: ids }, tenantId, archivedAt: { not: null } } });
      return { count: rows.length };
    });
  }

  async bulkReactivate(ids: string[], tenantId: string, actorId?: string, role?: string) {
    return this.prisma.$transaction(async (tx) => { for (const id of ids) await this.reactivateInTransaction(tx, id, tenantId, actorId, role); return { count: ids.length }; });
  }

  async bulkChangeCategory(ids: string[], tenantId: string, actorId: string | undefined, input: { category: LeadArchiveCategory; reason?: string | null }, role?: string) {
    return this.prisma.$transaction(async (tx) => { for (const id of ids) await this.categoryInTransaction(tx, id, tenantId, actorId, input, role); return { count: ids.length }; });
  }
}
