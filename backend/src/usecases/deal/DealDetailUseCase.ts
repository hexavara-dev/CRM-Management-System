import type {
  DealLostRequestStatus,
  DealPaymentStatus,
  DealPaymentType,
  PrismaClient,
} from '@prisma/client';
import { lockDeal, syncDealUnit } from './dealUnit.js';

export type DealActor = { tenantId: string; userId: string };

export type PaymentInput = {
  type: DealPaymentType;
  amount: number;
  status?: DealPaymentStatus;
  dueDate?: Date | null;
  paidAt?: Date | null;
  notes?: string | null;
};

const publicUser = { id: true, name: true, email: true } as const;

export class DealDetailUseCase {
  constructor(private prisma: PrismaClient) {}

  private async requireDeal(dealId: string, tenantId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, tenantId },
      select: { id: true, leadId: true, statusId: true, status: { select: { isFailedStatus: true } } },
    });
    if (!deal) throw new Error('Deal not found');
    return deal;
  }

  async history(dealId: string, tenantId: string) {
    await this.requireDeal(dealId, tenantId);
    return this.prisma.auditLog.findMany({
      where: { tenantId, entityId: dealId, entityType: 'deal' },
      include: { actor: { select: publicUser } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async payments(dealId: string, tenantId: string) {
    await this.requireDeal(dealId, tenantId);
    const payments = await this.prisma.dealPayment.findMany({
      where: { tenantId, dealId },
      include: { recordedBy: { select: publicUser } },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
    return payments.map((payment) => ({ ...payment, amount: Number(payment.amount) }));
  }

  async createPayment(dealId: string, actor: DealActor, input: PaymentInput) {
    await this.requireDeal(dealId, actor.tenantId);
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.dealPayment.create({
        data: {
          tenantId: actor.tenantId,
          dealId,
          type: input.type,
          amount: BigInt(input.amount),
          status: input.status ?? 'PENDING',
          dueDate: input.dueDate ?? null,
          paidAt: input.status === 'PAID' ? input.paidAt ?? new Date() : input.paidAt ?? null,
          notes: input.notes?.trim() || null,
          recordedById: actor.userId,
        },
        include: { recordedBy: { select: publicUser } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          entityId: dealId,
          entityType: 'deal',
          actorId: actor.userId,
          action: 'payment_added',
          changes: { paymentId: payment.id, type: payment.type, amount: input.amount, status: payment.status },
        },
      });
      return { ...payment, amount: Number(payment.amount) };
    });
  }

  async updatePayment(
    dealId: string,
    paymentId: string,
    actor: DealActor,
    input: Partial<PaymentInput>
  ) {
    await this.requireDeal(dealId, actor.tenantId);
    const existing = await this.prisma.dealPayment.findFirst({
      where: { id: paymentId, dealId, tenantId: actor.tenantId },
    });
    if (!existing) throw new Error('Deal payment not found');

    const status = input.status ?? existing.status;
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.dealPayment.update({
        where: { id: paymentId },
        data: {
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.amount !== undefined ? { amount: BigInt(input.amount) } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
          ...(input.paidAt !== undefined
            ? { paidAt: input.paidAt }
            : status === 'PAID' && !existing.paidAt
              ? { paidAt: new Date() }
              : status !== 'PAID'
                ? { paidAt: null }
                : {}),
          ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        },
        include: { recordedBy: { select: publicUser } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          entityId: dealId,
          entityType: 'deal',
          actorId: actor.userId,
          action: 'payment_updated',
          changes: {
            paymentId,
            old: { type: existing.type, amount: Number(existing.amount), status: existing.status },
            new: { type: payment.type, amount: Number(payment.amount), status: payment.status },
          },
        },
      });
      return { ...payment, amount: Number(payment.amount) };
    });
  }

  async lostRequests(dealId: string, tenantId: string) {
    await this.requireDeal(dealId, tenantId);
    return this.prisma.dealLostRequest.findMany({
      where: { tenantId, dealId },
      include: {
        requestedBy: { select: publicUser },
        reviewedBy: { select: publicUser },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async requestLost(dealId: string, actor: DealActor, reason: string, chronology: string) {
    const deal = await this.requireDeal(dealId, actor.tenantId);
    if (deal.status?.isFailedStatus) throw new Error('Deal is already Lost');

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.dealLostRequest.create({
        data: {
          tenantId: actor.tenantId,
          dealId,
          reason: reason.trim(),
          chronology: chronology.trim(),
          previousStatusId: deal.statusId,
          requestedById: actor.userId,
        },
        include: { requestedBy: { select: publicUser }, reviewedBy: { select: publicUser } },
      });
      await tx.dealActivity.create({
        data: {
          tenantId: actor.tenantId,
          dealId,
          actorId: actor.userId,
          activityType: 'lost_requested',
          notes: { create: { tenantId: actor.tenantId, content: `Pengajuan Lost: ${reason.trim()}` } },
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          entityId: dealId,
          entityType: 'deal',
          actorId: actor.userId,
          action: 'lost_requested',
          changes: { requestId: request.id, reason: request.reason, status: 'PENDING' },
        },
      });
      return request;
    });
  }

  async reviewLost(
    dealId: string,
    requestId: string,
    actor: DealActor,
    decision: Extract<DealLostRequestStatus, 'APPROVED' | 'REJECTED'>,
    reviewNotes?: string
  ) {
    const deal = await this.requireDeal(dealId, actor.tenantId);
    const request = await this.prisma.dealLostRequest.findFirst({
      where: { id: requestId, dealId, tenantId: actor.tenantId, status: 'PENDING' },
    });
    if (!request) throw new Error('Pending Lost request not found');
    if (request.requestedById === actor.userId) {
      throw new Error('Lost request cannot be reviewed by its requester');
    }

    const lostStatus =
      decision === 'APPROVED'
        ? await this.prisma.status.findFirst({
            where: { tenantId: actor.tenantId, type: 'deal', isFailedStatus: true },
            select: { id: true },
          })
        : null;
    if (decision === 'APPROVED' && !lostStatus) {
      throw new Error('No Lost Deal status configured');
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.dealLostRequest.updateMany({
        where: { id: requestId, dealId, tenantId: actor.tenantId, status: 'PENDING' },
        data: {
          status: decision,
          activeGuard: null,
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes?.trim() || null,
        },
      });
      if (claimed.count !== 1) throw new Error('Lost request conflict');

      if (decision === 'APPROVED') {
        // Deal Lost tidak lagi memegang unit.
        await syncDealUnit(tx, actor.tenantId, await lockDeal(tx, dealId, actor.tenantId), null);
        await tx.deal.update({
          where: { id: dealId },
          data: {
            statusId: lostStatus!.id,
            lostReason: request.reason,
            lostNotes: request.chronology,
            closingDate: new Date(),
          },
        });
        if (deal.leadId) {
          const lead = await tx.lead.findFirst({
            where: { id: deal.leadId, tenantId: actor.tenantId, isDeleted: false },
            select: { id: true, customerId: true, archivedAt: true },
          });
          if (lead) {
            const archivedAt = lead.archivedAt ?? new Date();
            await tx.lead.update({
              where: { id: lead.id },
              data: {
                archiveCategory: 'DEAL_LOST',
                archiveReason: request.reason.slice(0, 500),
                archivedAt,
                archivedById: actor.userId,
              },
            });
            await tx.leadActivity.create({
              data: {
                tenantId: actor.tenantId,
                leadId: lead.id,
                customerId: lead.customerId,
                actorId: actor.userId,
                activityType: 'archive',
                notes: { create: { tenantId: actor.tenantId, content: `Diarsipkan karena Deal Lost: ${request.reason}` } },
              },
            });
            await tx.auditLog.create({
              data: {
                tenantId: actor.tenantId,
                entityId: lead.id,
                entityType: 'lead',
                actorId: actor.userId,
                action: 'archive',
                changes: { category: 'DEAL_LOST', reason: request.reason, dealId, archivedAt: archivedAt.toISOString() },
              },
            });
          }
        }
      }

      await tx.dealActivity.create({
        data: {
          tenantId: actor.tenantId,
          dealId,
          actorId: actor.userId,
          activityType: decision === 'APPROVED' ? 'lost_approved' : 'lost_rejected',
          notes: {
            create: {
              tenantId: actor.tenantId,
              content:
                decision === 'APPROVED'
                  ? 'Pengajuan Lost disetujui.'
                  : `Pengajuan Lost ditolak${reviewNotes?.trim() ? `: ${reviewNotes.trim()}` : '.'}`,
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          entityId: dealId,
          entityType: 'deal',
          actorId: actor.userId,
          action: decision === 'APPROVED' ? 'lost_approved' : 'lost_rejected',
          changes: { requestId, status: decision, reviewNotes: reviewNotes?.trim() || null },
        },
      });

      return tx.dealLostRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: { requestedBy: { select: publicUser }, reviewedBy: { select: publicUser } },
      });
    }, { isolationLevel: 'ReadCommitted' });
  }
}
