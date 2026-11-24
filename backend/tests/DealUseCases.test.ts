import type { IRepository } from '../src/domain/repositories/IRepository.js';
import { DealUseCases } from '../src/usecases/deal/DealUseCases.js';
import { jest } from '@jest/globals';

class MockRepository implements IRepository<any> {
  constructor(public items: any[] = []) {}

  get delegate() {
    return {
      findUnique: async ({ where }: any) => this.findById(where.id),
    };
  }

  async create(data: any) {
    this.items.push(data);
    return data;
  }

  async findById(id: string) {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async findOne(where: any) {
    return (
      this.items.find((item) =>
        Object.entries(where).every(([key, value]) => item[key] === value)
      ) ?? null
    );
  }

  async update(id: string, data: any) {
    const item = await this.findById(id);
    if (!item) throw new Error('Not found');
    Object.assign(item, data);
    return item;
  }

  async delete(id: string) {
    const item = await this.findById(id);
    if (!item) throw new Error('Not found');
    return item;
  }

  async findAll() {
    return this.items;
  }
}

describe('DealUseCases.updateDeal', () => {
  it('moves a deal to another stage without resetting its amount', async () => {
    const dealRepo = new MockRepository([
      { id: 'deal-1', tenantId: 'tenant-1', stageId: 'stage-1', amount: 750000 },
    ]);
    const stageRepo = new MockRepository([
      { id: 'stage-2', tenantId: 'tenant-1', entityType: 'deal' },
    ]);
    const useCases = new DealUseCases(
      dealRepo,
      undefined,
      undefined,
      undefined,
      stageRepo
    );

    const result = await useCases.updateDeal(
      'deal-1',
      { stageId: 'stage-2' },
      'tenant-1'
    );

    expect(result.stageId).toBe('stage-2');
    expect(result.amount).toBe(750000);
  });

  it('rejects a stage owned by another tenant', async () => {
    const dealRepo = new MockRepository([
      { id: 'deal-1', tenantId: 'tenant-1', stageId: 'stage-1', amount: 750000 },
    ]);
    const stageRepo = new MockRepository([
      { id: 'stage-2', tenantId: 'tenant-2', entityType: 'deal' },
    ]);
    const useCases = new DealUseCases(
      dealRepo,
      undefined,
      undefined,
      undefined,
      stageRepo
    );

    await expect(
      useCases.updateDeal('deal-1', { stageId: 'stage-2' }, 'tenant-1')
    ).rejects.toThrow('Stage not found');
  });
});

describe('DealUseCases.createDeal', () => {
  it('creates the deal and its initial activity in one transaction', async () => {
    const dealRepo = new MockRepository();
    const activityRepo = new MockRepository();
    const dealCreate = jest.fn().mockResolvedValue({
      id: 'deal-1',
      tenantId: 'tenant-1',
      refCode: 'DEAL-001',
    });
    const activityCreate = jest.fn().mockResolvedValue({ id: 'activity-1' });
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const transaction = jest.fn(async (callback: (tx: any) => Promise<any>) =>
      callback({
        deal: { create: dealCreate },
        dealActivity: { create: activityCreate },
        auditLog: { create: auditCreate },
      })
    );
    const useCases = new DealUseCases(
      dealRepo,
      activityRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      { $transaction: transaction } as any
    );

    const result = await useCases.createDeal({
      tenantId: 'tenant-1',
      refCode: 'DEAL-001',
      expectedAmount: 1000000,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(dealCreate).toHaveBeenCalledTimes(1);
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ activityType: 'deal_created' }),
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'deal_created' }),
    });
    expect(result.id).toBe('deal-1');
    expect(dealRepo.items).toHaveLength(0);
    expect(activityRepo.items).toHaveLength(0);
  });

  it('rejects atypical payment payloads before any transaction is started', async () => {
    const transaction = jest.fn();
    const useCases = new DealUseCases(
      new MockRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { $transaction: transaction } as any
    );

    await expect(
      useCases.createDeal({ tenantId: 'tenant-1', paymentMethod: 'KPR' })
    ).rejects.toThrow('Bank is required for KPR payment');
    await expect(
      useCases.createDeal({ tenantId: 'tenant-1', paymentMethod: 'CASH', bankName: 'BRI' })
    ).rejects.toThrow('Bank must be empty for cash payment');
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe('DealUseCases.deleteDeal', () => {
  it('never deletes a deal from another tenant', async () => {
    const repository = new MockRepository([{ id: 'deal-1', tenantId: 'tenant-a' }]);
    const useCases = new DealUseCases(repository);
    await expect(useCases.deleteDeal('deal-1', 'tenant-b')).rejects.toThrow('Deal not found');
  });

  it('removes tenant-owned child data while preserving inventory history', async () => {
    const recordUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const attachmentDeleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const dealDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = jest.fn(async (callback: (tx: any) => Promise<any>) =>
      callback({
        record: { updateMany: recordUpdateMany },
        attachment: { deleteMany: attachmentDeleteMany },
        deal: { deleteMany: dealDeleteMany },
      })
    );
    const prisma = {
      deal: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'deal-1',
          tenantId: 'tenant-1',
          payments: [],
        }),
      },
      $transaction: transaction,
    } as any;
    const useCases = new DealUseCases(
      new MockRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      prisma
    );

    const result = await useCases.deleteDeal('deal-1', 'tenant-1');

    expect(recordUpdateMany).toHaveBeenCalledWith({
      where: { dealId: 'deal-1', deal: { tenantId: 'tenant-1' } },
      data: { dealId: null },
    });
    expect(attachmentDeleteMany).toHaveBeenCalledWith({
      where: { dealId: 'deal-1', tenantId: 'tenant-1' },
    });
    expect(dealDeleteMany).toHaveBeenCalledWith({
      where: { id: 'deal-1', tenantId: 'tenant-1' },
    });
    expect(result.id).toBe('deal-1');
  });
});
