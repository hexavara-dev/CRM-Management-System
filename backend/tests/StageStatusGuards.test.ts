import { jest } from '@jest/globals';
import { StageUseCase } from '../src/usecases/stage/StageUseCase.js';
import { StatusUseCase } from '../src/usecases/status/StatusUseCase.js';

describe('Stage and status uniqueness guards', () => {
  it('moves the default stage guard inside the same transaction', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockImplementation(async ({ data }) => data);
    const prisma = {
      stage: { updateMany, create },
      $transaction: async (callback: (tx: unknown) => unknown) => callback({ stage: { updateMany, create } }),
    };
    const repository = { delegate: {}, create: jest.fn() };
    const useCase = new StageUseCase(repository as never, prisma as never);

    await useCase.createStage({
      tenantId: 'tenant-1',
      name: 'New',
      entityType: 'lead',
      isDefaultStage: true,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', entityType: 'lead', isDefaultStage: true },
      data: { isDefaultStage: false, defaultGuard: null },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ defaultGuard: 'lead', terminalGuard: null }),
    });
  });

  it('moves the closing status guard inside the same transaction', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockImplementation(async ({ data }) => data);
    const prisma = {
      status: { updateMany, create },
      $transaction: async (callback: (tx: unknown) => unknown) => callback({ status: { updateMany, create } }),
    };
    const repository = { delegate: {}, create: jest.fn() };
    const useCase = new StatusUseCase(repository as never, prisma as never);

    await useCase.createStatus({
      tenantId: 'tenant-1',
      name: 'Won',
      type: 'deal',
      isClosingStatus: true,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', type: 'deal', isClosingStatus: true },
      data: { isClosingStatus: false, closingGuard: null },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ defaultGuard: null, closingGuard: 'deal' }),
    });
  });

  it('does not delete a status that is still used by Leads', async () => {
    const repository = {
      delegate: {},
      findOne: jest.fn().mockResolvedValue({ id: 'status-1', isSystemStatus: false, isDefaultStatus: false, isClosingStatus: false }),
      delete: jest.fn(),
    };
    const prisma = {
      lead: { count: jest.fn().mockResolvedValue(2) },
      deal: { count: jest.fn().mockResolvedValue(0) },
      viewing: { count: jest.fn().mockResolvedValue(0) },
    };
    const useCase = new StatusUseCase(repository as never, prisma as never);

    await expect(useCase.deleteStatus('status-1', 'tenant-1')).rejects.toThrow(/still used by 2 Leads/);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
