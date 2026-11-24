import { jest } from '@jest/globals';
import { DealDetailUseCase } from '../src/usecases/deal/DealDetailUseCase.js';

function database(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    deal: {
      findFirst: jest.fn().mockResolvedValue({ id: 'deal-1', statusId: 'open', status: null }),
      update: jest.fn().mockResolvedValue({ id: 'deal-1' }),
    },
    dealPayment: {
      create: jest.fn().mockResolvedValue({ id: 'payment-1', type: 'ITJ', amount: 10n, status: 'PAID' }),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    dealLostRequest: {
      create: jest.fn().mockResolvedValue({
        id: 'request-1', reason: 'Harga', status: 'PENDING', requestedBy: {}, reviewedBy: null,
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'request-1', dealId: 'deal-1', tenantId: 'tenant-1', status: 'PENDING',
        requestedById: 'sales-1', reason: 'Harga', chronology: 'Customer batal',
      }),
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'request-1', status: 'APPROVED' }),
    },
    dealActivity: { create: jest.fn().mockResolvedValue({ id: 'activity-1' }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }), findMany: jest.fn() },
    status: { findFirst: jest.fn().mockResolvedValue({ id: 'lost-status' }) },
  };
  Object.assign(db, overrides);
  db.$transaction = jest.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db));
  return db;
}

describe('DealDetailUseCase Lost workflow', () => {
  it('creates the request, activity, and audit in one transaction', async () => {
    const db = database();
    const useCase = new DealDetailUseCase(db as never);

    const result = await useCase.requestLost(
      'deal-1',
      { tenantId: 'tenant-1', userId: 'sales-1' },
      ' Harga ',
      ' Customer batal '
    );

    expect(result.id).toBe('request-1');
    expect(db.dealLostRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reason: 'Harga', chronology: 'Customer batal' }) })
    );
    expect(db.dealActivity.create).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'lost_requested' }) })
    );
  });

  it('prevents the requester from reviewing their own request', async () => {
    const db = database();
    const useCase = new DealDetailUseCase(db as never);

    await expect(
      useCase.reviewLost(
        'deal-1',
        'request-1',
        { tenantId: 'tenant-1', userId: 'sales-1' },
        'APPROVED'
      )
    ).rejects.toThrow('cannot be reviewed by its requester');
    expect(db.dealLostRequest.updateMany).not.toHaveBeenCalled();
  });

  it('marks the Deal Lost only after approval by another user', async () => {
    const db = database();
    const useCase = new DealDetailUseCase(db as never);

    await useCase.reviewLost(
      'deal-1',
      'request-1',
      { tenantId: 'tenant-1', userId: 'manager-1' },
      'APPROVED'
    );

    expect(db.deal.update).toHaveBeenCalledWith({
      where: { id: 'deal-1' },
      data: expect.objectContaining({
        statusId: 'lost-status',
        lostReason: 'Harga',
        lostNotes: 'Customer batal',
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'lost_approved' }) })
    );
  });
});

describe('DealDetailUseCase payments', () => {
  it('records payment and history atomically', async () => {
    const db = database();
    const useCase = new DealDetailUseCase(db as never);

    await useCase.createPayment(
      'deal-1',
      { tenantId: 'tenant-1', userId: 'sales-1' },
      { type: 'ITJ', amount: 10, status: 'PAID' }
    );

    expect(db.dealPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 10n, status: 'PAID' }) })
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'payment_added' }) })
    );
  });
});
