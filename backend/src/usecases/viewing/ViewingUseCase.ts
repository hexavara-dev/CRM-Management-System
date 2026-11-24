import type { Viewing, Status, Prisma, Attachment, PrismaClient } from '@prisma/client';
import type { PrismaGenericRepository } from '../../infrastructure/repositories/PrismaGenericRepository.js';
import type { CreateViewingDTO, UpdateViewingDTO } from '../../presentation/dtos/ViewingDTO.js';
import { localStorage } from '../../infrastructure/storage/localStorage.js';
import { buildViewingListQuery, type ViewingActor } from './viewingListQuery.js';

export class ViewingUseCase {
  constructor(
    private viewingRepository: PrismaGenericRepository<Viewing, Prisma.ViewingDelegate>,
    private statusRepository: PrismaGenericRepository<Status, Prisma.StatusDelegate>,
    private attachmentRepository: PrismaGenericRepository<Attachment, Prisma.AttachmentDelegate>,
    private prisma: PrismaClient
  ) {}

  private async validateRelations(
    dto: CreateViewingDTO | UpdateViewingDTO,
    tenantId: string
  ) {
    const [slot, lead, location, source, actor, status] = await Promise.all([
      dto.slotId
        ? this.prisma.inventorySlot.findFirst({
            where: { id: dto.slotId, tenantId },
            select: { id: true },
          })
        : undefined,
      dto.leadId
        ? this.prisma.lead.findFirst({
            where: { id: dto.leadId, tenantId, isDeleted: false },
            select: { id: true },
          })
        : undefined,
      dto.locationId
        ? this.prisma.location.findFirst({
            where: { id: dto.locationId, tenantId },
            select: { id: true },
          })
        : undefined,
      dto.sourceId
        ? this.prisma.source.findFirst({
            where: { id: dto.sourceId, tenantId, type: 'viewing' },
            select: { id: true },
          })
        : undefined,
      dto.actorId
        ? this.prisma.user.findFirst({ where: { id: dto.actorId, tenantId }, select: { id: true } })
        : undefined,
      dto.statusId
        ? this.prisma.status.findFirst({
            where: { id: dto.statusId, tenantId, type: 'viewing' },
            select: { id: true },
          })
        : undefined,
    ]);

    if (dto.slotId && !slot) throw new Error('Inventory slot not found');
    if (dto.leadId && !lead) throw new Error('Lead not found');
    if (dto.locationId && !location) throw new Error('Location not found');
    if (dto.sourceId && !source) throw new Error('Source not found');
    if (dto.actorId && !actor) throw new Error('Actor not found');
    if (dto.statusId && !status) throw new Error('Status not found');
  }

  async createViewing(dto: CreateViewingDTO) {
    if (!dto.tenantId || !dto.scheduledAt) {
      throw new Error('Missing required fields: tenantId or scheduledAt');
    }

    await this.validateRelations(dto, dto.tenantId);

    const defaultStatus = await this.statusRepository.findOne({
      tenantId: dto.tenantId,
      type: 'viewing',
      isDefaultStatus: true,
    });

    const data: Prisma.ViewingCreateInput = {
      tenant: { connect: { id: dto.tenantId } },
      scheduledAt: dto.scheduledAt,
    };

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.durationMinutes !== undefined) data.durationMinutes = dto.durationMinutes;
    if (dto.slotId) data.slot = { connect: { id: dto.slotId } };
    if (dto.leadId) data.lead = { connect: { id: dto.leadId } };
    if (dto.locationId) data.location = { connect: { id: dto.locationId } };
    if (dto.sourceId) data.source = { connect: { id: dto.sourceId } };
    if (dto.actorId) data.actor = { connect: { id: dto.actorId } };

    if (dto.statusId) {
      data.status = { connect: { id: dto.statusId } };
    } else if (defaultStatus) {
      data.status = { connect: { id: defaultStatus.id } };
    }

    return this.viewingRepository.create(data);
  }

  async getViewing(id: string, tenantId: string) {
    const viewing = await this.viewingRepository.findOne(
      { id, tenantId },
      {
        status: true,
        slot: true,
        lead: { include: { customer: true } },
        location: true,
        source: true,
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      }
    );
    if (!viewing) {
      throw new Error('Viewing not found');
    }
    return viewing;
  }

  async getAllViewings(
    tenantId: string,
    page: number = 1,
    limit: number = 10,
    query: Record<string, unknown> = {},
    actor?: ViewingActor
  ) {
    const skip = (page - 1) * limit;
    const take = limit;
    const { where, orderBy } = buildViewingListQuery(tenantId, query, actor);

    const [data, total] = await Promise.all([
      this.viewingRepository.findAll({
        where,
        skip,
        take,
        include: {
          status: true,
          slot: true,
          lead: {
            include: {
              customer: true,
              assignedUser: { select: { id: true, name: true } },
              project: { select: { id: true, name: true, code: true } },
            },
          },
          location: true,
          source: true,
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
            },
          },
        },
        orderBy,
      }),
      this.viewingRepository.count(where),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateViewing(id: string, tenantId: string, dto: UpdateViewingDTO) {
    await this.getViewing(id, tenantId);
    await this.validateRelations(dto, tenantId);

    if (dto.statusId) {
      const status = await this.statusRepository.findById(dto.statusId);
      if (status && status.isClosingStatus && status.type === 'viewing') {
        throw new Error(
          'Cannot manually set viewing to a closing status. Please use the evidence upload flow.'
        );
      }
    }

    const data: Prisma.ViewingUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.scheduledAt !== undefined) data.scheduledAt = dto.scheduledAt;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.durationMinutes !== undefined) data.durationMinutes = dto.durationMinutes;

    if (dto.slotId) data.slot = { connect: { id: dto.slotId } };
    else if (dto.slotId === null) data.slot = { disconnect: true };

    if (dto.leadId) data.lead = { connect: { id: dto.leadId } };
    else if (dto.leadId === null) data.lead = { disconnect: true };

    if (dto.locationId) data.location = { connect: { id: dto.locationId } };
    else if (dto.locationId === null) data.location = { disconnect: true };

    if (dto.sourceId) data.source = { connect: { id: dto.sourceId } };
    else if (dto.sourceId === null) data.source = { disconnect: true };

    if (dto.actorId) data.actor = { connect: { id: dto.actorId } };
    else if (dto.actorId === null) data.actor = { disconnect: true };

    if (dto.statusId) data.status = { connect: { id: dto.statusId } };
    else if (dto.statusId === null) data.status = { disconnect: true };

    return this.viewingRepository.update(id, data);
  }

  async deleteViewing(id: string, tenantId: string) {
    await this.getViewing(id, tenantId);
    return this.viewingRepository.delete(id);
  }

  async uploadEvidence(
    viewingId: string,
    tenantId: string,
    file: Express.Multer.File,
    payload: UpdateViewingDTO
  ) {
    await this.getViewing(viewingId, tenantId);

    const closingStatus = await this.statusRepository.findOne({
      tenantId: tenantId,
      type: 'viewing',
      isClosingStatus: true,
    });

    if (!closingStatus) {
      throw new Error('No closing status defined for viewing in this tenant');
    }

    // 1. Upload to Supabase
    const fileExt = file.originalname.split('.').pop() || '';
    const now = new Date();
    const datePart = now.toISOString().split('T')[0] || '';
    const yyyyMMdd = datePart.replace(/-/g, '');
    const timePart = now.toTimeString().split(' ')[0] || '';
    const hhmmss = timePart.replace(/:/g, '');
    const fileName = `bukti_visit_${yyyyMMdd}_${hhmmss}.${fileExt}`;
    const filePath = `${tenantId}/viewing/${viewingId}/${fileName}`;

    await localStorage.upload(filePath, file.buffer);
    const { publicUrl } = localStorage.getPublicUrl(filePath);

    // 2. Wrap DB writes in a transaction for atomicity
    try {
      await this.prisma.$transaction(async (tx) => {
        // 2a. Create Attachment record
        await tx.attachment.create({
          data: {
            tenant: { connect: { id: tenantId } },
            Viewing: { connect: { id: viewingId } },
            fileName: file.originalname,
            fileUrl: publicUrl,
            fileType: file.mimetype,
            fileSize: file.size,
          },
        });

        // 2b. Update Viewing status and other details
        const dataUpdate: Prisma.ViewingUpdateInput = {
          status: { connect: { id: closingStatus.id } },
        };

        if (payload.name !== undefined) dataUpdate.name = payload.name;
        if (payload.email !== undefined) dataUpdate.email = payload.email;
        if (payload.scheduledAt !== undefined) dataUpdate.scheduledAt = payload.scheduledAt;
        if (payload.notes !== undefined) dataUpdate.notes = payload.notes;

        return tx.viewing.update({ where: { id: viewingId }, data: dataUpdate });
      });
    } catch (dbError) {
      // Compensating action: remove the already-uploaded file from Supabase
      // to prevent ghost files when the DB transaction rolls back.
      await localStorage.remove([filePath]);
      throw dbError;
    }

    return this.viewingRepository.findOne({ id: viewingId, tenantId });
  }

  async failViewing(viewingId: string, tenantId: string, reason?: string) {
    await this.getViewing(viewingId, tenantId);

    const failedStatus = await this.statusRepository.findOne({
      tenantId: tenantId,
      type: 'viewing',
      isFailedStatus: true,
    });

    if (!failedStatus) {
      throw new Error('No failed status defined for viewing in this tenant');
    }

    const dataUpdate: Prisma.ViewingUpdateInput = {
      status: { connect: { id: failedStatus.id } },
    };

    if (reason) {
      // If there are existing notes, we append the reason or just overwrite?
      // Let's just overwrite for now or prepend. Overwriting is simpler.
      dataUpdate.notes = reason;
    }

    return this.viewingRepository.update(viewingId, dataUpdate);
  }
}
