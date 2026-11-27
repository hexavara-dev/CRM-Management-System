import { jest } from '@jest/globals';
import { LeadStageTransitionUseCase } from '../src/usecases/lead/LeadStageTransitionUseCase.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);
const actor = { tenantId: 't-1', userId: 'u-1', role: 'owner' };
const input = { targetStageId: 's-2', expectedSourceStageId: 's-1', documents: [] };

// Fase aktif tenant: s-0 (0) < s-1 (1) < s-2 (2) < s-3 (3).
const stageTable = [0, 1, 2, 3].map((position) => ({ id: `s-${position}`, position }));
const countStages = () => jest.fn(async ({ where }: any) => stageTable.filter((stage) =>
  where.id.in.includes(stage.id) && stage.position >= where.position.gte
).length);

function setup(over: { target?: unknown; existing?: unknown[]; grandfathered?: string[] } = {}) {
  const target = 'target' in over ? over.target : { id: 's-2', position: 2, evidences: [] };
  const tx = {
    lead: { findFirst: fn({ id: 'l-1', customerId: 'c-1', stageId: 's-1', evidenceGrandfatheredStageIds: over.grandfathered ?? [], stage: { id: 's-1', name: 'New', position: 1 } }), update: fn({ id: 'l-1', stageId: 's-2' }) },
    stage: { findFirst: fn({ ...(target as object), name: 'Qualified' }), count: countStages() },
    attachment: { findMany: fn(over.existing ?? []), createMany: fn({ count: 0 }) },
    leadActivity: { create: fn({}) },
    auditLog: { create: fn({}) },
  };
  const prisma = {
    lead: { findFirst: fn({ stageId: 's-1', evidenceGrandfatheredStageIds: over.grandfathered ?? [], stage: { id: 's-1', position: 1 } }) },
    stage: { findFirst: fn(target), count: countStages() },
    attachment: { findMany: fn(over.existing ?? []) },
    $transaction: jest.fn(async (work: (value: typeof tx) => unknown) => work(tx)),
  };
  const storage = { upload: fn(), remove: fn(), getPublicUrl: (path: string) => ({ publicUrl: `http://files/${path}` }) };
  return { prisma, tx, storage, useCase: new LeadStageTransitionUseCase(prisma as never, storage as never) };
}

describe('LeadStageTransitionUseCase', () => {
  it('blocks jumping forward over a Lead stage', async () => {
    const { useCase, storage } = setup({ target: { id: 's-3', position: 3, evidences: [] } });
    await expect(useCase.transition('l-1', actor, { ...input, targetStageId: 's-3' })).rejects.toThrow(/only move forward one/);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('requires configured evidence before a forward transition', async () => {
    const { useCase, storage, prisma } = setup({ target: { id: 's-2', position: 2, evidences: [{ name: 'KTP', fileTypes: ['PDF'], isRequired: true, paymentMethods: null }] } });
    await expect(useCase.transition('l-1', actor, input)).rejects.toThrow(/Required documents are missing: KTP/);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reuses evidence already completed for the destination stage after moving backward', async () => {
    const { useCase, storage, tx } = setup({
      target: { id: 's-2', position: 2, evidences: [{ name: 'KTP', fileTypes: ['PDF'], isRequired: true, paymentMethods: null }] },
      existing: [{ documentName: 'KTP' }],
    });
    await expect(useCase.transition('l-1', actor, input)).resolves.toEqual({ id: 'l-1', stageId: 's-2' });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(tx.attachment.createMany).not.toHaveBeenCalled();
  });

  it('does not apply newly configured evidence retroactively to a reached stage', async () => {
    const { useCase, storage, tx } = setup({
      target: { id: 's-2', position: 2, evidences: [{ name: 'KTP', fileTypes: ['PDF'], isRequired: true, paymentMethods: null }] },
      grandfathered: ['s-2'],
    });
    await expect(useCase.transition('l-1', actor, input)).resolves.toEqual({ id: 'l-1', stageId: 's-2' });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(tx.attachment.createMany).not.toHaveBeenCalled();
  });

  it('lets a grandfathered Lead climb back through lower stages up to its original stage', async () => {
    // Lead pernah di s-3 sebelum evidence diwajibkan, turun ke s-1, lalu naik ke s-2.
    const { useCase, storage, tx } = setup({
      target: { id: 's-2', position: 2, evidences: [{ name: 'KTP', fileTypes: ['PDF'], isRequired: true, paymentMethods: null }] },
      grandfathered: ['s-3', 's-1'],
    });
    await expect(useCase.transition('l-1', actor, input)).resolves.toEqual({ id: 'l-1', stageId: 's-2' });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(tx.attachment.createMany).not.toHaveBeenCalled();
  });

  it('still requires evidence above the highest Lead stage reached before the rule', async () => {
    const { useCase, prisma } = setup({
      target: { id: 's-2', position: 2, evidences: [{ name: 'KTP', fileTypes: ['PDF'], isRequired: true, paymentMethods: null }] },
      grandfathered: ['s-1', 's-0'],
    });
    await expect(useCase.transition('l-1', actor, input)).rejects.toThrow(/Required documents are missing: KTP/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows a backward transition without an evidence dialog or upload', async () => {
    const { useCase, tx, storage } = setup({ target: { id: 's-0', position: 0, evidences: [{ name: 'KTP', fileTypes: ['PDF'], isRequired: true, paymentMethods: null }] } });
    await expect(useCase.transition('l-1', actor, { ...input, targetStageId: 's-0' })).resolves.toEqual({ id: 'l-1', stageId: 's-2' });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(tx.attachment.createMany).not.toHaveBeenCalled();
  });
});
