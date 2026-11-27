import { jest } from '@jest/globals';
import { LeadArchiveUseCase } from '../../src/usecases/lead/LeadArchiveUseCase.js';

const ID = '11111111-1111-1111-1111-111111111111';
const ACTOR = '22222222-2222-2222-2222-222222222222';

function createPrisma() {
  const tx = {
    lead: {
      findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn(), count: jest.fn(), groupBy: jest.fn(),
    },
    deal: { count: jest.fn() },
    leadActivity: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  return {
    ...tx,
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
}

describe('LeadArchiveUseCase', () => {
  it('archives with category, trims an optional reason, and writes both history records atomically', async () => {
    const prisma = createPrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: ID, customerId: 'customer-1' });
    prisma.lead.update.mockResolvedValue({ id: ID, archiveCategory: 'INVALID' });
    const useCase = new LeadArchiveUseCase(prisma as any);

    await expect(useCase.archive(ID, 'tenant-1', ACTOR, { category: 'INVALID', reason: '  nomor tidak aktif  ' }, 'owner')).resolves.toEqual({ id: ID, archiveCategory: 'INVALID' });
    expect(prisma.lead.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ archiveCategory: 'INVALID', archiveReason: 'nomor tidak aktif', archivedBy: { connect: { id: ACTOR } } }) }));
    expect(prisma.leadActivity.create).toHaveBeenCalledWith({ data: expect.objectContaining({ leadId: ID, customerId: 'customer-1', actorId: ACTOR, activityType: 'archive' }) });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ entityId: ID, action: 'archive', actorId: ACTOR }) });
  });

  it('reactivates without changing the last stage and clears only archive state', async () => {
    const prisma = createPrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: ID, customerId: 'customer-1', archiveCategory: 'NOT_RESPOND', archiveReason: null, stageId: 'stage-kept' });
    prisma.lead.update.mockResolvedValue({ id: ID, stageId: 'stage-kept', archivedAt: null });
    const useCase = new LeadArchiveUseCase(prisma as any);

    await useCase.reactivate(ID, 'tenant-1', ACTOR, 'owner');
    expect(prisma.lead.update).toHaveBeenCalledWith({ where: { id: ID }, data: { archiveCategory: null, archiveReason: null, archivedAt: null, archivedBy: { disconnect: true } } });
    expect(prisma.leadActivity.create).toHaveBeenCalledWith({ data: expect.objectContaining({ activityType: 'reactivation' }) });
    expect(prisma.lead.update.mock.calls[0]?.[0].data).not.toHaveProperty('stageId');
  });

  it('does not directly reactivate an archived Lead from a Lost Deal', async () => {
    const prisma = createPrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: ID, customerId: 'customer-1', archiveCategory: 'DEAL_LOST', archiveReason: 'Batal' });
    const useCase = new LeadArchiveUseCase(prisma as any);

    await expect(useCase.reactivate(ID, 'tenant-1', ACTOR, 'owner')).rejects.toThrow(/cannot be reactivated directly/i);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it('refuses permanent delete when any selected Lead is active, missing, or from another tenant', async () => {
    const prisma = createPrisma();
    prisma.lead.findMany.mockResolvedValue([{ id: ID }]);
    const useCase = new LeadArchiveUseCase(prisma as any);

    await expect(useCase.permanentDelete([ID, ACTOR], 'tenant-1', 'owner', ACTOR)).rejects.toThrow(/One or more archived Leads were not found/);
    expect(prisma.lead.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses permanent delete for Leads that already have a Deal', async () => {
    const prisma = createPrisma();
    prisma.lead.findMany.mockResolvedValue([{ id: ID }]);
    prisma.deal.count.mockResolvedValue(1);
    const useCase = new LeadArchiveUseCase(prisma as any);

    await expect(useCase.permanentDelete([ID], 'tenant-1', 'owner', ACTOR)).rejects.toThrow(/existing Deal/i);
    expect(prisma.lead.deleteMany).not.toHaveBeenCalled();
  });

  it('does not partially bulk-reactivate if one selected record is not archived', async () => {
    const prisma = createPrisma();
    prisma.lead.findFirst.mockResolvedValueOnce({ id: ID, customerId: 'customer-1', archiveCategory: 'INVALID', archiveReason: null }).mockResolvedValueOnce(null);
    prisma.lead.update.mockResolvedValue({ id: ID });
    const useCase = new LeadArchiveUseCase(prisma as any);

    await expect(useCase.bulkReactivate([ID, ACTOR], 'tenant-1', ACTOR, 'owner')).rejects.toThrow(/Archived Lead not found/);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
