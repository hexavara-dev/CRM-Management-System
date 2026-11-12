import type { Request } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { IRepository } from '../domain/repositories/IRepository.js';
import { extractFilters } from '../infrastructure/utils/QueryHelper.js';
import { parsePagination } from '../infrastructure/utils/RequestValidation.js';

const GENERIC_CREATE_FIELDS: Record<string, readonly string[]> = {
  source: ['name', 'type', 'color'],
  organization: ['name', 'location'],
  customer: [
    'organizationId',
    'firstName',
    'lastName',
    'phoneNumber',
    'email',
    'gender',
    'salutation',
    'location',
  ],
  location: ['name', 'description', 'metadata'],
  itemcategory: ['name', 'parentId'],
  item: ['categoryId', 'name', 'sku', 'unit', 'basePrice', 'currency', 'color', 'attributes'],
  inventoryslot: ['locationId', 'parentId', 'label', 'status', 'metadata'],
  gridconfig: ['slotId', 'gridRow', 'gridCol', 'rowLabel', 'colLabel'],
  leaditem: ['leadId', 'itemId', 'slotId', 'quantity'],
  entry: ['slotId', 'itemId', 'quantity', 'reservedQuantity', 'entryType', 'validFrom', 'validUntil'],
  operation: ['operationType', 'notes'],
  record: [
    'entryId',
    'dealId',
    'operationId',
    'locationId',
    'slotId',
    'itemId',
    'quantityDelta',
    'quantityBefore',
    'quantityAfter',
    'fromSlotId',
    'toSlotId',
    'unitPrice',
    'snapshotData',
  ],
  leadactivity: ['leadId', 'customerId', 'activityType', 'callLogs', 'tasks', 'notes'],
  dealactivity: ['dealId', 'customerId', 'activityType', 'callLogs', 'tasks', 'notes'],
};

const GENERIC_UPDATE_FIELDS: Record<string, readonly string[]> = {
  source: ['name', 'type', 'color'],
  organization: ['name', 'location'],
  customer: [
    'organizationId',
    'firstName',
    'lastName',
    'phoneNumber',
    'email',
    'gender',
    'salutation',
    'location',
  ],
  location: ['name', 'description', 'metadata'],
  itemcategory: ['name', 'parentId'],
  item: ['categoryId', 'name', 'sku', 'unit', 'basePrice', 'currency', 'color', 'attributes'],
  inventoryslot: ['locationId', 'parentId', 'label', 'status', 'metadata'],
  gridconfig: ['gridRow', 'gridCol', 'rowLabel', 'colLabel'],
  leaditem: ['slotId', 'quantity'],
  entry: ['quantity', 'reservedQuantity', 'entryType', 'validFrom', 'validUntil'],
  operation: ['notes'],
};

const NESTED_ACTIVITY_FIELDS: Record<string, readonly string[]> = {
  callLogs: ['title', 'description', 'startDate', 'duration', 'outcome'],
  tasks: ['title', 'description', 'startDate', 'dueDate', 'priority', 'assignedUserId'],
  notes: ['title', 'content'],
};

export class GenericUseCases {
  constructor(
    private repository: IRepository<any>,
    private prisma?: PrismaClient
  ) {}

  private async validateTenantRelations(modelName: string, payload: any, tenantId: string) {
    if (!this.prisma) return;

    if (modelName === 'customer' && payload.organizationId) {
      const organization = await this.prisma.organization.findFirst({
        where: { id: payload.organizationId, tenantId },
        select: { id: true },
      });
      if (!organization) throw new Error('Organization not found');
    }

    const relationPolicies: Record<
      string,
      Array<{ field: string; delegate: string; label: string; extraWhere?: Record<string, unknown> }>
    > = {
      itemcategory: [
        { field: 'parentId', delegate: 'itemCategory', label: 'Parent category' },
      ],
      item: [{ field: 'categoryId', delegate: 'itemCategory', label: 'Item category' }],
      inventoryslot: [
        { field: 'locationId', delegate: 'location', label: 'Location' },
        { field: 'parentId', delegate: 'inventorySlot', label: 'Parent inventory slot' },
      ],
      gridconfig: [{ field: 'slotId', delegate: 'inventorySlot', label: 'Inventory slot' }],
      leaditem: [
        { field: 'leadId', delegate: 'lead', label: 'Lead', extraWhere: { isDeleted: false } },
        { field: 'itemId', delegate: 'item', label: 'Item' },
        { field: 'slotId', delegate: 'inventorySlot', label: 'Inventory slot' },
      ],
      entry: [
        { field: 'slotId', delegate: 'inventorySlot', label: 'Inventory slot' },
        { field: 'itemId', delegate: 'item', label: 'Item' },
      ],
      record: [
        { field: 'entryId', delegate: 'entry', label: 'Entry' },
        { field: 'dealId', delegate: 'deal', label: 'Deal' },
        { field: 'operationId', delegate: 'operation', label: 'Operation' },
        { field: 'locationId', delegate: 'location', label: 'Location' },
        { field: 'slotId', delegate: 'inventorySlot', label: 'Inventory slot' },
        { field: 'itemId', delegate: 'item', label: 'Item' },
        { field: 'fromSlotId', delegate: 'inventorySlot', label: 'Source inventory slot' },
        { field: 'toSlotId', delegate: 'inventorySlot', label: 'Destination inventory slot' },
      ],
    };

    await Promise.all(
      (relationPolicies[modelName] ?? []).map(async ({ field, delegate, label, extraWhere }) => {
        const relationId = payload[field];
        if (!relationId) return;
        const related = await (this.prisma as any)[delegate].findFirst({
          where: { id: relationId, tenantId, ...extraWhere },
          select: { id: true },
        });
        if (!related) throw new Error(`${label} not found`);
      })
    );
  }

  private validateWritePayload(modelName: string, payload: any, operation: 'create' | 'update') {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Request payload must be an object');
    }

    const policy = operation === 'create' ? GENERIC_CREATE_FIELDS : GENERIC_UPDATE_FIELDS;
    const allowedFields = policy[modelName];
    if (!allowedFields) {
      throw new Error(`${operation === 'create' ? 'Create' : 'Update'} is not supported for this resource`);
    }

    const ignoredSecurityFields = new Set(['tenant', 'tenantId']);
    const unknownFields = Object.keys(payload).filter(
      (key) => !ignoredSecurityFields.has(key) && !allowedFields.includes(key)
    );
    if (unknownFields.length > 0) {
      throw new Error(`Unsupported field(s): ${unknownFields.join(', ')}`);
    }

    if (operation === 'update') {
      const suppliedFields = Object.keys(payload).filter((key) => !ignoredSecurityFields.has(key));
      if (suppliedFields.length === 0) throw new Error('No supported fields to update');
    }

    if (modelName === 'leadactivity' || modelName === 'dealactivity') {
      for (const relationName of Object.keys(NESTED_ACTIVITY_FIELDS)) {
        const relation = payload[relationName];
        if (relation === undefined) continue;
        if (!relation || typeof relation !== 'object' || Array.isArray(relation)) {
          throw new Error(`Invalid ${relationName} payload`);
        }
        const createPayload = relation.create;
        if (!createPayload || typeof createPayload !== 'object' || Array.isArray(createPayload)) {
          throw new Error(`Invalid ${relationName} create payload`);
        }
        const nestedUnknown = Object.keys(createPayload).filter(
          (key) => !NESTED_ACTIVITY_FIELDS[relationName]!.includes(key)
        );
        if (nestedUnknown.length > 0) {
          throw new Error(`Unsupported ${relationName} field(s): ${nestedUnknown.join(', ')}`);
        }
      }
    }
  }

  private sanitize(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }
    if (data !== null && typeof data === 'object') {
      if (data instanceof Date) return data;
      const sanitized = { ...data };
      if ('password' in sanitized) {
        delete sanitized.password;
      }
      for (const key in sanitized) {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
      return sanitized;
    }
    return data;
  }

  async create(req: Request, dto: any) {
    if (!dto) {
      throw new Error('Missing request body');
    }
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new Error('Tenant context missing');
    const payload = structuredClone(dto.data ?? dto);
    const modelName = ((this.repository as any).modelName || '').toLowerCase();
    this.validateWritePayload(modelName, payload, 'create');
    delete payload.tenant;
    await this.validateTenantRelations(modelName, payload, tenantId);

    if (modelName === 'operation') {
      const userId = (req as any).user?.userId;
      if (!userId) throw new Error('User context missing');
      payload.userId = userId;
    }

    if (modelName === 'leadactivity' || modelName === 'dealactivity') {
      const actorId = (req as any).user?.userId;
      if (!actorId) throw new Error('User context missing');
      const parentId = modelName === 'leadactivity' ? payload.leadId : payload.dealId;
      if (!parentId || typeof parentId !== 'string') {
        throw new Error(modelName === 'leadactivity' ? 'Lead is required' : 'Deal is required');
      }

      if (this.prisma) {
        const parent =
          modelName === 'leadactivity'
            ? await this.prisma.lead.findFirst({
                where: { id: parentId, tenantId, isDeleted: false },
                select: { id: true },
              })
            : await this.prisma.deal.findFirst({
                where: { id: parentId, tenantId },
                select: { id: true },
              });
        if (!parent) {
          throw new Error(modelName === 'leadactivity' ? 'Lead not found' : 'Deal not found');
        }

        if (payload.customerId) {
          const customer = await this.prisma.customer.findFirst({
            where: { id: payload.customerId, tenantId },
            select: { id: true },
          });
          if (!customer) throw new Error('Customer not found');
        }

        const assignedUserId = payload.tasks?.create?.assignedUserId;
        if (assignedUserId) {
          const assignedUser = await this.prisma.user.findFirst({
            where: { id: assignedUserId, tenantId },
            select: { id: true },
          });
          if (!assignedUser) throw new Error('Assigned user not found');
        }
      }

      delete payload.tenantId;
      payload.tenant = { connect: { id: tenantId } };
      payload.actor = { connect: { id: actorId } };

      if (payload.customerId) {
        payload.customer = { connect: { id: payload.customerId } };
        delete payload.customerId;
      }

      for (const relationName of Object.keys(NESTED_ACTIVITY_FIELDS)) {
        if (payload[relationName]?.create) {
          payload[relationName].create.tenantId = tenantId;
        }
      }

      if (modelName === 'leadactivity' && payload.leadId) {
        payload.lead = { connect: { id: payload.leadId } };
        delete payload.leadId;
      }
      if (modelName === 'dealactivity' && payload.dealId) {
        payload.deal = { connect: { id: payload.dealId } };
        delete payload.dealId;
      }
    } else {
      payload.tenantId = tenantId;
    }

    dto = dto.data ? { ...dto, data: payload } : payload;
    const result = await this.repository.create(dto);
    return this.sanitize(result);
  }

  async getById(req: Request, id: string, include?: any) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new Error('Tenant context missing');
    const record = await this.repository.findOne({ id, tenantId }, include);
    if (!record) {
      throw new Error('Record not found');
    }
    return this.sanitize(record);
  }

  async update(req: Request, id: string, dto: any) {
    if (!dto) {
      throw new Error('Missing update payload');
    }
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new Error('Tenant context missing');
    const modelName = ((this.repository as any).modelName || '').toLowerCase();
    const payload = structuredClone(dto.data ?? dto);
    this.validateWritePayload(modelName, payload, 'update');
    const existing = await this.repository.findOne({ id, tenantId });
    if (!existing) throw new Error('Record not found');
    delete payload.tenantId;
    delete payload.tenant;
    await this.validateTenantRelations(modelName, payload, tenantId);
    const result = await this.repository.update(id, payload);
    return this.sanitize(result);
  }

  async delete(req: Request, id: string) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new Error('Tenant context missing');
    const modelName = ((this.repository as any).modelName || '').toLowerCase();
    if (!GENERIC_CREATE_FIELDS[modelName]) {
      throw new Error('Delete is not supported for this resource');
    }
    const existing = await this.repository.findOne({ id, tenantId });
    if (!existing) throw new Error('Record not found');
    const result = await this.repository.delete(id);
    return this.sanitize(result);
  }

  async getAll(req: Request, include?: any) {
    const tenantId = (req as any).user?.tenantId;
    const filters = extractFilters(req.query);

    if (!req.query.page && !req.query.limit) {
      if (!tenantId) throw new Error('Tenant context missing');
      const where: any = { ...filters, tenantId };
      const datawithoutpagination = await this.repository.findAll(include, where);
      return {
        data: this.sanitize(datawithoutpagination),
      };
    }

    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const skip = (page - 1) * limit;

    if (!tenantId) throw new Error('Tenant context missing');
    const where: any = { ...filters, tenantId };
    const modelName = (this.repository as any).modelName;

    const modelsWithCreatedAt = [
      'company',
      'user',
      'customer',
      'lead',
      'leaditem',
      'deal',
      'leadactivity',
      'dealactivity',
      'item',
      'location',
      'operation',
      'record',
      'viewing',
      'attachment',
      'auditlog',
    ];

    const applyOrderBy = modelsWithCreatedAt.includes(modelName.toLowerCase());

    const [data, total] = await Promise.all([
      this.repository.findAll({
        where,
        include,
        skip,
        take: limit,
        orderBy: applyOrderBy ? { createdAt: 'desc' } : undefined,
      }),
      (this.repository as any).count(where),
    ]);

    return {
      data: this.sanitize(data),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
