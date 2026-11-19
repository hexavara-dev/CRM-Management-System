import type { Prisma, PrismaClient } from '@prisma/client';

export const PIPELINE_ENTITIES = ['lead', 'deal'] as const;
export type PipelineEntity = (typeof PIPELINE_ENTITIES)[number];

export const EVIDENCE_FILE_TYPES = ['PDF', 'DOC', 'IMAGE', 'SHEET'] as const;
export type EvidenceFileType = (typeof EVIDENCE_FILE_TYPES)[number];

export type EvidenceInput = { name: string; fileTypes: EvidenceFileType[]; isRequired: boolean };

export type PipelineStageInput = {
  name?: string;
  description?: string | null;
  probability?: number;
  color?: string;
  isActive?: boolean;
  /** Bila dikirim saat update, menggantikan seluruh daftar evidence tahapan. */
  evidences?: EvidenceInput[];
};

const include = {
  evidences: { orderBy: { sortOrder: 'asc' } },
  _count: { select: { leads: true, deals: true } },
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
    evidences: stage.evidences.map((evidence) => ({
      id: evidence.id,
      name: evidence.name,
      fileTypes: evidence.fileTypes,
      isRequired: evidence.isRequired,
      sortOrder: evidence.sortOrder,
    })),
    itemCount: entity === 'lead' ? stage._count.leads : stage._count.deals,
  };
}

const evidenceRows = (tenantId: string, stageId: string, evidences: EvidenceInput[]) =>
  evidences.map((evidence, index) => ({
    tenantId,
    stageId,
    name: evidence.name,
    fileTypes: evidence.fileTypes,
    isRequired: evidence.isRequired,
    sortOrder: index,
  }));

/** Tahapan pipeline (Lead atau Deal) milik satu company, beserta evidence-nya. */
export class PipelineStageUseCase {
  constructor(private prisma: PrismaClient) {}

  async list(tenantId: string, entity: PipelineEntity) {
    const stages = await this.prisma.stage.findMany({
      where: { tenantId, entityType: entity },
      include,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    return stages.map((stage) => present(stage, entity));
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
        },
      });
      if (input.evidences?.length) {
        await tx.stageEvidenceRequirement.createMany({ data: evidenceRows(tenantId, stage.id, input.evidences) });
      }
      return stage;
    });
    return present(await this.find(created.id, tenantId), entity);
  }

  async update(id: string, tenantId: string, input: PipelineStageInput) {
    const stage = await this.find(id, tenantId);
    const entity = stage.entityType as PipelineEntity;
    if (input.isActive === false && (stage.isDefaultStage || stage.isTerminalStage)) {
      throw new Error('Default and final stages cannot be deactivated (conflict)');
    }
    if (input.name !== undefined) await this.assertUniqueName(tenantId, entity, input.name, id);

    const data: Prisma.StageUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.probability !== undefined) data.probability = input.probability;
    if (input.color !== undefined) data.color = input.color.toUpperCase();
    if (input.isActive !== undefined) data.isActive = input.isActive;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) await tx.stage.update({ where: { id }, data });
      if (input.evidences !== undefined) {
        await tx.stageEvidenceRequirement.deleteMany({ where: { tenantId, stageId: id } });
        if (input.evidences.length) {
          await tx.stageEvidenceRequirement.createMany({ data: evidenceRows(tenantId, id, input.evidences) });
        }
      }
    });
    return present(await this.find(id, tenantId), entity);
  }

  /** `ids` harus berisi seluruh tahapan tipe tersebut milik company, dalam urutan baru. */
  async reorder(tenantId: string, entity: PipelineEntity, ids: string[]) {
    const stages = await this.prisma.stage.findMany({
      where: { tenantId, entityType: entity },
      select: { id: true },
    });
    const known = new Set(stages.map((s) => s.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new Error('ids must contain every stage of the pipeline exactly once');
    }
    await this.prisma.$transaction(
      ids.map((id, position) => this.prisma.stage.update({ where: { id }, data: { position } }))
    );
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
