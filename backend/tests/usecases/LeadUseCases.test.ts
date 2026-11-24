import { LeadUseCases } from '../../src/usecases/lead/LeadUseCases.js';
import type { IRepository } from '../../src/domain/repositories/IRepository.js';
import { jest } from '@jest/globals';

class MockLeadRepository implements IRepository<any> {
  private db: Record<string, any> = {};

  async create(data: any) {
    const id = 'mock-' + Math.random().toString(36).substr(2, 9);
    const newRecord = { id, isDeleted: false, ...data };
    this.db[id] = newRecord;
    return newRecord;
  }

  async findById(id: string) {
    return this.db[id] || null;
  }

  async findOne(where: any) {
    return (
      Object.values(this.db).find((record) => {
        return Object.entries(where).every(([key, value]) => record[key] === value);
      }) || null
    );
  }

  async update(id: string, data: any) {
    if (!this.db[id]) throw new Error('Not found');
    this.db[id] = { ...this.db[id], ...data };
    return this.db[id];
  }

  async delete(id: string) {
    if (!this.db[id]) throw new Error('Not found');
    const element = this.db[id];
    delete this.db[id];
    return element;
  }

  async findAll(_include?: any, _where?: any) {
    return Object.values(this.db);
  }

  async count() {
    return Object.keys(this.db).length;
  }
}

describe('LeadUseCases', () => {
  let mockRepo: MockLeadRepository;
  let leadUseCases: LeadUseCases;

  beforeEach(() => {
    mockRepo = new MockLeadRepository();
    leadUseCases = new LeadUseCases(mockRepo, mockRepo);
  });

  it('should create a lead successfully if required data is provided', async () => {
    const result = await leadUseCases.createLead({
      tenantId: 'tenant-1',
      firstName: 'John',
    });

    expect(result).toHaveProperty('id');
    // Result structure depends on create implementation which builds a complex Prisma object
    // But since it's a mock, it just returns what we passed + id
  });

  it('should throw error when missing tenantId or firstName', async () => {
    await expect(leadUseCases.createLead({ lastName: 'Doe' } as any)).rejects.toThrow();
  });

  it('should get a lead by id', async () => {
    const created = await mockRepo.create({ data: 'test', tenantId: 'tenant-1' });
    const lead = await leadUseCases.getLead(created.id, 'tenant-1');
    expect(lead).toBeDefined();
  });

  it('should get all leads', async () => {
    await mockRepo.create({ name: 'Lead 1' });
    await mockRepo.create({ name: 'Lead 2' });

    const leads = await leadUseCases.getAllLeads('tenant-1');
    expect(leads.data).toHaveLength(2);
  });

  it('prevents a member from reading another sales user lead', async () => {
    const created = await mockRepo.create({ tenantId: 'tenant-1', assignedUserId: 'sales-1' });
    await expect(
      leadUseCases.getLead(created.id, 'tenant-1', 'member', 'sales-2')
    ).rejects.toThrow(/Unauthorized/);
  });

  it('requires matching tenant-owned evidence before entering a protected stage', async () => {
    const created = await mockRepo.create({ tenantId: 'tenant-1', assignedUserId: 'sales-1' });
    const prisma = {
      stage: {
        findFirst: async () => ({
          id: 'stage-qualified',
          name: 'Qualified',
          evidences: [
            { name: 'Bukti KTP', isRequired: true, fileTypes: ['PDF'] },
          ],
        }),
      },
      attachment: {
        findMany: async () => [
          {
            id: '11111111-1111-1111-1111-111111111111',
            fileType: 'application/pdf',
          },
        ],
      },
      auditLog: {
        findMany: async () => [],
      },
    };
    const useCases = new LeadUseCases(
      mockRepo as any,
      mockRepo as any,
      undefined,
      undefined,
      mockRepo as any,
      undefined,
      undefined,
      prisma as any
    );

    await expect(
      useCases.setStage(created.id, 'Qualified', 'tenant-1', [], 'member', 'sales-1')
    ).rejects.toThrow(/evidence is missing/i);

    const updated = await useCases.setStage(
      created.id,
      'Qualified',
      'tenant-1',
      ['11111111-1111-1111-1111-111111111111'],
      'member',
      'sales-1'
    );
    expect(updated.stageId).toBe('stage-qualified');
  });

  it('creates only a Lead from Add Lead even when a legacy createDeal flag is sent', async () => {
    const leadCreate = jest.fn(async ({ data }) => ({ id: 'lead-1', ...data }));
    const dealCreate = jest.fn(async ({ data }) => ({ id: 'deal-1', ...data }));
    const tx = {
      lead: { create: leadCreate },
      deal: { create: dealCreate },
    };
    const prisma = {
      user: { findFirst: jest.fn(async () => ({ id: 'user-1' })) },
      stage: { findFirst: jest.fn(async () => ({ id: 'stage-1' })) },
      status: { findFirst: jest.fn(async () => ({ id: 'status-1' })) },
      source: { findFirst: jest.fn(async () => ({ id: 'source-1' })) },
      location: { findFirst: jest.fn() },
      product: { findFirst: jest.fn(async () => ({ id: 'project-1' })) },
      productVariant: { findFirst: jest.fn(async () => ({ id: 'variant-1' })) },
      leadCampaign: { findFirst: jest.fn(async () => ({ id: 'campaign-1' })) },
      leadLabel: {
        findMany: jest.fn(async () => [{ id: 'label-1', type: 'TEMPERATURE' }]),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    const useCases = new LeadUseCases(
      mockRepo as any,
      mockRepo as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      prisma as any,
    );

    const lead = await useCases.createLead({
      tenantId: 'tenant-1',
      firstName: 'Budi Santoso',
      phone: '+628123456789',
      age: 35,
      assignedUserId: 'user-1',
      statusId: 'status-1',
      sourceId: 'source-1',
      projectId: 'project-1',
      productVariantId: 'variant-1',
      campaignId: 'campaign-1',
      budget: 550_000_000,
      labelIds: ['label-1'],
      createDeal: true,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(leadCreate).not.toHaveBeenCalled();
    expect(dealCreate).not.toHaveBeenCalled();
    expect(lead).toEqual(expect.objectContaining({
      budget: 550_000_000,
      converted: false,
      project: { connect: { id: 'project-1' } },
      productVariant: { connect: { id: 'variant-1' } },
      campaign: { connect: { id: 'campaign-1' } },
      customer: { create: expect.objectContaining({ age: 35 }) },
    }));
  });

  it('rejects a product variant or campaign outside the selected parent', async () => {
    const prisma = {
      user: { findFirst: jest.fn(async () => ({ id: 'user-1' })) },
      stage: { findFirst: jest.fn(async () => ({ id: 'stage-1' })) },
      status: { findFirst: jest.fn(async () => ({ id: 'status-1' })) },
      source: { findFirst: jest.fn(async () => ({ id: 'source-1' })) },
      location: { findFirst: jest.fn() },
      product: { findFirst: jest.fn(async () => ({ id: 'project-1' })) },
      productVariant: { findFirst: jest.fn(async () => null) },
      leadCampaign: { findFirst: jest.fn(async () => null) },
      leadLabel: { findMany: jest.fn(async () => []) },
    };
    const useCases = new LeadUseCases(
      mockRepo as any,
      mockRepo as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      prisma as any,
    );

    await expect(useCases.createLead({
      tenantId: 'tenant-1',
      firstName: 'Budi',
      phone: '08123456789',
      assignedUserId: 'user-1',
      statusId: 'status-1',
      sourceId: 'source-1',
      projectId: 'project-1',
      productVariantId: 'variant-from-another-project',
      campaignId: 'campaign-from-another-source',
    })).rejects.toThrow(/Product variant not found/i);
  });
});
