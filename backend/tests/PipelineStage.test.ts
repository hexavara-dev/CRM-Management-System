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
  defaultGuard: null,
  terminalGuard: null,
  evidences: [{ id: 'e-1', tenantId: 't-1', stageId: 's-1', name: 'Foto', fileTypes: ['IMAGE'], isRequired: true, sortOrder: 0 }],
  _count: { leads: 0, deals: 0 },
  ...over,
});

function prisma(over: { stage?: unknown; duplicate?: unknown; all?: unknown[] } = {}) {
  const tx = {
    stage: { create: fn({ id: 's-new' }), update: fn({}), updateMany: fn({ count: 1 }) },
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
      data: [{ tenantId: 't-1', stageId: 's-new', name: 'Foto Kunjungan', fileTypes: ['IMAGE'], isRequired: true, sortOrder: 0 }],
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
    const db = prisma({ all: [row({ id: 'a' }), row({ id: 'b' })] });
    await expect(new PipelineStageUseCase(db as never).reorder('t-1', 'lead', ['a'])).rejects.toThrow(/every stage/);
    await expect(new PipelineStageUseCase(db as never).reorder('t-1', 'lead', ['a', 'x'])).rejects.toThrow(/every stage/);
    await new PipelineStageUseCase(db as never).reorder('t-1', 'lead', ['b', 'a']);
    expect(db.stage.update).toHaveBeenCalledWith({ where: { id: 'b' }, data: { position: 0 } });
    expect(db.stage.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { position: 1 } });
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
      evidences: [{ name: 'Foto', fileTypes: ['IMAGE', 'PDF'], isRequired: true }],
    });
  });

  it('rejects invalid probability, color, entity, and unknown fields', () => {
    expect(() => validatePipelineStageCreate({ ...base, probability: 120 })).toThrow();
    expect(() => validatePipelineStageCreate({ ...base, probability: 1.5 })).toThrow();
    expect(() => validatePipelineStageCreate({ ...base, color: 'orange' })).toThrow(/hex color/);
    expect(() => validatePipelineStageCreate({ ...base, entity: 'task' })).toThrow(/entity must be one of/);
    expect(() => validatePipelineStageUpdate({ position: 2 })).toThrow(/Unsupported field/);
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
