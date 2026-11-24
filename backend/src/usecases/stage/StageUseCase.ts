import type { Stage, Prisma, PrismaClient } from '@prisma/client';
import type { PrismaGenericRepository } from '../../infrastructure/repositories/PrismaGenericRepository.js';
import type { CreateStageDTO, UpdateStageDTO } from '../../presentation/dtos/StageDTO.js';

export class StageUseCase {
  constructor(
    private stageRepository: PrismaGenericRepository<Stage, Prisma.StageDelegate>,
    private prisma?: PrismaClient
  ) {}

  async createStage(dto: CreateStageDTO) {
    if (!dto.tenantId || !dto.name) {
      throw new Error('Missing required fields: tenantId or name');
    }

    const entityType = dto.entityType || 'lead';

    // Enforce uniqueness of default per entityType per tenant
    if (dto.isDefaultStage && !this.prisma) {
      await (this.stageRepository.delegate as any).updateMany({
        where: { tenantId: dto.tenantId, entityType: entityType, isDefaultStage: true },
        data: { isDefaultStage: false, defaultGuard: null },
      });
    }

    // Enforce uniqueness of terminal stage per entityType per tenant
    if (dto.isTerminalStage && !this.prisma) {
      await (this.stageRepository.delegate as any).updateMany({
        where: { tenantId: dto.tenantId, entityType: entityType, isTerminalStage: true },
        data: { isTerminalStage: false, terminalGuard: null },
      });
    }

    const data: Prisma.StageCreateInput = {
      tenant: { connect: { id: dto.tenantId } },
      name: dto.name,
      position: dto.position ?? 0,
      entityType: entityType,
      isDefaultStage: dto.isDefaultStage ?? false,
      isTerminalStage: dto.isTerminalStage ?? false,
      defaultGuard: dto.isDefaultStage ? entityType : null,
      terminalGuard: dto.isTerminalStage ? entityType : null,
    };

    if (dto.color !== undefined) {
      data.color = dto.color;
    }

    if (this.prisma && (dto.isDefaultStage || dto.isTerminalStage)) {
      return this.prisma.$transaction(async (tx) => {
        if (dto.isDefaultStage) {
          await tx.stage.updateMany({
            where: { tenantId: dto.tenantId, entityType, isDefaultStage: true },
            data: { isDefaultStage: false, defaultGuard: null },
          });
        }
        if (dto.isTerminalStage) {
          await tx.stage.updateMany({
            where: { tenantId: dto.tenantId, entityType, isTerminalStage: true },
            data: { isTerminalStage: false, terminalGuard: null },
          });
        }
        return tx.stage.create({ data });
      });
    }

    return this.stageRepository.create(data);
  }

  async getStage(id: string, tenantId: string) {
    const stage = await this.stageRepository.findOne({ id, tenantId });
    if (!stage) {
      throw new Error('Stage not found');
    }
    return stage;
  }

  async getAllStages(tenantId: string, filters: any = {}) {
    return this.stageRepository.findAll({
      where: {
        tenantId,
        ...filters,
      },
      orderBy: { position: 'asc' },
    });
  }

  async updateStage(id: string, tenantId: string, dto: UpdateStageDTO) {
    const stage = await this.getStage(id, tenantId);
    const entityType = dto.entityType || stage.entityType || 'lead';
    const willBeDefault = dto.isDefaultStage ?? stage.isDefaultStage;
    const willBeTerminal = dto.isTerminalStage ?? stage.isTerminalStage;
    const resetDefault = willBeDefault && (dto.isDefaultStage === true || dto.entityType !== undefined);
    const resetTerminal =
      willBeTerminal && (dto.isTerminalStage === true || dto.entityType !== undefined);

    if (resetDefault && !this.prisma) {
      await (this.stageRepository.delegate as any).updateMany({
        where: { tenantId, entityType: entityType, isDefaultStage: true },
        data: { isDefaultStage: false, defaultGuard: null },
      });
    }

    if (resetTerminal && !this.prisma) {
      await (this.stageRepository.delegate as any).updateMany({
        where: { tenantId, entityType: entityType, isTerminalStage: true },
        data: { isTerminalStage: false, terminalGuard: null },
      });
    }

    const data: Prisma.StageUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.entityType !== undefined) data.entityType = dto.entityType;
    if (dto.isDefaultStage !== undefined) data.isDefaultStage = dto.isDefaultStage;
    if (dto.isTerminalStage !== undefined) data.isTerminalStage = dto.isTerminalStage;
    data.defaultGuard = willBeDefault ? entityType : null;
    data.terminalGuard = willBeTerminal ? entityType : null;

    if (this.prisma && (resetDefault || resetTerminal)) {
      return this.prisma.$transaction(async (tx) => {
        if (resetDefault) {
          await tx.stage.updateMany({
            where: { tenantId, entityType, isDefaultStage: true },
            data: { isDefaultStage: false, defaultGuard: null },
          });
        }
        if (resetTerminal) {
          await tx.stage.updateMany({
            where: { tenantId, entityType, isTerminalStage: true },
            data: { isTerminalStage: false, terminalGuard: null },
          });
        }
        return tx.stage.update({ where: { id }, data });
      });
    }

    return this.stageRepository.update(id, data);
  }

  async reorderStages(
    tenantId: string,
    stages: Array<{ id: string; position: number }>
  ) {
    if (!Array.isArray(stages) || stages.length === 0) {
      throw new Error('Stages are required');
    }

    const ids = stages.map((stage) => stage.id);
    if (
      ids.some((id) => typeof id !== 'string' || !id) ||
      new Set(ids).size !== ids.length ||
      stages.some((stage) => !Number.isInteger(stage.position) || stage.position < 0)
    ) {
      throw new Error('Invalid stage order');
    }

    const ownedStages = await (this.stageRepository.delegate as any).findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true },
    });
    if (ownedStages.length !== stages.length) {
      throw new Error('One or more stages were not found');
    }

    if (this.prisma) {
      await this.prisma.$transaction(
        stages.map((stage) =>
          this.prisma!.stage.update({
            where: { id: stage.id },
            data: { position: stage.position },
          })
        )
      );
    } else {
      await Promise.all(
        stages.map((stage) => this.stageRepository.update(stage.id, { position: stage.position }))
      );
    }

    return this.stageRepository.findAll({
      where: { tenantId, id: { in: ids } },
      orderBy: { position: 'asc' },
    });
  }

  async deleteStage(id: string, tenantId: string) {
    const stage = await this.getStage(id, tenantId);
    if (stage.isDefaultStage || stage.isTerminalStage || stage.isWonStage) {
      throw new Error('Default, final, and won stages cannot be deleted (conflict)');
    }
    const usage = await (this.stageRepository.delegate as any).findFirst({
      where: { id, tenantId },
      select: { _count: { select: { leads: true, deals: true } } },
    });
    const leadCount = usage?._count?.leads ?? 0;
    const dealCount = usage?._count?.deals ?? 0;
    if (leadCount + dealCount > 0) {
      throw new Error(
        `Pipeline stage is still used by ${leadCount} Leads and ${dealCount} Deals; move them before deleting (conflict)`
      );
    }
    return this.stageRepository.delete(id);
  }
}
