import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { localStorage } from '../../infrastructure/storage/localStorage.js';
import { checkDealDocuments } from '../deal/dealDocuments.js';
import { isEvidenceGrandfathered } from '../crm/evidenceGrandfathering.js';
import type { DealStageTransitionInput } from '../../presentation/validation/dealStageTransition.js';

export type LeadStageActor = { tenantId: string; userId: string; role?: string | undefined };

const grandfatheredForStage = (
  db: Pick<PrismaClient, 'stage'>,
  tenantId: string,
  lead: { evidenceGrandfatheredStageIds?: unknown },
  target: { id: string; position: number },
) => isEvidenceGrandfathered(db, tenantId, 'lead', lead, target);

function assertDirection(source: { id: string; position: number }, target: { id: string; position: number }) {
  if (source.id === target.id) throw new Error('Lead is already in the selected stage');
  const forward = target.position > source.position;
  if (forward && target.position !== source.position + 1) throw new Error('Lead can only move forward one pipeline stage at a time');
  return forward;
}

/** Perpindahan Lead Pipeline yang memvalidasi evidence dan fase secara atomik. */
export class LeadStageTransitionUseCase {
  constructor(private prisma: PrismaClient, private storage: Pick<typeof localStorage, 'upload' | 'remove' | 'getPublicUrl'> = localStorage) {}

  private leadAccess(actor: LeadStageActor) {
    return actor.role === 'owner' ? {} : { assignedUserId: actor.userId };
  }

  async transition(leadId: string, actor: LeadStageActor, input: DealStageTransitionInput, files: Express.Multer.File[] = []) {
    const initial = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId: actor.tenantId, isDeleted: false, archivedAt: null, ...this.leadAccess(actor) },
      select: { stageId: true, evidenceGrandfatheredStageIds: true, stage: { select: { id: true, position: true } } },
    });
    if (!initial?.stage || !initial.stageId) throw new Error('Lead does not have a current pipeline stage');
    if (initial.stageId !== input.expectedSourceStageId) throw new Error('Lead stage changed; reload and try again');
    const target = await this.prisma.stage.findFirst({
      where: { id: input.targetStageId, tenantId: actor.tenantId, entityType: 'lead', isActive: true },
      select: { id: true, position: true, evidences: { orderBy: { sortOrder: 'asc' }, select: { name: true, fileTypes: true, isRequired: true, paymentMethods: true } } },
    });
    if (!target) throw new Error('Lead pipeline stage not found');
    const forward = assertDirection(initial.stage, target);
    if (!forward && (input.documents.length || files.length)) throw new Error('Evidence is not accepted for a backward stage move');

    const existing = forward ? await this.prisma.attachment.findMany({
      where: { tenantId: actor.tenantId, leadId, documentStageId: target.id, documentName: { not: null } },
      select: { documentName: true },
    }) : [];
    const completed = new Set(existing.flatMap(({ documentName }) => (documentName ? [documentName] : [])));
    const documents = forward && !(await grandfatheredForStage(this.prisma, actor.tenantId, initial, target)) ? checkDealDocuments(
      target.evidences.map((requirement) => ({ ...requirement, isRequired: requirement.isRequired && !completed.has(requirement.name) })),
      'CASH', input.documents, files,
    ) : [];
    const stored = documents.map((item) => ({ ...item, path: `${actor.tenantId}/lead/${leadId}/${randomUUID()}.${item.ext}` }));

    try {
      for (const item of stored) await this.storage.upload(item.path, item.file.buffer);
      return await this.prisma.$transaction(async (tx) => {
        const [current, currentTarget] = await Promise.all([
          tx.lead.findFirst({
            where: { id: leadId, tenantId: actor.tenantId, isDeleted: false, archivedAt: null, ...this.leadAccess(actor) },
            select: { id: true, customerId: true, stageId: true, evidenceGrandfatheredStageIds: true, stage: { select: { id: true, name: true, position: true } } },
          }),
          tx.stage.findFirst({
            where: { id: input.targetStageId, tenantId: actor.tenantId, entityType: 'lead', isActive: true },
            select: { id: true, name: true, position: true, evidences: { orderBy: { sortOrder: 'asc' }, select: { name: true, fileTypes: true, isRequired: true, paymentMethods: true } } },
          }),
        ]);
        if (!current?.stage || !currentTarget) throw new Error('Lead pipeline stage not found');
        if (current.stageId !== input.expectedSourceStageId) throw new Error('Lead stage changed; reload and try again');
        const stillForward = assertDirection(current.stage, currentTarget);
        if (stillForward && !(await grandfatheredForStage(tx, actor.tenantId, current, currentTarget))) {
          const fulfilled = await tx.attachment.findMany({
            where: { tenantId: actor.tenantId, leadId, documentStageId: currentTarget.id, documentName: { not: null } },
            select: { documentName: true },
          });
          const names = new Set(fulfilled.flatMap(({ documentName }) => (documentName ? [documentName] : [])));
          checkDealDocuments(currentTarget.evidences.map((requirement) => ({ ...requirement, isRequired: requirement.isRequired && !names.has(requirement.name) })), 'CASH', input.documents, files);
        }
        const updated = await tx.lead.update({ where: { id: leadId }, data: { stageId: currentTarget.id }, select: { id: true, stageId: true } });
        if (stored.length) await tx.attachment.createMany({ data: stored.map(({ name, file, path }) => ({
          tenantId: actor.tenantId, leadId, documentName: name, documentStageId: currentTarget.id,
          fileName: file.originalname.slice(0, 191), fileUrl: this.storage.getPublicUrl(path).publicUrl,
          fileType: file.mimetype, fileSize: file.size, uploadedById: actor.userId,
        })) });
        await tx.leadActivity.create({ data: {
          tenantId: actor.tenantId, leadId, customerId: current.customerId, actorId: actor.userId, activityType: 'stage_changed',
          notes: { create: { tenantId: actor.tenantId, content: `Fase Lead diubah dari ${current.stage.name} ke ${currentTarget.name}.` } },
        } });
        await tx.auditLog.create({ data: {
          tenantId: actor.tenantId, entityId: leadId, entityType: 'lead', actorId: actor.userId, action: 'stage_changed',
          changes: { stageId: { old: current.stageId, new: currentTarget.id }, evidenceNames: stored.map(({ name }) => name) },
        } });
        return updated;
      }, { isolationLevel: 'ReadCommitted' });
    } catch (error) {
      await this.storage.remove(stored.map(({ path }) => path));
      throw error;
    }
  }
}
