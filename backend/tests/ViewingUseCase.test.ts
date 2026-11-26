import { jest } from '@jest/globals';
import { ViewingUseCase } from '../src/usecases/viewing/ViewingUseCase.js';

describe('ViewingUseCase durationMinutes', () => {
  const build = () => {
    const viewingRepository = { create: jest.fn().mockResolvedValue({ id: 'v1' }), update: jest.fn() };
    const statusRepository = { findOne: jest.fn().mockResolvedValue(null) };
    const useCase = new ViewingUseCase(
      viewingRepository as never,
      statusRepository as never,
      {} as never,
      {} as never
    );
    return { viewingRepository, useCase };
  };

  it('persists durationMinutes on create when provided', async () => {
    const { viewingRepository, useCase } = build();
    await useCase.createViewing({ tenantId: 't1', scheduledAt: new Date(), durationMinutes: 45 });
    expect(viewingRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 45 })
    );
  });

  it('leaves durationMinutes to the database default when omitted', async () => {
    const { viewingRepository, useCase } = build();
    await useCase.createViewing({ tenantId: 't1', scheduledAt: new Date() });
    expect(viewingRepository.create.mock.calls[0]![0]).not.toHaveProperty('durationMinutes');
  });
});

describe('ViewingUseCase getAllViewings', () => {
  const build = () => {
    const viewingRepository = {
      findAll: jest.fn().mockResolvedValue([{ id: 'v1' }]),
      count: jest.fn().mockResolvedValue(25),
    };
    const useCase = new ViewingUseCase(viewingRepository as never, {} as never, {} as never, {} as never);
    return { viewingRepository, useCase };
  };

  it('builds a tenant-scoped, role-scoped, sorted query with paging meta', async () => {
    const { viewingRepository, useCase } = build();

    const result = await useCase.getAllViewings(
      't1',
      2,
      10,
      { projectId: 'p1', sortBy: 'phone', sortOrder: 'asc' },
      { userId: 'u1', role: 'member' }
    );

    const args = viewingRepository.findAll.mock.calls[0]![0] as Record<string, any>;
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(args.where.tenantId).toBe('t1');
    expect(args.where.AND).toEqual(
      expect.arrayContaining([{ unit: { variant: { productId: 'p1' } } }, { actorId: 'u1' }])
    );
    expect(args.orderBy[0]).toEqual({ customer: { phoneNumber: 'asc' } });
    expect(args.include.actor).toEqual({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    expect(args.include.unit).toEqual({
      select: {
        id: true,
        code: true,
        name: true,
        variant: { select: { product: { select: { id: true, name: true, code: true } } } },
      },
    });
    expect(viewingRepository.count).toHaveBeenCalledWith(args.where);
    expect(result.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
  });

  it('rejects a non-whitelisted sort field before touching the repository', async () => {
    const { viewingRepository, useCase } = build();
    await expect(useCase.getAllViewings('t1', 1, 10, { sortBy: 'password' })).rejects.toThrow(
      /sortBy must be one of/
    );
    expect(viewingRepository.findAll).not.toHaveBeenCalled();
  });
});

describe('ViewingUseCase tenant isolation', () => {
  it('does not fail a viewing that is outside the authenticated tenant', async () => {
    const viewingRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    };
    const statusRepository = { findOne: jest.fn() };
    const useCase = new ViewingUseCase(
      viewingRepository as never,
      statusRepository as never,
      {} as never,
      {} as never
    );

    await expect(useCase.failViewing('viewing-1', 'tenant-1', 'No show')).rejects.toThrow(
      'Viewing not found'
    );

    expect(viewingRepository.findOne).toHaveBeenCalledWith(
      { id: 'viewing-1', tenantId: 'tenant-1' },
      expect.any(Object)
    );
    expect(statusRepository.findOne).not.toHaveBeenCalled();
    expect(viewingRepository.update).not.toHaveBeenCalled();
  });
});
