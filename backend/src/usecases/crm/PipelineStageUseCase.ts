import type { Prisma, PrismaClient } from '@prisma/client';

export const PIPELINE_ENTITIES = ['lead', 'deal'] as const;
export type PipelineEntity = (typeof PIPELINE_ENTITIES)[number];

export const EVIDENCE_FILE_TYPES = ['PDF', 'DOC', 'IMAGE', 'SHEET'] as const;
export type EvidenceFileType = (typeof EVIDENCE_FILE_TYPES)[number];

export const EVIDENCE_PAYMENT_METHODS = ['CASH', 'KPR', 'KPR_SHARIA'] as const;
export type EvidencePaymentMethod = (typeof EVIDENCE_PAYMENT_METHODS)[number];

export type EvidenceInput = {
  name: string;
  fileTypes: EvidenceFileType[];
  isRequired: boolean;
  description?: string | null;
  /** Khusus Deal; null berarti semua jenis pembayaran. */
  paymentMethods?: EvidencePaymentMethod[] | null;
};

export type PipelineStageInput = {
  name?: string;
  description?: string | null;
  probability?: number;
  color?: string;
  isActive?: boolean;
  /** Jadikan tahapan default (Lead baru masuk ke sini). Hanya satu per pipeline. */
  isDefaultStage?: boolean;
  /** Jadikan tahapan akhir. Hanya satu per pipeline. */
  isTerminalStage?: boolean;
  /** Khusus Deal: tahapan yang dihitung sebagai Won Deals. Hanya satu per company. */
  isWonStage?: boolean;
  /** Bila dikirim saat update, menggantikan seluruh daftar evidence tahapan. */
  evidences?: EvidenceInput[];
};

const include = {
  evidences: { orderBy: { sortOrder: 'asc' } },
  _count: {
    select: {
      leads: { where: { isDeleted: false, archivedAt: null } },
      deals: true,
    },
  },
} satisfies Prisma.StageInclude;

type StageRow = Prisma.StageGetPayload<{ include: typeof include }>;

/** Bentuk respons tahapan; field internal (tenant, guard) tidak dikirim ke klien. */
function present(stage: StageRow, entity: PipelineEntity) {
  return {
    id: stage.id,
    entityType: stage.entityType,
    name: stage.name,
    description: stage.description,
    probability: stage.probability,
    color: stage.color,
    position: stage.position,
    isActive: stage.isActive,
    isDefaultStage: stage.isDefaultStage,
    isTerminalStage: stage.isTerminalStage,
    isWonStage: stage.isWonStage,
    evidences: stage.evidences.map((evidence) => ({
      id: evidence.id,
      name: evidence.name,
      fileTypes: evidence.fileTypes,
      isRequired: evidence.isRequired,
      description: evidence.description,
      paymentMethods: evidence.paymentMethods,
      sortOrder: evidence.sortOrder,
    })),
    itemCount: entity === 'lead' ? stage._count.leads : stage._count.deals,
  };
}

const evidenceRows = (tenantId: string, stageId: string, entity: PipelineEntity, evidences: EvidenceInput[]) =>
  evidences.map((evidence, index) => ({
    tenantId,
    stageId,
    name: evidence.name,
    fileTypes: evidence.fileTypes,
    isRequired: evidence.isRequired,
    description: evidence.description ?? null,
    ...(entity === 'deal' && evidence.paymentMethods ? { paymentMethods: evidence.paymentMethods } : {}),
    sortOrder: index,
  }));

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

function stageIdsFromAuditChanges(changes: Prisma.JsonValue | null): string[] {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];
  const stageId = (changes as Prisma.JsonObject).stageId;
  if (!stageId || typeof stageId !== 'object' || Array.isArray(stageId)) return [];
  const values = Object.values(stageId as Prisma.JsonObject);
  return values.filter((value): value is string => typeof value === 'string');
}

/**
 * Saat admin mengubah evidence Deal, simpan fase yang telah dicapai oleh Deal
 * yang sudah ada. Ini mencegah konfigurasi baru berlaku surut pada data lama.
 */
async function snapshotDealEvidenceGrandfathering(tx: Tx, tenantId: string) {
  const [deals, auditLogs] = await Promise.all([
    tx.deal.findMany({
      where: { tenantId },
      select: { id: true, stageId: true, evidenceGrandfatheredStageIds: true },
    }),
    tx.auditLog.findMany({
      where: { tenantId, entityType: 'deal', action: 'stage_changed' },
      select: { entityId: true, changes: true },
    }),
  ]);
  const history = new Map<string, Set<string>>();
  for (const log of auditLogs) {
    const ids = history.get(log.entityId) ?? new Set<string>();
    for (const id of stageIdsFromAuditChanges(log.changes)) ids.add(id);
    history.set(log.entityId, ids);
  }
  for (const deal of deals) {
    const ids = new Set(
      Array.isArray(deal.evidenceGrandfatheredStageIds)
        ? deal.evidenceGrandfatheredStageIds.filter((id): id is string => typeof id === 'string')
        : [],
    );
    if (deal.stageId) ids.add(deal.stageId);
    for (const id of history.get(deal.id) ?? []) ids.add(id);
    const next = [...ids];
    const previous = Array.isArray(deal.evidenceGrandfatheredStageIds)
      ? deal.evidenceGrandfatheredStageIds.filter((id): id is string => typeof id === 'string')
      : [];
    if (next.length !== previous.length || next.some((id) => !previous.includes(id))) {
      await tx.deal.update({ where: { id: deal.id }, data: { evidenceGrandfatheredStageIds: next } });
    }
  }
}

/** Padanan Lead dari snapshot Deal: konfigurasi evidence tidak berlaku surut. */
async function snapshotLeadEvidenceGrandfathering(tx: Tx, tenantId: string) {
  const [leads, auditLogs] = await Promise.all([
    tx.lead.findMany({
      where: { tenantId },
      select: { id: true, stageId: true, evidenceGrandfatheredStageIds: true },
    }),
    tx.auditLog.findMany({
      where: { tenantId, entityType: 'lead', action: { in: ['stage_changed', 'stage-change'] } },
      select: { entityId: true, changes: true },
    }),
  ]);
  const history = new Map<string, Set<string>>();
  for (const log of auditLogs) {
    const ids = history.get(log.entityId) ?? new Set<string>();
    for (const id of stageIdsFromAuditChanges(log.changes)) ids.add(id);
    history.set(log.entityId, ids);
  }
  for (const lead of leads) {
    const ids = new Set(
      Array.isArray(lead.evidenceGrandfatheredStageIds)
        ? lead.evidenceGrandfatheredStageIds.filter((id): id is string => typeof id === 'string')
        : [],
    );
    if (lead.stageId) ids.add(lead.stageId);
    for (const id of history.get(lead.id) ?? []) ids.add(id);
    const next = [...ids];
    const previous = Array.isArray(lead.evidenceGrandfatheredStageIds)
      ? lead.evidenceGrandfatheredStageIds.filter((id): id is string => typeof id === 'string')
      : [];
    if (next.length !== previous.length || next.some((id) => !previous.includes(id))) {
      await tx.lead.update({ where: { id: lead.id }, data: { evidenceGrandfatheredStageIds: next } });
    }
  }
}

function evidenceConfigurationChanged(stage: StageRow, evidences: EvidenceInput[]) {
  const normalize = (evidence: EvidenceInput | StageRow['evidences'][number]) => ({
    name: evidence.name,
    fileTypes: Array.isArray(evidence.fileTypes)
      ? evidence.fileTypes.filter((type): type is string => typeof type === 'string').sort()
      : [],
    isRequired: evidence.isRequired,
    description: evidence.description ?? null,
    paymentMethods: 'paymentMethods' in evidence && Array.isArray(evidence.paymentMethods)
      ? evidence.paymentMethods.filter((method): method is string => typeof method === 'string').sort()
      : null,
  });
  return JSON.stringify(stage.evidences.map(normalize)) !== JSON.stringify(evidences.map(normalize));
}

type Positioned = { id: string; isDefaultStage: boolean; isTerminalStage: boolean };

/** Tahapan default selalu pertama dan tahapan akhir selalu terakhir; sisanya mempertahankan urutan. */
export function pinFlaggedStages<T extends Positioned>(stages: T[]): T[] {
  return [
    ...stages.filter((s) => s.isDefaultStage),
    ...stages.filter((s) => !s.isDefaultStage && !s.isTerminalStage),
    ...stages.filter((s) => s.isTerminalStage && !s.isDefaultStage),
  ];
}

/** Menyimpan posisi 0..n dengan default di awal dan akhir di akhir (setelah tanda diubah lewat form). */
async function normalizePositions(tx: Tx, tenantId: string, entity: string) {
  const stages = await tx.stage.findMany({
    where: { tenantId, entityType: entity },
    select: { id: true, position: true, isDefaultStage: true, isTerminalStage: true },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  });
  const pinned = pinFlaggedStages(stages);
  for (const [position, stage] of pinned.entries()) {
    if (stage.position !== position) await tx.stage.update({ where: { id: stage.id }, data: { position } });
  }
}

/**
 * Tanda default/akhir/won untuk data tahapan. Menjadikan sebuah tahapan default/akhir
 * melepas tanda itu dari tahapan lain (guard unik per company dan tipe), dan
 * tahapan bertanda selalu aktif.
 */
async function applyFlags(
  tx: Tx,
  tenantId: string,
  entity: string,
  stageId: string | null,
  input: PipelineStageInput,
  current: { isDefaultStage: boolean; isTerminalStage: boolean; isWonStage: boolean },
) {
  const willBeDefault = input.isDefaultStage ?? current.isDefaultStage;
  const willBeTerminal = input.isTerminalStage ?? current.isTerminalStage;
  const willBeWon = input.isWonStage ?? current.isWonStage;
  if (willBeWon && entity !== 'deal') {
    throw new Error('Invalid stage flags: only deal stages can be counted as won deals');
  }
  if (willBeWon && willBeDefault) {
    throw new Error('Invalid stage flags: the default stage cannot be counted as won deals');
  }
  if (willBeDefault && willBeTerminal) {
    throw new Error('Invalid stage flags: a stage cannot be both the default and the final stage');
  }
  if (input.isDefaultStage === false && current.isDefaultStage) {
    throw new Error('Choose another default stage instead of unsetting it (conflict)');
  }
  if (input.isTerminalStage === false && current.isTerminalStage) {
    throw new Error('Choose another final stage instead of unsetting it (conflict)');
  }
  const others = { tenantId, entityType: entity, ...(stageId ? { id: { not: stageId } } : {}) };
  if (input.isDefaultStage && !current.isDefaultStage) {
    await tx.stage.updateMany({
      where: { ...others, isDefaultStage: true },
      data: { isDefaultStage: false, defaultGuard: null },
    });
  }
  if (input.isTerminalStage && !current.isTerminalStage) {
    await tx.stage.updateMany({
      where: { ...others, isTerminalStage: true },
      data: { isTerminalStage: false, terminalGuard: null },
    });
  }
  if (input.isWonStage && !current.isWonStage) {
    // Guard Won unik per company; hanya tahapan Deal yang dapat bertanda Won.
    await tx.stage.updateMany({
      where: { tenantId, isWonStage: true, ...(stageId ? { id: { not: stageId } } : {}) },
      data: { isWonStage: false, wonGuard: null },
    });
  }
  return {
    isDefaultStage: willBeDefault,
    defaultGuard: willBeDefault ? entity : null,
    isTerminalStage: willBeTerminal,
    terminalGuard: willBeTerminal ? entity : null,
    isWonStage: willBeWon,
    wonGuard: willBeWon ? entity : null,
    ...(willBeDefault || willBeTerminal || willBeWon ? { isActive: true } : {}),
  };
}

/** Tahapan pipeline (Lead atau Deal) milik satu company, beserta evidence-nya. */
export class PipelineStageUseCase {
  constructor(private prisma: PrismaClient) {}

  async list(tenantId: string, entity: PipelineEntity) {
    const stages = await this.prisma.stage.findMany({
      where: { tenantId, entityType: entity },
      include,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    // Data lama dirapikan saat ada perubahan; tampilan selalu default di awal dan akhir di akhir.
    return pinFlaggedStages(stages).map((stage) => present(stage, entity));
  }

  private async find(id: string, tenantId: string) {
    const stage = await this.prisma.stage.findFirst({ where: { id, tenantId }, include });
    if (!stage) throw new Error('Pipeline stage not found');
    return stage;
  }

  /** Nama unik per company dan tipe; kolasi database tidak membedakan huruf besar/kecil. */
  private async assertUniqueName(tenantId: string, entity: string, name: string, exceptId?: string) {
    const existing = await this.prisma.stage.findFirst({
      where: { tenantId, entityType: entity, name, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new Error(`Pipeline stage "${name}" already exists`);
  }

  async create(tenantId: string, entity: PipelineEntity, input: PipelineStageInput) {
    const name = input.name as string;
    await this.assertUniqueName(tenantId, entity, name);
    const last = await this.prisma.stage.findFirst({
      where: { tenantId, entityType: entity },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const created = await this.prisma.$transaction(async (tx) => {
      const flags = await applyFlags(tx, tenantId, entity, null, input, {
        isDefaultStage: false,
        isTerminalStage: false,
        isWonStage: false,
      });
      const stage = await tx.stage.create({
        data: {
          tenantId,
          entityType: entity,
          name,
          description: input.description ?? null,
          probability: input.probability ?? 0,
          color: (input.color as string).toUpperCase(),
          isActive: input.isActive ?? true,
          position: (last?.position ?? -1) + 1,
          ...flags,
        },
      });
      if (input.evidences?.length) {
        await tx.stageEvidenceRequirement.createMany({ data: evidenceRows(tenantId, stage.id, entity, input.evidences) });
      }
      // Tahapan baru masuk sebelum tahapan akhir (atau menjadi pertama/terakhir sesuai tandanya).
      await normalizePositions(tx, tenantId, entity);
      return stage;
    });
    return present(await this.find(created.id, tenantId), entity);
  }

  async update(id: string, tenantId: string, input: PipelineStageInput) {
    const stage = await this.find(id, tenantId);
    const entity = stage.entityType as PipelineEntity;
    const staysFlagged =
      (input.isDefaultStage ?? stage.isDefaultStage) ||
      (input.isTerminalStage ?? stage.isTerminalStage) ||
      (input.isWonStage ?? stage.isWonStage);
    if (input.isActive === false && staysFlagged) {
      throw new Error('Default, final, and won stages cannot be deactivated (conflict)');
    }
    if (input.name !== undefined) await this.assertUniqueName(tenantId, entity, input.name, id);

    const data: Prisma.StageUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.probability !== undefined) data.probability = input.probability;
    if (input.color !== undefined) data.color = input.color.toUpperCase();
    if (input.isActive !== undefined) data.isActive = input.isActive;

    await this.prisma.$transaction(async (tx) => {
      const flagsChanged =
        (input.isDefaultStage !== undefined && input.isDefaultStage !== stage.isDefaultStage) ||
        (input.isTerminalStage !== undefined && input.isTerminalStage !== stage.isTerminalStage);
      if (
        input.isDefaultStage !== undefined ||
        input.isTerminalStage !== undefined ||
        input.isWonStage !== undefined
      ) {
        Object.assign(data, await applyFlags(tx, tenantId, entity, id, input, stage));
      }
      if (Object.keys(data).length > 0) await tx.stage.update({ where: { id }, data });
      if (flagsChanged) await normalizePositions(tx, tenantId, entity);
      if (input.evidences !== undefined) {
        if (evidenceConfigurationChanged(stage, input.evidences)) {
          if (entity === 'deal') await snapshotDealEvidenceGrandfathering(tx, tenantId);
          if (entity === 'lead') await snapshotLeadEvidenceGrandfathering(tx, tenantId);
        }
        await tx.stageEvidenceRequirement.deleteMany({ where: { tenantId, stageId: id } });
        if (input.evidences.length) {
          await tx.stageEvidenceRequirement.createMany({ data: evidenceRows(tenantId, id, entity, input.evidences) });
        }
      }
    });
    return present(await this.find(id, tenantId), entity);
  }

  /** `ids` harus berisi seluruh tahapan tipe tersebut milik company, dalam urutan baru. */
  async reorder(tenantId: string, entity: PipelineEntity, ids: string[]) {
    const stages = await this.prisma.stage.findMany({
      where: { tenantId, entityType: entity },
      select: { id: true, isWonStage: true },
    });
    const known = new Set(stages.map((s) => s.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new Error('ids must contain every stage of the pipeline exactly once');
    }
    // Urutan menentukan tanda: tahapan pertama menjadi default, tahapan terakhir menjadi akhir.
    const first = ids[0] as string;
    const last = ids[ids.length - 1] as string;
    if (ids.length > 1 && stages.some((s) => s.id === first && s.isWonStage)) {
      throw new Error('Invalid stage order: the won stage cannot be the first (default) stage');
    }
    await this.prisma.$transaction(async (tx) => {
      // Lepas dulu semua tanda agar guard unik tidak bentrok saat tanda dipindah.
      await tx.stage.updateMany({
        where: { tenantId, entityType: entity },
        data: { isDefaultStage: false, defaultGuard: null, isTerminalStage: false, terminalGuard: null },
      });
      for (const [position, id] of ids.entries()) {
        const isDefault = id === first;
        const isTerminal = ids.length > 1 && id === last;
        await tx.stage.update({
          where: { id },
          data: {
            position,
            isDefaultStage: isDefault,
            defaultGuard: isDefault ? entity : null,
            isTerminalStage: isTerminal,
            terminalGuard: isTerminal ? entity : null,
            // Tahapan default/akhir selalu aktif.
            ...(isDefault || isTerminal ? { isActive: true } : {}),
          },
        });
      }
    });
    return this.list(tenantId, entity);
  }

  async remove(id: string, tenantId: string) {
    const stage = await this.find(id, tenantId);
    if (stage.isDefaultStage || stage.isTerminalStage) {
      throw new Error('Default and final stages cannot be deleted (conflict)');
    }
    const count = stage.entityType === 'deal' ? stage._count.deals : stage._count.leads;
    if (count > 0) {
      throw new Error(`Pipeline stage still has ${count} items; move them before deleting (conflict)`);
    }
    await this.prisma.stage.delete({ where: { id } });
  }
}
