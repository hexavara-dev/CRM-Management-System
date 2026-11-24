import type { Lead, Deal, LeadActivity, Status, Stage, Prisma, PrismaClient } from '@prisma/client';
import type { PrismaGenericRepository } from '../../infrastructure/repositories/PrismaGenericRepository.js';
import type { CreateLeadDTO, UpdateLeadDTO } from '../../presentation/dtos/LeadDTO.js';
import { randomUUID } from 'node:crypto';

const USER_PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
};

export class LeadUseCases {
  constructor(
    private leadRepository: PrismaGenericRepository<Lead, Prisma.LeadDelegate>,
    private dealRepository: PrismaGenericRepository<Deal, Prisma.DealDelegate>,
    private leadActivityRepository?: PrismaGenericRepository<
      LeadActivity,
      Prisma.LeadActivityDelegate
    >,
    private statusRepository?: PrismaGenericRepository<Status, Prisma.StatusDelegate>,
    private stageRepository?: PrismaGenericRepository<Stage, Prisma.StageDelegate>,
    private customerRepository?: PrismaGenericRepository<any, any>,
    private auditLogRepository?: PrismaGenericRepository<any, any>,
    private prisma?: PrismaClient
  ) {}

  private async validateRelations(
    dto: CreateLeadDTO | UpdateLeadDTO,
    tenantId: string
  ) {
    if (!this.prisma) return;

    const [assignedUser, sourceUser, stage, status, source, location, project, productVariant, campaign, labels] = await Promise.all([
      dto.assignedUserId
        ? this.prisma.user.findFirst({ where: { id: dto.assignedUserId, tenantId }, select: { id: true } })
        : undefined,
      'sourceUserId' in dto && dto.sourceUserId
        ? this.prisma.user.findFirst({ where: { id: dto.sourceUserId, tenantId }, select: { id: true } })
        : undefined,
      'stageId' in dto && dto.stageId
        ? this.prisma.stage.findFirst({
            where: { id: dto.stageId, tenantId, entityType: 'lead' },
            select: { id: true },
          })
        : undefined,
      dto.statusId
        ? this.prisma.status.findFirst({
            where: { id: dto.statusId, tenantId, type: 'lead' },
            select: { id: true },
          })
        : undefined,
      dto.sourceId
        ? this.prisma.source.findFirst({
            where: { id: dto.sourceId, tenantId, type: 'lead' },
            select: { id: true },
          })
        : undefined,
      dto.locationId
        ? this.prisma.location.findFirst({ where: { id: dto.locationId, tenantId }, select: { id: true } })
        : undefined,
      dto.projectId
        ? this.prisma.product.findFirst({
            where: { id: dto.projectId, tenantId, isActive: true },
            select: { id: true },
          })
        : undefined,
      dto.productVariantId
        ? this.prisma.productVariant.findFirst({
            where: {
              id: dto.productVariantId,
              tenantId,
              ...(dto.projectId ? { productId: dto.projectId } : {}),
            },
            select: { id: true },
          })
        : undefined,
      dto.campaignId
        ? this.prisma.leadCampaign.findFirst({
            where: {
              id: dto.campaignId,
              tenantId,
              isActive: true,
              ...(dto.sourceId ? { sourceId: dto.sourceId } : {}),
            },
            select: { id: true },
          })
        : undefined,
      dto.labelIds !== undefined
        ? this.prisma.leadLabel.findMany({
            where: {
              id: { in: dto.labelIds },
              tenantId,
              isActive: true,
            },
            select: { id: true, type: true },
          })
        : undefined,
    ]);

    if (dto.assignedUserId && !assignedUser) throw new Error('Assigned user not found');
    if ('sourceUserId' in dto && dto.sourceUserId && !sourceUser) {
      throw new Error('Source user not found');
    }
    if ('stageId' in dto && dto.stageId && !stage) throw new Error('Stage not found');
    if (dto.statusId && !status) throw new Error('Status not found');
    if (dto.sourceId && !source) throw new Error('Source not found');
    if (dto.locationId && !location) throw new Error('Location not found');
    if (dto.projectId && !project) throw new Error('Project not found');
    if (dto.productVariantId && !productVariant) {
      throw new Error('Product variant not found for the selected project');
    }
    if (dto.campaignId && !campaign) {
      throw new Error('Campaign not found for the selected source');
    }
    if (dto.labelIds !== undefined) {
      if (new Set(dto.labelIds).size !== dto.labelIds.length) {
        throw new Error('labelIds must not contain duplicates');
      }
      if ((labels?.length ?? 0) !== dto.labelIds.length) {
        throw new Error('One or more active Lead labels were not found');
      }
      if ((labels ?? []).filter((label) => label.type === 'TEMPERATURE').length > 1) {
        throw new Error('A Lead can only have one Temperature label');
      }
    }
  }

  private async logAudit(params: {
    tenantId: string;
    entityId: string;
    entityType: string;
    actorId: string | undefined;
    action: string;
    changes?: any;
  }) {
    if (!this.auditLogRepository) return;
    try {
      await this.auditLogRepository.create({
        tenant: { connect: { id: params.tenantId } },
        entityId: params.entityId,
        entityType: params.entityType,
        actor: params.actorId ? { connect: { id: params.actorId } } : undefined,
        action: params.action,
        changes: params.changes,
      });
    } catch (error) {
      console.error('Audit Log Error:', error);
      // Don't throw to avoid breaking the main flow
    }
  }

  async createLead(dto: CreateLeadDTO, currentUserId?: string) {
    if (!dto.tenantId || !dto.firstName) {
      throw new Error('Missing required fields: tenantId or firstName');
    }

    await this.validateRelations(dto, dto.tenantId);

    const defaultStage = this.prisma
      ? await this.prisma.stage.findFirst({
          where: {
            tenantId: dto.tenantId,
            entityType: 'lead',
            isDefaultStage: true,
            isActive: true,
          },
          select: { id: true },
        })
      : undefined;

    const createdAt = new Date();
    const assigneeId = dto.assignedUserId || currentUserId;
    const data: any = {
      tenant: { connect: { id: dto.tenantId } },
      type: dto.type,
      budget: dto.budget,
      priority: dto.priority ?? 'MEDIUM',
      converted: dto.createDeal === true,
      convertedDate: dto.createDeal === true ? createdAt : undefined,
      assignedUser: assigneeId ? { connect: { id: assigneeId } } : undefined,
      sourceUser: dto.sourceUserId ? { connect: { id: dto.sourceUserId } } : undefined,
      source: dto.sourceId ? { connect: { id: dto.sourceId } } : undefined,
      location: dto.locationId ? { connect: { id: dto.locationId } } : undefined,
      project: dto.projectId ? { connect: { id: dto.projectId } } : undefined,
      productVariant: dto.productVariantId
        ? { connect: { id: dto.productVariantId } }
        : undefined,
      campaign: dto.campaignId ? { connect: { id: dto.campaignId } } : undefined,
      labelAssignments: dto.labelIds?.length
        ? {
            create: dto.labelIds.map((labelId) => ({
              tenant: { connect: { id: dto.tenantId } },
              label: { connect: { id: labelId } },
            })),
          }
        : undefined,
      stage: defaultStage ? { connect: { id: defaultStage.id } } : undefined,
      customer: {
        create: {
          tenant: { connect: { id: dto.tenantId } },
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phoneNumber: dto.phone,
          age: dto.age,
          gender: dto.gender,
          salutation: dto.salutation,
          location: dto.location,
          ...(dto.organizationName
            ? {
                organization: {
                  create: {
                    tenant: { connect: { id: dto.tenantId } },
                    name: dto.organizationName,
                    location: dto.organizationLocation,
                  },
                },
              }
            : {}),
        },
      },
      status: dto.statusId ? { connect: { id: dto.statusId } } : undefined,
      ...(dto.notes
        ? {
            activities: {
              create: {
                tenant: { connect: { id: dto.tenantId } },
                activityType: 'registration',
                notes: {
                  create: {
                    content: dto.notes,
                  },
                },
              },
            },
          }
        : {}),
    };

    if (dto.createDeal && this.prisma) {
      return this.prisma.$transaction(async (tx) => {
        const lead = await tx.lead.create({ data });
        await tx.deal.create({
          data: {
            tenant: { connect: { id: dto.tenantId } },
            lead: { connect: { id: lead.id } },
            ...(assigneeId ? { assignedUser: { connect: { id: assigneeId } } } : {}),
            ...(dto.sourceId ? { source: { connect: { id: dto.sourceId } } } : {}),
            dealType: dto.type || 'new-lead',
            expectedAmount: dto.budget ?? 0,
            currency: 'IDR',
            refCode: `DEAL-${randomUUID()}`,
          },
        });
        return lead;
      });
    }

    const lead = await this.leadRepository.create(data);
    if (dto.createDeal) {
      await this.dealRepository.create({
        tenant: { connect: { id: dto.tenantId } },
        lead: { connect: { id: (lead as any).id } },
        assignedUser: assigneeId ? { connect: { id: assigneeId } } : undefined,
        source: dto.sourceId ? { connect: { id: dto.sourceId } } : undefined,
        dealType: dto.type || 'new-lead',
        expectedAmount: dto.budget ?? 0,
        currency: 'IDR',
        refCode: `DEAL-${randomUUID()}`,
      });
    }
    return lead;
  }

  async getLead(id: string, tenantId?: string, role?: string, currentUserId?: string) {
    if (!tenantId) throw new Error('Tenant context missing');
    const lead = await this.leadRepository.findOne({ id, tenantId, isDeleted: false }, {
      customer: {
        include: {
          organization: true,
        },
      },
      status: true,
      stage: true,
      activities: {
        include: {
          notes: true,
          tasks: {
            include: {
              assignedUser: { select: USER_PUBLIC_FIELDS },
            },
          },
          callLogs: true,
          actor: { select: USER_PUBLIC_FIELDS },
        },
      },
      attachments: true,
      location: true,
      assignedUser: { select: USER_PUBLIC_FIELDS },
      sourceUser: { select: USER_PUBLIC_FIELDS },
      source: true,
      project: true,
      productVariant: true,
      campaign: true,
      labelAssignments: {
        include: { label: true },
        orderBy: { createdAt: 'asc' },
      },
      viewings: {
        include: {
          status: true,
          location: true,
          source: true,
          actor: { select: USER_PUBLIC_FIELDS },
          attachments: true,
          slot: true,
        },
        orderBy: { scheduledAt: 'desc' },
      },
    });
    if (!lead) {
      throw new Error('Lead not found');
    }
    if (role && role !== 'owner' && (lead as any).assignedUserId !== currentUserId) {
      throw new Error('Unauthorized to access this Lead');
    }
    const history = this.prisma
      ? await this.prisma.auditLog.findMany({
          where: { tenantId, entityId: id, entityType: 'lead' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            changes: true,
            createdAt: true,
            actor: { select: USER_PUBLIC_FIELDS },
          },
        })
      : [];
    const { labelAssignments, ...leadData } = lead as any;
    return {
      ...leadData,
      labels: (labelAssignments ?? []).map((assignment: any) => assignment.label),
      history,
    };
  }

  async updateLead(id: string, dto: UpdateLeadDTO, role: string, currentUserId?: string, tenantId?: string) {
    if (role !== 'owner') {
      delete dto.assignedUserId;
    }

    const lead: any = await this.getLead(id, tenantId, role, currentUserId);

    if (!tenantId) throw new Error('Tenant context missing');
    await this.validateRelations(dto, tenantId);

    const updateData: any = {};
    const auditChanges: any = {};

    if (dto.statusId) {
      updateData.status = { connect: { id: dto.statusId } };
      auditChanges.statusId = { old: lead.statusId, new: dto.statusId };
    }
    if (dto.assignedUserId) {
      updateData.assignedUser = { connect: { id: dto.assignedUserId } };
      auditChanges.assignedUserId = { old: lead.assignedUserId, new: dto.assignedUserId };
    } else if (dto.assignedUserId === '') {
      updateData.assignedUser = { disconnect: true };
      auditChanges.assignedUserId = { old: lead.assignedUserId, new: null };
    }

    if (dto.stageId) {
      updateData.stage = { connect: { id: dto.stageId } };
      auditChanges.stageId = { old: lead.stageId, new: dto.stageId };
    }

    if (dto.locationId) {
      updateData.location = { connect: { id: dto.locationId } };
      auditChanges.locationId = { old: lead.locationId, new: dto.locationId };
    }

    if (dto.projectId) {
      updateData.project = { connect: { id: dto.projectId } };
    } else if (dto.projectId === '') {
      updateData.project = { disconnect: true };
    }
    if (dto.productVariantId) {
      updateData.productVariant = { connect: { id: dto.productVariantId } };
    } else if (dto.productVariantId === '') {
      updateData.productVariant = { disconnect: true };
    }
    if (dto.campaignId) {
      updateData.campaign = { connect: { id: dto.campaignId } };
    } else if (dto.campaignId === '') {
      updateData.campaign = { disconnect: true };
    }
    if (dto.budget !== undefined) updateData.budget = dto.budget;
    if (dto.priority !== undefined) {
      updateData.priority = dto.priority;
      auditChanges.priority = { old: lead.priority, new: dto.priority };
    }

    if (dto.labelIds !== undefined) {
      updateData.labelAssignments = {
        deleteMany: {},
        create: dto.labelIds.map((labelId) => ({
          tenant: { connect: { id: tenantId } },
          label: { connect: { id: labelId } },
        })),
      };
      auditChanges.labelIds = {
        old: lead.labels.map((label: { id: string }) => label.id),
        new: dto.labelIds,
      };
    }

    if (dto.type) {
      updateData.type = dto.type;
    }
    if (dto.converted !== undefined) {
      updateData.converted = dto.converted;
    }
    if (dto.convertedDate) {
      updateData.convertedDate = dto.convertedDate;
    }

    if (dto.sourceId) {
      updateData.source = { connect: { id: dto.sourceId } };
    } else if (dto.sourceId === '') {
      updateData.source = { disconnect: true };
    }

    const customerData: any = {};
    if (dto.firstName) customerData.firstName = dto.firstName;
    if (dto.lastName !== undefined) customerData.lastName = dto.lastName;
    if (dto.email !== undefined) customerData.email = dto.email;
    if (dto.phone !== undefined) customerData.phoneNumber = dto.phone;
    if (dto.age !== undefined) customerData.age = dto.age;
    if (dto.gender !== undefined) customerData.gender = dto.gender;
    if (dto.salutation !== undefined) customerData.salutation = dto.salutation;
    if (dto.location !== undefined) customerData.location = dto.location;

    if (dto.organizationName || dto.organizationLocation) {
      if (lead.customer.organizationId) {
        customerData.organization = {
          update: {
            ...(dto.organizationName && { name: dto.organizationName }),
            ...(dto.organizationLocation && { location: dto.organizationLocation }),
          },
        };
      } else {
        customerData.organization = {
          create: {
            tenant: { connect: { id: lead.tenantId } },
            name: dto.organizationName || 'Unknown',
            location: dto.organizationLocation,
          },
        };
      }
    }

    if (Object.keys(customerData).length > 0 && this.customerRepository) {
      await this.customerRepository.update(lead.customerId, customerData);
    }

    const updatedLead = await this.leadRepository.update(id, updateData);

    if (Object.keys(auditChanges).length > 0) {
      await this.logAudit({
        tenantId: lead.tenantId,
        entityId: id,
        entityType: 'lead',
        actorId: currentUserId,
        action: 'update',
        changes: auditChanges,
      });
    }

    return updatedLead;
  }

  async deleteLead(id: string, tenantId?: string, role?: string, currentUserId?: string) {
    const lead: any = await this.getLead(id, tenantId, role, currentUserId);
    const archived = await this.leadRepository.update(id, { isDeleted: true });
    await this.logAudit({
      tenantId: lead.tenantId,
      entityId: id,
      entityType: 'lead',
      actorId: currentUserId,
      action: 'archive',
    });
    return archived;
  }

  async getAllLeads(
    tenantId: string,
    page: number = 1,
    limit: number = 10,
    filters: any = {},
    search?: string,
    role?: string,
    currentUserId?: string
  ) {
    const skip = (page - 1) * limit;
    const take = limit;
    const { labelId, ...directFilters } = filters;
    if (labelId !== undefined && (typeof labelId !== 'string' || !/^[0-9a-f-]{36}$/i.test(labelId))) {
      throw new Error('labelId must be a valid ID');
    }
    const where: Prisma.LeadWhereInput = {
      ...directFilters,
      tenantId,
      isDeleted: false,
      ...(labelId
        ? {
            labelAssignments: {
              some: { tenantId, labelId },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { customer: { is: { firstName: { contains: search } } } },
              { customer: { is: { lastName: { contains: search } } } },
              { customer: { is: { email: { contains: search } } } },
              { customer: { is: { phoneNumber: { contains: search } } } },
            ],
          }
        : {}),
      ...(role && role !== 'owner' ? { assignedUserId: currentUserId } : {}),
    };

    const [data, total] = await Promise.all([
      this.leadRepository.findAll({
        where,
        skip,
        take,
        include: {
          customer: {
            include: {
              organization: true,
            },
          },
          status: true,
          stage: true,
          location: true,
          assignedUser: { select: USER_PUBLIC_FIELDS },
          sourceUser: { select: USER_PUBLIC_FIELDS },
          source: true,
          project: true,
          productVariant: true,
          campaign: true,
          labelAssignments: {
            include: { label: true },
            orderBy: { createdAt: 'asc' },
          },
          activities: {
            select: {
              id: true,
              activityType: true,
              createdAt: true,
              tasks: {
                select: {
                  id: true,
                  dueDate: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          viewings: {
            select: {
              id: true,
              status: true,
              scheduledAt: true,
              location: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.leadRepository.count(where),
    ]);

    const mappedData = data.map((lead: any) => {
      const { viewings, labelAssignments, ...leadData } = lead;
      return {
        ...leadData,
        labels: (labelAssignments ?? []).map((assignment: any) => assignment.label),
        viewing: viewings && viewings.length > 0 ? viewings[0] : null,
      };
    });

    return {
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async convertLeadToDeal(
    id: string,
    dealData: any,
    tenantId?: string,
    role?: string,
    currentUserId?: string
  ) {
    const lead = await this.getLead(id, tenantId, role, currentUserId);

    if (lead.converted) {
      throw new Error('Lead already converted');
    }

    const dealPayload = {
      tenant: { connect: { id: lead.tenantId } },
      lead: { connect: { id: lead.id } },
      dealType: lead.type,
      expectedAmount: dealData.expectedAmount || 0,
      currency: dealData.currency || 'USD',
      refCode: `DEAL-${Date.now()}`,
      closingDate: new Date(),
    };

    if (this.prisma) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.lead.updateMany({
          where: { id, tenantId: lead.tenantId, converted: false, isDeleted: false },
          data: { converted: true, convertedDate: new Date() },
        });
        if (updated.count !== 1) throw new Error('Lead already converted');

        const deal = await tx.deal.create({ data: dealPayload });

        if (this.leadActivityRepository) {
          await tx.leadActivity.create({
            data: {
              tenant: { connect: { id: lead.tenantId } },
              lead: { connect: { id: lead.id } },
              activityType: 'conversion',
              notes: { create: { content: `Lead converted to deal: ${deal.refCode}` } },
            },
          });
        }

        return deal;
      });
    }

    await this.leadRepository.update(id, {
      converted: true,
      convertedDate: new Date(),
    });

    const deal = await this.dealRepository.create(dealPayload);

    // 3. Add activity for lead conversion
    if (this.leadActivityRepository) {
      await this.leadActivityRepository.create({
        tenant: { connect: { id: lead.tenantId } },
        lead: { connect: { id: lead.id } },
        activityType: 'conversion',
        notes: {
          create: {
            content: `Lead converted to deal: ${deal.refCode}`,
          },
        },
      });
    }

    return deal;
  }

  async setStatus(
    id: string,
    statusName: string,
    tenantId: string,
    role?: string,
    currentUserId?: string
  ) {
    if (!this.statusRepository) {
      throw new Error('Status repository not initialized');
    }

    const status = await this.statusRepository.findOne({
      tenantId: tenantId,
      name: statusName,
    });

    if (!status) {
      throw new Error(
        `Status "${statusName}" not found in your organization. Please create it first in the Statuses configuration.`
      );
    }

    await this.getLead(id, tenantId, role, currentUserId);

    return this.leadRepository.update(id, {
      statusId: status.id,
    });
  }

  async setStage(
    id: string,
    stageName: string,
    tenantId: string,
    evidenceAttachmentIds: string[] = [],
    role?: string,
    currentUserId?: string
  ) {
    if (!this.stageRepository) {
      throw new Error('Stage repository not initialized');
    }

    const stage: any = this.prisma
      ? await this.prisma.stage.findFirst({
          where: { tenantId, name: stageName, entityType: 'lead', isActive: true },
          include: { evidences: { orderBy: { sortOrder: 'asc' } } },
        })
      : await this.stageRepository.findOne({ tenantId, name: stageName, entityType: 'lead' });

    if (!stage) {
      throw new Error(
        `Stage "${stageName}" not found in your organization. Please create it first in the Stages configuration.`
      );
    }

    const lead: any = await this.getLead(id, tenantId, role, currentUserId);

    const requiredEvidence = (stage.evidences ?? []).filter(
      (evidence: { isRequired: boolean }) => evidence.isRequired
    );
    if (requiredEvidence.length > 0) {
      if (!this.prisma || evidenceAttachmentIds.length !== requiredEvidence.length) {
        throw new Error('Required stage evidence is missing');
      }
      const uniqueIds = [...new Set(evidenceAttachmentIds)];
      if (uniqueIds.length !== evidenceAttachmentIds.length) {
        throw new Error('Evidence attachments must be unique');
      }
      const attachments = await this.prisma.attachment.findMany({
        where: { id: { in: evidenceAttachmentIds }, tenantId, leadId: id },
        select: { id: true, fileType: true },
      });
      const byId = new Map(attachments.map((attachment) => [attachment.id, attachment]));
      const matchesType = (mime: string, allowed: unknown) => {
        const types = Array.isArray(allowed) ? allowed : [];
        return types.some((type) => {
          if (type === 'PDF') return mime === 'application/pdf';
          if (type === 'IMAGE') return mime.startsWith('image/');
          if (type === 'DOC') {
            return [
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ].includes(mime);
          }
          if (type === 'SHEET') {
            return [
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ].includes(mime);
          }
          return false;
        });
      };
      requiredEvidence.forEach((requirement: { name: string; fileTypes: unknown }, index: number) => {
        const attachmentId = evidenceAttachmentIds[index];
        if (!attachmentId) throw new Error(`Required evidence "${requirement.name}" is missing`);
        const attachment = byId.get(attachmentId);
        if (!attachment) throw new Error(`Required evidence "${requirement.name}" is missing`);
        if (!matchesType(attachment.fileType ?? '', requirement.fileTypes)) {
          throw new Error(`Evidence "${requirement.name}" has an unsupported file type`);
        }
      });
    }

    const updated = await this.leadRepository.update(id, {
      stageId: stage.id,
    });
    await this.logAudit({
      tenantId,
      entityId: id,
      entityType: 'lead',
      actorId: currentUserId,
      action: 'stage-change',
      changes: { stageId: { old: lead.stageId, new: stage.id } },
    });
    return updated;
  }

  async logActivity(
    leadId: string,
    activityType: string,
    actorId?: string,
    details?: {
      notes?: string;
      task?: {
        title: string;
        description?: string;
        dueDate?: Date;
        priority?: string;
        assignedUserId?: string;
      };
      call?: {
        title?: string;
        description?: string;
        duration?: number;
        callingNumber?: string;
        receivingNumber?: string;
      };
    }
  ) {
    if (!this.leadActivityRepository) {
      throw new Error('Lead activity repository not initialized');
    }

    const lead = await this.leadRepository.findById(leadId);
    if (!lead) throw new Error('Lead not found');

    const activityData: any = {
      tenant: { connect: { id: lead.tenantId } },
      lead: { connect: { id: lead.id } },
      customer: { connect: { id: lead.customerId } },
      activityType,
      actor: actorId ? { connect: { id: actorId } } : undefined,
    };

    if (details?.notes) {
      activityData.notes = {
        create: {
          content: details.notes,
        },
      };
    }

    if (details?.task) {
      activityData.tasks = {
        create: {
          title: details.task.title,
          description: details.task.description,
          dueDate: details.task.dueDate,
          priority: details.task.priority || 'normal',
          assignedUser: details.task.assignedUserId
            ? { connect: { id: details.task.assignedUserId } }
            : undefined,
        },
      };
    }

    if (details?.call) {
      activityData.callLogs = {
        create: {
          title: details.call.title,
          description: details.call.description,
          duration: details.call.duration,
          callingNumber: details.call.callingNumber,
          receivingNumber: details.call.receivingNumber,
        },
      };
    }

    return this.leadActivityRepository.create(activityData);
  }
}
