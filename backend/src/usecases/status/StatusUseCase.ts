import type { Status, Prisma, PrismaClient } from '@prisma/client';
import type { PrismaGenericRepository } from '../../infrastructure/repositories/PrismaGenericRepository.js';
import type { CreateStatusDTO, UpdateStatusDTO } from '../../presentation/dtos/StatusDTO.js';

export class StatusUseCase {
  constructor(
    private statusRepository: PrismaGenericRepository<Status, Prisma.StatusDelegate>,
    private prisma?: PrismaClient
  ) {}

  async createStatus(dto: CreateStatusDTO) {
    if (!dto.tenantId || !dto.name) {
      throw new Error('Missing required fields: tenantId or name');
    }

    const type = dto.type || 'lead';

    // Enforce uniqueness of default per type per tenant
    if (dto.isDefaultStatus && !this.prisma) {
      await (this.statusRepository.delegate as any).updateMany({
        where: { tenantId: dto.tenantId, type: type, isDefaultStatus: true },
        data: { isDefaultStatus: false, defaultGuard: null },
      });
    }

    // Enforce uniqueness of closing status per type per tenant
    if (dto.isClosingStatus && !this.prisma) {
      await (this.statusRepository.delegate as any).updateMany({
        where: { tenantId: dto.tenantId, type: type, isClosingStatus: true },
        data: { isClosingStatus: false, closingGuard: null },
      });
    }

    const data: Prisma.StatusCreateInput = {
      tenant: { connect: { id: dto.tenantId } },
      name: dto.name,
      priority: dto.priority ?? 0,
      type: type,
      isDefaultStatus: dto.isDefaultStatus ?? false,
      isClosingStatus: dto.isClosingStatus ?? false,
      defaultGuard: dto.isDefaultStatus ? type : null,
      closingGuard: dto.isClosingStatus ? type : null,
    };

    if (dto.color !== undefined) {
      data.color = dto.color;
    }

    if (this.prisma && (dto.isDefaultStatus || dto.isClosingStatus)) {
      return this.prisma.$transaction(async (tx) => {
        if (dto.isDefaultStatus) {
          await tx.status.updateMany({
            where: { tenantId: dto.tenantId, type, isDefaultStatus: true },
            data: { isDefaultStatus: false, defaultGuard: null },
          });
        }
        if (dto.isClosingStatus) {
          await tx.status.updateMany({
            where: { tenantId: dto.tenantId, type, isClosingStatus: true },
            data: { isClosingStatus: false, closingGuard: null },
          });
        }
        return tx.status.create({ data });
      });
    }

    return this.statusRepository.create(data);
  }

  async getStatus(id: string, tenantId: string) {
    const status = await this.statusRepository.findOne({ id, tenantId });
    if (!status) {
      throw new Error('Status not found');
    }
    return status;
  }

  async getAllStatuses(tenantId: string, filters: any = {}) {
    return this.statusRepository.findAll({
      where: {
        tenantId,
        ...filters,
      },
      orderBy: { priority: 'asc' },
    });
  }

  async updateStatus(id: string, tenantId: string, dto: UpdateStatusDTO) {
    const status = await this.getStatus(id, tenantId);
    if (status.isSystemStatus) {
      throw new Error('Cannot update a system default status');
    }
    const type = dto.type || status.type || 'lead';
    const willBeDefault = dto.isDefaultStatus ?? status.isDefaultStatus;
    const willBeClosing = dto.isClosingStatus ?? status.isClosingStatus;
    const resetDefault = willBeDefault && (dto.isDefaultStatus === true || dto.type !== undefined);
    const resetClosing =
      willBeClosing && (dto.isClosingStatus === true || dto.type !== undefined);

    if (resetDefault && !this.prisma) {
      await (this.statusRepository.delegate as any).updateMany({
        where: { tenantId, type: type, isDefaultStatus: true },
        data: { isDefaultStatus: false, defaultGuard: null },
      });
    }

    if (resetClosing && !this.prisma) {
      await (this.statusRepository.delegate as any).updateMany({
        where: { tenantId, type: type, isClosingStatus: true },
        data: { isClosingStatus: false, closingGuard: null },
      });
    }

    const data: Prisma.StatusUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.isDefaultStatus !== undefined) data.isDefaultStatus = dto.isDefaultStatus;
    if (dto.isClosingStatus !== undefined) data.isClosingStatus = dto.isClosingStatus;
    data.defaultGuard = willBeDefault ? type : null;
    data.closingGuard = willBeClosing ? type : null;

    if (this.prisma && (resetDefault || resetClosing)) {
      return this.prisma.$transaction(async (tx) => {
        if (resetDefault) {
          await tx.status.updateMany({
            where: { tenantId, type, isDefaultStatus: true },
            data: { isDefaultStatus: false, defaultGuard: null },
          });
        }
        if (resetClosing) {
          await tx.status.updateMany({
            where: { tenantId, type, isClosingStatus: true },
            data: { isClosingStatus: false, closingGuard: null },
          });
        }
        return tx.status.update({ where: { id }, data });
      });
    }

    return this.statusRepository.update(id, data);
  }

  async deleteStatus(id: string, tenantId: string) {
    const status = await this.getStatus(id, tenantId);
    if (status.isSystemStatus) {
      throw new Error('Cannot delete a system default status');
    }
    if (status.isDefaultStatus || status.isClosingStatus) {
      throw new Error('Default and closing statuses cannot be deleted (conflict)');
    }
    if (this.prisma) {
      const [leadCount, dealCount, viewingCount] = await Promise.all([
        this.prisma.lead.count({ where: { tenantId, statusId: id } }),
        this.prisma.deal.count({ where: { tenantId, statusId: id } }),
        this.prisma.viewing.count({ where: { tenantId, statusId: id } }),
      ]);
      if (leadCount + dealCount + viewingCount > 0) {
        throw new Error(
          `Status is still used by ${leadCount} Leads, ${dealCount} Deals, and ${viewingCount} Visits; reassign them before deleting (conflict)`
        );
      }
    }
    return this.statusRepository.delete(id);
  }
}
