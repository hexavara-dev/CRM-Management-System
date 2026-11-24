import type { Prisma, PrismaClient } from '@prisma/client';
import type { IRepository } from '../../domain/repositories/IRepository.js';
import type { CreateDealDTO, UpdateDealDTO } from '../../presentation/dtos/DealDTO.js';

const DEAL_INCLUDE = {
  lead: { include: { customer: { include: { organization: true } }, source: true } }, stage: true, status: true,
  assignedUser: { select: { id: true, tenantId: true, email: true, name: true, role: true, createdAt: true } },
  unit: { include: { variant: { include: { product: { select: { id: true, name: true, code: true } } } }, typeVariant: true } },
  financingBank: true,
} satisfies Prisma.DealInclude;

export type DealListFilters = { stageId?: string | undefined; assignedUserId?: string | undefined; paymentMethod?: 'CASH' | 'KPR' | 'KPR_SHARIA' | undefined; bankName?: string | undefined; projectId?: string | undefined; startDate?: Date | undefined; endDate?: Date | undefined };

export class DealUseCases {
  constructor(private dealRepository: IRepository<any>, private dealActivityRepository?: IRepository<any>, private leadRepository?: IRepository<any>, private userRepository?: IRepository<any>, private stageRepository?: IRepository<any>, private statusRepository?: IRepository<any>, private prisma?: PrismaClient) {}

  private assertPayment(dto: Pick<CreateDealDTO | UpdateDealDTO, 'paymentMethod' | 'bankName' | 'financingBankId'>) {
    if (dto.paymentMethod === 'CASH' && (dto.bankName || dto.financingBankId)) throw new Error('Bank must be empty for cash payment');
    if ((dto.paymentMethod === 'KPR' || dto.paymentMethod === 'KPR_SHARIA') && !dto.bankName?.trim() && !dto.financingBankId) throw new Error('Bank is required for KPR payment');
  }

  private async validateRelations(dto: CreateDealDTO | UpdateDealDTO, tenantId: string) {
    const [lead, assignedUser, stage, status, unit, financingBank] = await Promise.all([
      dto.leadId && this.leadRepository ? this.leadRepository.findOne({ id: dto.leadId, tenantId, isDeleted: false }) : undefined,
      dto.assignedUserId && this.userRepository ? this.userRepository.findOne({ id: dto.assignedUserId, tenantId }) : undefined,
      dto.stageId && this.stageRepository ? this.stageRepository.findOne({ id: dto.stageId, tenantId, entityType: 'deal' }) : undefined,
      dto.statusId && this.statusRepository ? this.statusRepository.findOne({ id: dto.statusId, tenantId, type: 'deal' }) : undefined,
      dto.unitId && this.prisma ? this.prisma.productUnit.findFirst({ where: { id: dto.unitId, tenantId }, select: { id: true } }) : undefined,
      dto.financingBankId && this.prisma ? this.prisma.financingBank.findFirst({ where: { id: dto.financingBankId, tenantId, isActive: true }, select: { id: true } }) : undefined,
    ]);
    if (dto.leadId && this.leadRepository && !lead) throw new Error('Lead not found');
    if (dto.assignedUserId && this.userRepository && !assignedUser) throw new Error('Assigned user not found');
    if (dto.stageId && this.stageRepository && !stage) throw new Error('Stage not found');
    if (dto.statusId && this.statusRepository && !status) throw new Error('Deal status not found');
    if (dto.unitId && this.prisma && !unit) throw new Error('Unit not found');
    if (dto.financingBankId && this.prisma && !financingBank) throw new Error('Financing bank not found');
    this.assertPayment(dto);
  }

  async createDeal(dto: CreateDealDTO) {
    if (!dto.tenantId || !this.prisma) throw new Error('Tenant context missing');
    await this.validateRelations(dto, dto.tenantId);
    const defaultStage = dto.stageId || !this.prisma.stage?.findFirst ? null : await this.prisma.stage.findFirst({ where: { tenantId: dto.tenantId, entityType: 'deal', isDefaultStage: true, isActive: true }, select: { id: true } });
    const financingBank = dto.financingBankId ? await this.prisma.financingBank.findFirst({ where: { id: dto.financingBankId, tenantId: dto.tenantId }, select: { name: true } }) : null;
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({ data: { tenantId: dto.tenantId, leadId: dto.leadId ?? null, assignedUserId: dto.assignedUserId ?? null, stageId: dto.stageId ?? defaultStage?.id ?? null, statusId: dto.statusId ?? null, refCode: dto.refCode ?? null, dealType: dto.dealType ?? null, expectedAmount: dto.expectedAmount ?? null, amount: dto.expectedAmount ?? null, currency: dto.currency || 'IDR', expectedClosingDate: dto.expectedClosingDate ?? null, unitId: dto.unitId ?? null, paymentMethod: dto.paymentMethod ?? 'CASH', bankName: dto.paymentMethod === 'CASH' ? null : financingBank?.name ?? dto.bankName?.trim() ?? null, notes: dto.notes ?? null, financingBankId: dto.financingBankId ?? null } });
      await tx.dealActivity.create({ data: { tenantId: dto.tenantId, dealId: deal.id, activityType: 'deal_created' } });
      await tx.auditLog.create({ data: { tenantId: dto.tenantId, entityId: deal.id, entityType: 'deal', action: 'deal_created', changes: { leadId: dto.leadId ?? null, stageId: deal.stageId } } });
      return deal;
    });
  }

  async getDeal(id: string, tenantId?: string) {
    if (!tenantId) throw new Error('Tenant context missing');
    if (!this.prisma) {
      const deal = await this.dealRepository.findOne({ id, tenantId });
      if (!deal) throw new Error('Deal not found');
      return deal;
    }
    const deal = await this.prisma.deal.findFirst({ where: { id, tenantId }, include: { ...DEAL_INCLUDE, activities: { include: { notes: true, tasks: true, callLogs: true }, orderBy: { createdAt: 'desc' } }, attachments: true, payments: { include: { recordedBy: { select: { id: true, name: true, email: true } } }, orderBy: [{ type: 'asc' }, { createdAt: 'asc' }] }, lostRequests: { include: { requestedBy: { select: { id: true, name: true, email: true } }, reviewedBy: { select: { id: true, name: true, email: true } } }, orderBy: { requestedAt: 'desc' } } } });
    if (!deal) throw new Error('Deal not found');
    return { ...deal, payments: deal.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })) };
  }

  async getAllDeals(tenantId: string, page = 1, limit = 10, filters: DealListFilters = {}, search?: string) {
    if (!this.prisma) throw new Error('Database client is required');
    const where: Prisma.DealWhereInput = { tenantId, ...(filters.stageId ? { stageId: filters.stageId } : {}), ...(filters.assignedUserId ? { assignedUserId: filters.assignedUserId } : {}), ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}), ...(filters.bankName ? { bankName: filters.bankName } : {}), ...(filters.projectId ? { unit: { is: { variant: { is: { productId: filters.projectId } } } } } : {}), ...((filters.startDate || filters.endDate) ? { createdAt: { ...(filters.startDate ? { gte: filters.startDate } : {}), ...(filters.endDate ? { lte: filters.endDate } : {}) } } : {}), ...(search ? { OR: [{ lead: { is: { customer: { is: { firstName: { contains: search } } } } } }, { lead: { is: { customer: { is: { lastName: { contains: search } } } } } }, { lead: { is: { customer: { is: { phoneNumber: { contains: search } } } } } }] } : {}) };
    const [data, total, summary, lastActivities] = await Promise.all([
      this.prisma.deal.findMany({ where, skip: (page - 1) * limit, take: limit, include: DEAL_INCLUDE, orderBy: { createdAt: 'desc' } }), this.prisma.deal.count({ where }),
      this.prisma.deal.findMany({ where, select: { expectedAmount: true, amount: true, status: { select: { isClosingStatus: true, isFailedStatus: true } } } }),
      this.prisma.dealActivity.groupBy({ by: ['dealId'], where: { tenantId, deal: where }, _max: { createdAt: true } }),
    ]);
    const lastByDeal = new Map(lastActivities.map((row) => [row.dealId, row._max.createdAt]));
    const totals = summary.reduce((acc, deal) => { const amount = Number(deal.amount ?? 0); const expected = Number(deal.expectedAmount ?? deal.amount ?? 0); acc.totalDeals++; if (deal.status?.isClosingStatus) { acc.wonDeals++; acc.wonValue += amount; } else if (deal.status?.isFailedStatus) { acc.lostDeals++; acc.lostValue += amount; } else { acc.openDeals++; acc.estimatedValue += expected; } return acc; }, { totalDeals: 0, openDeals: 0, estimatedValue: 0, wonDeals: 0, wonValue: 0, lostDeals: 0, lostValue: 0 });
    return { data: data.map((deal) => ({ ...deal, lastActivityAt: lastByDeal.get(deal.id) ?? deal.createdAt })), meta: { total, page, limit, totalPages: Math.ceil(total / limit) }, summary: totals };
  }

  async updateDeal(id: string, dto: UpdateDealDTO, tenantId?: string, actorId?: string) {
    const before = await this.getDeal(id, tenantId); if (!tenantId) throw new Error('Tenant context missing'); await this.validateRelations(dto, tenantId);
    const data: Prisma.DealUncheckedUpdateInput = {}; const fields: (keyof UpdateDealDTO)[] = ['amount', 'leadId', 'assignedUserId', 'stageId', 'statusId', 'dealType', 'expectedAmount', 'currency', 'expectedClosingDate', 'closingDate', 'lostReason', 'lostNotes', 'unitId', 'paymentMethod', 'bankName', 'notes', 'financingBankId'];
    for (const key of fields) if (dto[key] !== undefined) (data as Record<string, unknown>)[key] = dto[key];
    if (dto.paymentMethod === 'CASH') { data.bankName = null; data.financingBankId = null; }
    if (dto.bankName !== undefined && dto.bankName !== null) data.bankName = dto.bankName.trim() || null;
    if (dto.financingBankId) {
      const bank = await this.prisma?.financingBank.findFirst({ where: { id: dto.financingBankId, tenantId }, select: { name: true } });
      if (bank) data.bankName = bank.name;
    } else if (dto.financingBankId === null) {
      data.bankName = null;
    }
    if (!this.prisma) return this.dealRepository.update(id, data);
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    for (const key of Object.keys(data)) {
      const oldValue = (before as Record<string, unknown>)[key];
      const newValue = (data as Record<string, unknown>)[key];
      if (oldValue !== newValue) changes[key] = { old: oldValue ?? null, new: newValue ?? null };
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deal.update({ where: { id }, data, include: DEAL_INCLUDE });
      if (dto.stageId !== undefined && dto.stageId !== before.stageId) {
        await tx.dealActivity.create({ data: { tenantId, dealId: id, actorId: actorId ?? null, activityType: 'stage_changed', notes: { create: { content: `Fase Deal diubah dari ${before.stage?.name ?? '-'} ke ${updated.stage?.name ?? '-'}.` } } } });
      }
      if (Object.keys(changes).length > 0) await tx.auditLog.create({ data: { tenantId, entityId: id, entityType: 'deal', actorId: actorId ?? null, action: dto.stageId !== undefined && dto.stageId !== before.stageId ? 'stage_changed' : 'update', changes: changes as Prisma.InputJsonValue } });
      return updated;
    });
  }

  async deleteDeal(id: string, tenantId?: string) {
    const deal = await this.getDeal(id, tenantId);
    if (!tenantId) throw new Error('Tenant context missing');
    if (!this.prisma) return this.dealRepository.delete(id);

    await this.prisma.$transaction(async (tx) => {
      // Inventory records are historical evidence and must survive a Deal deletion.
      await tx.record.updateMany({ where: { dealId: id, deal: { tenantId } }, data: { dealId: null } });
      // Attachment rows are owned by the Deal. File lifecycle cleanup remains the
      // responsibility of the configured upload storage, as in other CRUD flows.
      await tx.attachment.deleteMany({ where: { dealId: id, tenantId } });
      const removed = await tx.deal.deleteMany({ where: { id, tenantId } });
      if (removed.count !== 1) throw new Error('Deal not found');
    });

    return deal;
  }
}
