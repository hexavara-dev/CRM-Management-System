import { randomUUID } from 'node:crypto';
import type { DealPaymentMethod, PrismaClient } from '@prisma/client';
import { localStorage } from '../../infrastructure/storage/localStorage.js';
import type { DealStageTransitionInput } from '../../presentation/validation/dealStageTransition.js';
import { isEvidenceGrandfathered } from '../crm/evidenceGrandfathering.js';
import { checkDealDocuments, type DocumentRequirement } from './dealDocuments.js';
import { dealUnitSelect, lockDeal, syncDealUnit } from './dealUnit.js';

export type DealStageActor = { tenantId: string; userId: string };

type StageState = {
  id: string;
  name: string;
  position: number;
  isWonStage: boolean;
  evidences: DocumentRequirement[];
};

const grandfatheredForStage = (
  db: Pick<PrismaClient, 'stage'>,
  tenantId: string,
  deal: { evidenceGrandfatheredStageIds?: unknown },
  target: { id: string; position: number },
) => isEvidenceGrandfathered(db, tenantId, 'deal', deal, target);

function assertDirection(source: { id: string; position: number }, target: { id: string; position: number }) {
  if (source.id === target.id) throw new Error('Deal is already in the selected stage');
  const forward = target.position > source.position;
  if (forward && target.position !== source.position + 1) {
    throw new Error('Deal can only move forward one stage at a time');
  }
  if (!forward && target.position >= source.position) throw new Error('Invalid Deal stage order');
  return forward;
}

/**
 * Satu-satunya jalur perubahan fase Deal. Evidence, status Won, unit, activity,
 * dan audit diselesaikan bersama agar aturan konfigurasi tidak dapat dilewati.
 */
export class DealStageTransitionUseCase {
  constructor(
    private prisma: PrismaClient,
    private storage: typeof localStorage = localStorage
  ) {}

  private async state(dealId: string, tenantId: string, targetStageId: string) {
    const [deal, target] = await Promise.all([
      this.prisma.deal.findFirst({
        where: { id: dealId, tenantId },
        select: {
          id: true,
          stageId: true,
          evidenceGrandfatheredStageIds: true,
          paymentMethod: true,
          status: { select: { isClosingStatus: true, isFailedStatus: true } },
          stage: { select: { id: true, name: true, position: true } },
        },
      }),
      this.prisma.stage.findFirst({
        where: { id: targetStageId, tenantId, entityType: 'deal', isActive: true },
        select: {
          id: true,
          name: true,
          position: true,
          isWonStage: true,
          evidences: {
            orderBy: { sortOrder: 'asc' },
            select: { name: true, fileTypes: true, isRequired: true, paymentMethods: true },
          },
        },
      }),
    ]);
    if (!deal) throw new Error('Deal not found');
    if (!deal.stage || !deal.stageId) throw new Error('Deal does not have a current pipeline stage');
    if (!target) throw new Error('Target Deal stage not found');
    if (deal.status?.isFailedStatus) throw new Error('Lost Deal cannot be moved through the pipeline');
    return { deal, source: deal.stage, target: target as StageState };
  }

  private async checkedDocuments(
    dealId: string,
    tenantId: string,
    target: StageState,
    paymentMethod: DealPaymentMethod,
    input: DealStageTransitionInput,
    files: Express.Multer.File[]
  ) {
    const existing = await this.prisma.attachment.findMany({
      where: { tenantId, dealId, documentStageId: target.id, documentName: { not: null } },
      select: { documentName: true },
    });
    const completed = new Set(existing.flatMap(({ documentName }) => documentName ? [documentName] : []));
    const requirements = target.evidences.map((requirement) => ({
      ...requirement,
      isRequired: requirement.isRequired && !completed.has(requirement.name),
    }));
    return checkDealDocuments(requirements, paymentMethod, input.documents, files);
  }

  async transition(
    dealId: string,
    actor: DealStageActor,
    input: DealStageTransitionInput,
    files: Express.Multer.File[] = []
  ) {
    const initial = await this.state(dealId, actor.tenantId, input.targetStageId);
    if (initial.deal.stageId !== input.expectedSourceStageId) throw new Error('Deal stage changed; reload and try again');
    const forward = assertDirection(initial.source, initial.target);
    if (!forward && (input.documents.length || files.length)) throw new Error('Evidence is not accepted for a backward stage move');
    const documents = forward && !(await grandfatheredForStage(this.prisma, actor.tenantId, initial.deal, initial.target))
      ? await this.checkedDocuments(dealId, actor.tenantId, initial.target, initial.deal.paymentMethod, input, files)
      : [];
    const stored = documents.map((item) => ({
      ...item,
      path: `${actor.tenantId}/deal/${dealId}/${randomUUID()}.${item.ext}`,
    }));

    try {
      for (const item of stored) await this.storage.upload(item.path, item.file.buffer);

      return await this.prisma.$transaction(async (tx) => {
        const before = await lockDeal(tx, dealId, actor.tenantId);
        if (before.stageId !== input.expectedSourceStageId) throw new Error('Deal stage changed; reload and try again');
        const [current, target] = await Promise.all([
          tx.deal.findFirst({
            where: { id: dealId, tenantId: actor.tenantId },
            select: {
              stageId: true,
              evidenceGrandfatheredStageIds: true,
              statusId: true,
              closingDate: true,
              paymentMethod: true,
              status: { select: { isClosingStatus: true, isFailedStatus: true } },
              stage: { select: { id: true, name: true, position: true } },
            },
          }),
          tx.stage.findFirst({
            where: { id: input.targetStageId, tenantId: actor.tenantId, entityType: 'deal', isActive: true },
            select: {
              id: true,
              name: true,
              position: true,
              isWonStage: true,
              evidences: {
                orderBy: { sortOrder: 'asc' },
                select: { name: true, fileTypes: true, isRequired: true, paymentMethods: true },
              },
            },
          }),
        ]);
        if (!current?.stage || !target) throw new Error('Deal pipeline stage not found');
        if (current.status?.isFailedStatus) throw new Error('Lost Deal cannot be moved through the pipeline');
        const stillForward = assertDirection(current.stage, target);

        if (stillForward && !(await grandfatheredForStage(tx, actor.tenantId, current, target))) {
          const existing = await tx.attachment.findMany({
            where: { tenantId: actor.tenantId, dealId, documentStageId: target.id, documentName: { not: null } },
            select: { documentName: true },
          });
          const completed = new Set(existing.flatMap(({ documentName }) => documentName ? [documentName] : []));
          checkDealDocuments(
            target.evidences.map((requirement) => ({
              ...requirement,
              isRequired: requirement.isRequired && !completed.has(requirement.name),
            })),
            current.paymentMethod,
            input.documents,
            files
          );
        }

        let wonStatusId: string | undefined;
        if (target.isWonStage && !current.status?.isClosingStatus) {
          const wonStatus = await tx.status.findFirst({
            where: { tenantId: actor.tenantId, type: 'deal', isClosingStatus: true },
            select: { id: true },
          });
          if (!wonStatus) throw new Error('No Won Deal status configured');
          wonStatusId = wonStatus.id;
        }
        const updated = await tx.deal.update({
          where: { id: dealId },
          data: {
            stageId: target.id,
            ...(wonStatusId ? { statusId: wonStatusId, closingDate: current.closingDate ?? new Date() } : {}),
          },
          select: dealUnitSelect,
        });
        await syncDealUnit(tx, actor.tenantId, before, updated);

        if (stored.length) {
          await tx.attachment.createMany({
            data: stored.map(({ name, file, path }) => ({
              tenantId: actor.tenantId,
              dealId,
              documentName: name,
              documentStageId: target.id,
              fileName: file.originalname.slice(0, 191),
              fileUrl: this.storage.getPublicUrl(path).publicUrl,
              fileType: file.mimetype,
              fileSize: file.size,
              uploadedById: actor.userId,
            })),
          });
        }
        await tx.dealActivity.create({
          data: {
            tenantId: actor.tenantId,
            dealId,
            actorId: actor.userId,
            activityType: 'stage_changed',
            notes: {
              create: {
                tenantId: actor.tenantId,
                content: `Fase Deal diubah dari ${current.stage.name} ke ${target.name}.`,
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
            action: 'stage_changed',
            changes: {
              stageId: { old: current.stageId, new: target.id },
              ...(wonStatusId ? { statusId: { old: current.statusId, new: wonStatusId } } : {}),
              evidenceNames: stored.map(({ name }) => name),
            },
          },
        });
        return { id: dealId, stageId: target.id, statusId: updated.statusId };
      }, { isolationLevel: 'ReadCommitted' });
    } catch (error) {
      await this.storage.remove(stored.map(({ path }) => path));
      throw error;
    }
  }
}
