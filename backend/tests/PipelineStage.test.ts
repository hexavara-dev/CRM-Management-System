import { jest } from '@jest/globals';
import { PipelineStageUseCase } from '../src/usecases/crm/PipelineStageUseCase.js';
import {
  parsePipelineEntity,
  validatePipelineReorder,
  validatePipelineStageCreate,
  validatePipelineStageUpdate,
} from '../src/presentation/validation/crm/pipelineStage.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

const row = (over: Record<string, unknown> = {}) => ({
  id: 's-1',
  tenantId: 't-1',
  name: 'Follow Up',
  entityType: 'lead',
  position: 0,
  color: '#F59E0B',
  description: null,
  probability: 60,
  isActive: true,
  isDefaultStage: false,
  isTerminalStage: false,
  isWonStage: false,
  defaultGuard: null,
  terminalGuard: null,
  evidences: [{ id: 'e-1', tenantId: 't-1', stageId: 's-1', name: 'Foto', fileTypes: ['IMAGE'], isRequired: true, description: null, sortOrder: 0 }],
  _count: { leads: 0, deals: 0 },
  ...over,
});

function prisma(over: { stage?: unknown; duplicate?: unknown; all?: unknown[]; ordered?: unknown[] } = {}) {
  const tx = {
    stage: {
      create: fn({ id: 's-new' }),
      update: fn({}),
      updateMany: fn({ count: 1 }),
      findMany: fn(over.ordered ?? over.all ?? [row()]),
    },
    stageEvidenceRequirement: { createMany: fn({}), deleteMany: fn({}) },
  };
  const db = {
    tx,
    stage: {
      findMany: fn(over.all ?? [row()]),
      // Cek nama duplikat memakai `where.name`; cek urutan terakhir memakai `select.position`.
      findFirst: jest.fn<(...args: any[]) => any>().mockImplementation(
        async (args: { where: { name?: string }; select?: { position?: boolean } }) => {
          if (args.where.name !== undefined) return over.duplicate ?? null;
          if (args.select?.position) return { position: 4 };
          return 'stage' in over ? over.stage : row();
        }
      ),
      update: fn({}),
      delete: fn({}),
    },
    $transaction: jest.fn(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (t: unknown) => unknown)(tx) : Promise.all(arg as unknown[])
    ),
  };
  return db;
}

const evidence = { name: 'Foto Kunjungan', fileTypes: ['IMAGE' as const], isRequired: true };

describe('PipelineStageUseCase', () => {
  it('lists stages of the tenant and entity without internal fields', async () => {
    const db = prisma({ all: [row({ _count: { leads: 3, deals: 9 } })] });
    const [stage] = await new PipelineStageUseCase(db as never).list('t-1', 'lead');
    expect(db.stage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't-1', entityType: 'lead' } }));
    expect(stage).toMatchObject({ id: 's-1', itemCount: 3, evidences: [{ id: 'e-1', name: 'Foto' }] });
    expect(stage).not.toHaveProperty('tenantId');
    expect(stage!.evidences[0]).not.toHaveProperty('tenantId');
  });

  it('creates a stage at the end with its evidences in one transaction', async () => {
    const db = prisma();
    await new PipelineStageUseCase(db as never).create('t-1', 'lead', {
      name: 'Follow Up',
      probability: 60,
      color: '#f59e0b',
      evidences: [evidence],
    });
    expect(db.tx.stage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 't-1', entityType: 'lead', position: 5, color: '#F59E0B', probability: 60 }),
    });
    expect(db.tx.stageEvidenceRequirement.createMany).toHaveBeenCalledWith({
      data: [{ tenantId: 't-1', stageId: 's-new', name: 'Foto Kunjungan', fileTypes: ['IMAGE'], isRequired: true, description: null, sortOrder: 0 }],
    });
  });

  it('rejects duplicate names', async () => {
    const db = prisma({ duplicate: { id: 's-2' } });
    await expect(
      new PipelineStageUseCase(db as never).create('t-1', 'lead', { name: 'follow up', probability: 0, color: '#000000' })
    ).rejects.toThrow(/already exists/);
  });

  it('replaces evidences on update', async () => {
    const db = prisma();
    await new PipelineStageUseCase(db as never).update('s-1', 't-1', { probability: 70, evidences: [] });
    expect(db.tx.stage.update).toHaveBeenCalledWith({ where: { id: 's-1' }, data: { probability: 70 } });
    expect(db.tx.stageEvidenceRequirement.deleteMany).toHaveBeenCalledWith({ where: { tenantId: 't-1', stageId: 's-1' } });
    expect(db.tx.stageEvidenceRequirement.createMany).not.toHaveBeenCalled();
  });

  it('protects default and final stages', async () => {
    const db = prisma({ stage: row({ isDefaultStage: true }) });
    await expect(new PipelineStageUseCase(db as never).update('s-1', 't-1', { isActive: false })).rejects.toThrow(
      /cannot be deactivated/
    );
    await expect(new PipelineStageUseCase(db as never).remove('s-1', 't-1')).rejects.toThrow(/cannot be deleted/);
    expect(db.stage.delete).not.toHaveBeenCalled();
  });

  it('moves the default flag from the previous default stage and activates the stage', async () => {
    const db = prisma({ stage: row({ isActive: false }) });
    await new PipelineStageUseCase(db as never).update('s-1', 't-1', { isDefaultStage: true });
    expect(db.tx.stage.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't-1', entityType: 'lead', id: { not: 's-1' }, isDefaultStage: true },
      data: { isDefaultStage: false, defaultGuard: null },
    });
    expect(db.tx.stage.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: expect.objectContaining({ isDefaultStage: true, defaultGuard: 'lead', isActive: true }),
    });
  });

  it('sets the final flag when creating a stage', async () => {
    const db = prisma();
    await new PipelineStageUseCase(db as never).create('t-1', 'lead', {
      name: 'Closed',
      probability: 100,
      color: '#000000',
      isTerminalStage: true,
    });
    expect(db.tx.stage.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't-1', entityType: 'lead', isTerminalStage: true },
      data: { isTerminalStage: false, terminalGuard: null },
    });
    expect(db.tx.stage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isTerminalStage: true, terminalGuard: 'lead' }),
    });
  });

  it('rejects unsetting a flag directly and combining both flags', async () => {
    const db = prisma({ stage: row({ isTerminalStage: true }) });
    await expect(new PipelineStageUseCase(db as never).update('s-1', 't-1', { isTerminalStage: false })).rejects.toThrow(
      /Choose another final stage/
    );
    await expect(new PipelineStageUseCase(db as never).update('s-1', 't-1', { isDefaultStage: true })).rejects.toThrow(
      /both the default and the final/
    );
    expect(db.tx.stage.update).not.toHaveBeenCalled();
  });

  it('rejects deleting a stage that still has leads, and scopes to the tenant', async () => {
    await expect(
      new PipelineStageUseCase(prisma({ stage: row({ _count: { leads: 2, deals: 0 } }) }) as never).remove('s-1', 't-1')
    ).rejects.toThrow(/still has 2 items/);

    const db = prisma({ stage: null });
    await expect(new PipelineStageUseCase(db as never).remove('s-x', 't-1')).rejects.toThrow('Pipeline stage not found');
    expect(db.stage.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's-x', tenantId: 't-1' } }));
  });

  it('reorders only with the complete set of stages of the tenant', async () => {
    const db = prisma({ all: [row({ id: 'a', position: 0 }), row({ id: 'b', position: 1 })] });
    await expect(new PipelineStageUseCase(db as never).reorder('t-1', 'lead', ['a'])).rejects.toThrow(/every stage/);
    await expect(new PipelineStageUseCase(db as never).reorder('t-1', 'lead', ['a', 'x'])).rejects.toThrow(/every stage/);
    await new PipelineStageUseCase(db as never).reorder('t-1', 'lead', ['b', 'a']);
    expect(db.tx.stage.update).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: expect.objectContaining({ position: 0, isDefaultStage: true, defaultGuard: 'lead' }),
    });
    expect(db.tx.stage.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: expect.objectContaining({ position: 1, isTerminalStage: true, terminalGuard: 'lead' }),
    });
  });
});

describe('PipelineStageUseCase for deals', () => {
  const deal = (over: Record<string, unknown> = {}) => row({ entityType: 'deal', ...over });

  it('lists deal stages with the number of deals', async () => {
    const db = prisma({ all: [deal({ _count: { leads: 7, deals: 2 } })] });
    const [stage] = await new PipelineStageUseCase(db as never).list('t-1', 'deal');
    expect(db.stage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', entityType: 'deal' } })
    );
    expect(stage).toMatchObject({ entityType: 'deal', itemCount: 2 });
  });

  it('creates a deal stage and checks duplicate names within deal stages', async () => {
    const db = prisma();
    await new PipelineStageUseCase(db as never).create('t-1', 'deal', { name: 'ITJ', probability: 25, color: '#3b82f6' });
    expect(db.stage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', entityType: 'deal', name: 'ITJ' } })
    );
    expect(db.tx.stage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 't-1', entityType: 'deal', name: 'ITJ', probability: 25 }),
    });
  });

  it('rejects deleting a deal stage that still has deals, regardless of leads', async () => {
    const db = prisma({ stage: deal({ _count: { leads: 0, deals: 3 } }) });
    await expect(new PipelineStageUseCase(db as never).remove('s-1', 't-1')).rejects.toThrow(/still has 3 items/);
    expect(db.stage.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty deal stage even if the lead count is not zero', async () => {
    const db = prisma({ stage: deal({ _count: { leads: 5, deals: 0 } }) });
    await new PipelineStageUseCase(db as never).remove('s-1', 't-1');
    expect(db.stage.delete).toHaveBeenCalledWith({ where: { id: 's-1' } });
  });

  it('moves the final flag only among deal stages', async () => {
    const db = prisma({ stage: deal() });
    await new PipelineStageUseCase(db as never).update('s-1', 't-1', { isTerminalStage: true });
    expect(db.tx.stage.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't-1', entityType: 'deal', id: { not: 's-1' }, isTerminalStage: true },
      data: { isTerminalStage: false, terminalGuard: null },
    });
    expect(db.tx.stage.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: expect.objectContaining({ isTerminalStage: true, terminalGuard: 'deal' }),
    });
  });

  it('marks one deal stage as won and moves the flag from the previous won stage', async () => {
    const db = prisma({ stage: deal({ isTerminalStage: true }) });
    const stage = await new PipelineStageUseCase(db as never).update('s-1', 't-1', { isWonStage: true });
    expect(db.tx.stage.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't-1', isWonStage: true, id: { not: 's-1' } },
      data: { isWonStage: false, wonGuard: null },
    });
    expect(db.tx.stage.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: expect.objectContaining({ isWonStage: true, wonGuard: 'deal', isTerminalStage: true, isActive: true }),
    });
    expect(stage).toHaveProperty('isWonStage');
  });

  it('allows unsetting the won stage', async () => {
    const db = prisma({ stage: deal({ isWonStage: true }) });
    await new PipelineStageUseCase(db as never).update('s-1', 't-1', { isWonStage: false });
    expect(db.tx.stage.updateMany).not.toHaveBeenCalled();
    expect(db.tx.stage.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: expect.objectContaining({ isWonStage: false, wonGuard: null }),
    });
  });

  it('rejects won on lead stages, on the default stage, and deactivating the won stage', async () => {
    await expect(
      new PipelineStageUseCase(prisma() as never).update('s-1', 't-1', { isWonStage: true })
    ).rejects.toThrow(/only deal stages/);
    await expect(
      new PipelineStageUseCase(prisma({ stage: deal({ isDefaultStage: true }) }) as never).update('s-1', 't-1', {
        isWonStage: true,
      })
    ).rejects.toThrow(/default stage cannot be counted/);
    await expect(
      new PipelineStageUseCase(prisma({ stage: deal({ isWonStage: true }) }) as never).update('s-1', 't-1', {
        isActive: false,
      })
    ).rejects.toThrow(/cannot be deactivated/);
  });

  it('creates a deal stage marked as won', async () => {
    const db = prisma();
    await new PipelineStageUseCase(db as never).create('t-1', 'deal', {
      name: 'Akad',
      probability: 100,
      color: '#16a34a',
      isWonStage: true,
    });
    expect(db.tx.stage.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't-1', isWonStage: true },
      data: { isWonStage: false, wonGuard: null },
    });
    expect(db.tx.stage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isWonStage: true, wonGuard: 'deal' }),
    });
  });

  it('reorders deal stages only', async () => {
    const db = prisma({ all: [deal({ id: 'itj', position: 0 }), deal({ id: 'dp', position: 1 })] });
    await new PipelineStageUseCase(db as never).reorder('t-1', 'deal', ['dp', 'itj']);
    expect(db.stage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', entityType: 'deal' } })
    );
    expect(db.tx.stage.update).toHaveBeenCalledWith({
      where: { id: 'dp' },
      data: expect.objectContaining({ position: 0, isDefaultStage: true, defaultGuard: 'deal' }),
    });
  });
});

describe('default and final stages stay pinned', () => {
  const stages = () => [
    row({ id: 'new', position: 0, isDefaultStage: true }),
    row({ id: 'fu', position: 1 }),
    row({ id: 'won', position: 2, isTerminalStage: true }),
    row({ id: 'nego', position: 3 }),
  ];

  it('moves the default and final flags to the first and last stages of the new order', async () => {
    const db = prisma({ all: stages() });
    await new PipelineStageUseCase(db as never).reorder('t-1', 'lead', ['fu', 'new', 'nego', 'won']);
    expect(db.tx.stage.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't-1', entityType: 'lead' },
      data: { isDefaultStage: false, defaultGuard: null, isTerminalStage: false, terminalGuard: null },
    });
    const calls = Object.fromEntries(db.tx.stage.update.mock.calls.map(([arg]) => [arg.where.id, arg.data]));
    expect(calls.fu).toMatchObject({ position: 0, isDefaultStage: true, isTerminalStage: false, isActive: true });
    expect(calls.new).toMatchObject({ position: 1, isDefaultStage: false, isTerminalStage: false });
    expect(calls.won).toMatchObject({ position: 3, isDefaultStage: false, isTerminalStage: true, isActive: true });
  });

  it('rejects an order that puts the won stage first', async () => {
    const db = prisma({ all: [...stages(), row({ id: 'w', isWonStage: true })] });
    await expect(
      new PipelineStageUseCase(db as never).reorder('t-1', 'lead', ['w', 'new', 'fu', 'won', 'nego'])
    ).rejects.toThrow(/won stage cannot be the first/);
    expect(db.tx.stage.updateMany).not.toHaveBeenCalled();
  });

  it('inserts a new stage before the final stage', async () => {
    const db = prisma({ ordered: [...stages().slice(0, 3), row({ id: 's-new', position: 5 })] });
    await new PipelineStageUseCase(db as never).create('t-1', 'lead', { name: 'Visit', probability: 40, color: '#22c55e' });
    expect(db.tx.stage.update).toHaveBeenCalledWith({ where: { id: 's-new' }, data: { position: 2 } });
    expect(db.tx.stage.update).toHaveBeenCalledWith({ where: { id: 'won' }, data: { position: 3 } });
  });

  it('moves a stage to the end when it becomes the final stage', async () => {
    const db = prisma({
      stage: row({ id: 'fu', position: 1 }),
      ordered: [
        row({ id: 'new', position: 0, isDefaultStage: true }),
        row({ id: 'fu', position: 1, isTerminalStage: true }),
        row({ id: 'nego', position: 2 }),
      ],
    });
    await new PipelineStageUseCase(db as never).update('fu', 't-1', { isTerminalStage: true });
    expect(db.tx.stage.update).toHaveBeenCalledWith({ where: { id: 'nego' }, data: { position: 1 } });
    expect(db.tx.stage.update).toHaveBeenCalledWith({ where: { id: 'fu' }, data: { position: 2 } });
  });

  it('does not touch positions when only other fields change', async () => {
    const db = prisma({ stage: row({ id: 'fu' }) });
    await new PipelineStageUseCase(db as never).update('fu', 't-1', { name: 'Follow Up 2' });
    expect(db.tx.stage.findMany).not.toHaveBeenCalled();
  });

  it('lists default first and final last even if stored positions are out of order', async () => {
    const db = prisma({ all: [row({ id: 'won', isTerminalStage: true }), row({ id: 'fu' }), row({ id: 'new', isDefaultStage: true })] });
    const list = await new PipelineStageUseCase(db as never).list('t-1', 'lead');
    expect(list.map((s) => s.id)).toEqual(['new', 'fu', 'won']);
  });
});

describe('pipeline stage validation', () => {
  const base = { entity: 'lead', name: ' Follow Up ', probability: 60, color: '#F59E0B' };

  it('accepts a stage with evidences and defaults isRequired to true', () => {
    expect(
      validatePipelineStageCreate({ ...base, evidences: [{ name: ' Foto ', fileTypes: ['IMAGE', 'IMAGE', 'PDF'] }] })
    ).toEqual({
      entity: 'lead',
      name: 'Follow Up',
      probability: 60,
      color: '#F59E0B',
      evidences: [{ name: 'Foto', fileTypes: ['IMAGE', 'PDF'], isRequired: true, description: null, paymentMethods: null }],
    });
  });

  it('rejects invalid probability, color, entity, and unknown fields', () => {
    expect(() => validatePipelineStageCreate({ ...base, probability: 120 })).toThrow();
    expect(() => validatePipelineStageCreate({ ...base, probability: 1.5 })).toThrow();
    expect(() => validatePipelineStageCreate({ ...base, color: 'orange' })).toThrow(/hex color/);
    expect(() => validatePipelineStageCreate({ ...base, entity: 'task' })).toThrow(/entity must be one of/);
    expect(() => validatePipelineStageUpdate({ position: 2 })).toThrow(/Unsupported field/);
  });

  it('normalizes the payment methods of deal documents', () => {
    const methods = (paymentMethods: unknown) =>
      validatePipelineStageUpdate({ evidences: [{ name: 'A', fileTypes: ['PDF'], paymentMethods }] }).evidences![0]!.paymentMethods;
    expect(methods(['KPR_SHARIA', 'KPR', 'KPR'])).toEqual(['KPR', 'KPR_SHARIA']);
    expect(methods(['CASH', 'KPR', 'KPR_SHARIA'])).toBeNull();
    expect(methods([])).toBeNull();
    expect(methods(null)).toBeNull();
    expect(() => methods(['CARD'])).toThrow(/paymentMethods/);
  });

  it('validates evidences', () => {
    expect(() => validatePipelineStageUpdate({ evidences: [{ name: 'A', fileTypes: [] }] })).toThrow(/fileTypes/);
    expect(() => validatePipelineStageUpdate({ evidences: [{ name: 'A', fileTypes: ['EXE'] }] })).toThrow(/fileTypes/);
    expect(() =>
      validatePipelineStageUpdate({ evidences: [{ name: 'Foto', fileTypes: ['PDF'] }, { name: 'foto', fileTypes: ['PDF'] }] })
    ).toThrow(/unique/);
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `E${i}`, fileTypes: ['PDF'] }));
    expect(() => validatePipelineStageUpdate({ evidences: many })).toThrow(/at most 20/);
  });

  it('validates reorder payloads and entity', () => {
    expect(validatePipelineReorder({ entity: 'lead', ids: ['a', 'b'] })).toEqual({ entity: 'lead', ids: ['a', 'b'] });
    expect(() => validatePipelineReorder({ entity: 'lead', ids: [] })).toThrow(/non-empty/);
    expect(() => validatePipelineReorder({ entity: 'lead', ids: ['a', 'a'] })).toThrow(/duplicates/);
    expect(parsePipelineEntity('deal')).toBe('deal');
  });
});
