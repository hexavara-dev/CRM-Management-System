import { jest } from '@jest/globals';
import { DealStageTransitionUseCase } from '../src/usecases/deal/DealStageTransitionUseCase.js';

const pdf = {
  mimetype: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4'),
  originalname: 'bukti.pdf',
  size: 8,
} as Express.Multer.File;
const requirement = { name: 'Bukti Bayar', fileTypes: ['PDF'], isRequired: true, paymentMethods: null };

function setup({ sourcePosition = 0, targetPosition = 1, targetWon = true, existing = [] as string[], grandfathered = [] as string[] } = {}) {
  const source = { id: 'stage-1', name: 'Awal', position: sourcePosition };
  const target = { id: 'stage-2', name: 'Lanjutan', position: targetPosition, isWonStage: targetWon, evidences: [requirement] };
  const before = {
    stageId: source.id,
    statusId: 'open-status',
    unitId: 'unit-1',
    unitClaimed: true,
    amount: 500,
    leadId: 'lead-1',
    stage: { isWonStage: false },
    status: { isClosingStatus: false, isFailedStatus: false },
  };
  const current = {
    stageId: source.id,
    statusId: 'open-status',
    closingDate: null,
    paymentMethod: 'CASH',
    evidenceGrandfatheredStageIds: grandfathered,
    stage: source,
    status: { isClosingStatus: false, isFailedStatus: false },
  };
  const tx = {
    deal: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(current),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({
        ...before,
        ...data,
        stage: { isWonStage: target.isWonStage },
        status: data.statusId ? { isClosingStatus: true, isFailedStatus: false } : before.status,
      })),
    },
    stage: { findFirst: jest.fn().mockResolvedValue(target) },
    status: { findFirst: jest.fn().mockResolvedValue({ id: 'won-status' }) },
    attachment: {
      findMany: jest.fn().mockResolvedValue(existing.map((documentName) => ({ documentName }))),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    productUnit: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    dealActivity: { create: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  // Tabel fase tenant untuk menilai batas grandfathering berdasarkan posisi.
  const stageTable = [
    { id: 'stage-1', position: sourcePosition, isActive: true },
    { id: 'stage-2', position: targetPosition, isActive: true },
    { id: 'stage-3', position: targetPosition + 1, isActive: true },
  ];
  const countStages = jest.fn(async ({ where }: any) => stageTable.filter((stage) =>
    stage.isActive === where.isActive
    && where.id.in.includes(stage.id)
    && stage.position >= where.position.gte
  ).length);
  (tx.stage as any).count = countStages;
  const prisma = {
    deal: { findFirst: jest.fn().mockResolvedValue({ ...current, id: 'deal-1' }) },
    stage: { findFirst: jest.fn().mockResolvedValue(target), count: countStages },
    attachment: { findMany: jest.fn().mockResolvedValue(existing.map((documentName) => ({ documentName }))) },
    $transaction: jest.fn(async (action: any) => action(tx)),
  };
  const storage = {
    upload: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: (path: string) => ({ publicUrl: `http://files/${path}` }),
  };
  return { prisma, tx, storage, useCase: new DealStageTransitionUseCase(prisma as never, storage as never) };
}

describe('DealStageTransitionUseCase', () => {
  it('validates evidence and atomically marks an adjacent Won stage', async () => {
    const { useCase, tx, storage } = setup();
    await useCase.transition(
      'deal-1',
      { tenantId: 'tenant-1', userId: 'user-1' },
      { targetStageId: 'stage-2', expectedSourceStageId: 'stage-1', documents: [{ name: 'Bukti Bayar', fileIndex: 0 }] },
      [pdf]
    );

    expect(tx.deal.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stageId: 'stage-2', statusId: 'won-status', closingDate: expect.any(Date) }),
    }));
    expect(tx.attachment.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ documentName: 'Bukti Bayar', documentStageId: 'stage-2' })],
    });
    expect(tx.productUnit.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'SOLD' } }));
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('rejects skipping a forward stage before storing files', async () => {
    const { useCase, storage, prisma } = setup({ targetPosition: 2 });
    await expect(useCase.transition(
      'deal-1',
      { tenantId: 'tenant-1', userId: 'user-1' },
      { targetStageId: 'stage-2', expectedSourceStageId: 'stage-1', documents: [] },
      []
    )).rejects.toThrow(/one stage/i);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reuses evidence already completed for the destination stage', async () => {
    const { useCase, tx } = setup({ targetWon: false, existing: ['Bukti Bayar'] });
    await expect(useCase.transition(
      'deal-1',
      { tenantId: 'tenant-1', userId: 'user-1' },
      { targetStageId: 'stage-2', expectedSourceStageId: 'stage-1', documents: [] },
      []
    )).resolves.toMatchObject({ stageId: 'stage-2' });
    expect(tx.attachment.createMany).not.toHaveBeenCalled();
    expect(tx.status.findFirst).not.toHaveBeenCalled();
  });

  it('does not apply a newly configured evidence requirement retroactively', async () => {
    const { useCase, tx } = setup({ targetWon: false, grandfathered: ['stage-2'] });
    await expect(useCase.transition(
      'deal-1',
      { tenantId: 'tenant-1', userId: 'user-1' },
      { targetStageId: 'stage-2', expectedSourceStageId: 'stage-1', documents: [] },
      []
    )).resolves.toMatchObject({ stageId: 'stage-2' });
    expect(tx.attachment.createMany).not.toHaveBeenCalled();
  });

  it('lets a grandfathered Deal climb back through lower stages up to its original stage', async () => {
    // Deal pernah di stage-3 sebelum evidence diwajibkan, turun ke stage-1, lalu naik ke stage-2.
    const { useCase, tx } = setup({ targetWon: false, grandfathered: ['stage-3', 'stage-1'] });
    await expect(useCase.transition(
      'deal-1',
      { tenantId: 'tenant-1', userId: 'user-1' },
      { targetStageId: 'stage-2', expectedSourceStageId: 'stage-1', documents: [] },
      []
    )).resolves.toMatchObject({ stageId: 'stage-2' });
    expect(tx.attachment.createMany).not.toHaveBeenCalled();
  });

  it('still requires evidence above the highest stage reached before the rule', async () => {
    // Deal hanya pernah mencapai stage-1; stage-2 di atasnya tetap wajib evidence.
    const { useCase, prisma } = setup({ targetWon: false, grandfathered: ['stage-1'] });
    await expect(useCase.transition(
      'deal-1',
      { tenantId: 'tenant-1', userId: 'user-1' },
      { targetStageId: 'stage-2', expectedSourceStageId: 'stage-1', documents: [] },
      []
    )).rejects.toThrow(/Required documents are missing/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
