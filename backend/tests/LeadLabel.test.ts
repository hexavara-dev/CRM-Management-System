import { jest } from '@jest/globals';
import { Prisma } from '@prisma/client';
import { LeadLabelUseCase } from '../src/usecases/crm/LeadLabelUseCase.js';
import {
  parseLeadLabelType,
  validateLeadLabelCreate,
  validateLeadLabelUpdate,
} from '../src/presentation/validation/crm/leadLabel.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

const hot = { id: 'l-1', tenantId: 't-1', type: 'TEMPERATURE', name: 'Hot', sortOrder: 0 };

function prisma(over: { found?: unknown; last?: unknown; createError?: unknown } = {}) {
  return {
    leadLabel: {
      findMany: fn([hot]),
      count: fn(1),
      groupBy: fn([{ type: 'TEMPERATURE', _count: { _all: 3 } }, { type: 'TAG', _count: { _all: 6 } }]),
      findFirst: jest
        .fn<(...args: any[]) => any>()
        .mockImplementation(async (args: { select?: unknown }) =>
          args.select ? (over.last ?? null) : 'found' in over ? over.found : hot
        ),
      create: over.createError
        ? jest.fn<(...args: any[]) => any>().mockRejectedValue(over.createError)
        : jest.fn(async ({ data }: { data: unknown }) => data),
      update: jest.fn(async ({ data }: { data: unknown }) => data),
      delete: fn({}),
    },
  };
}

const uniqueError = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

describe('LeadLabelUseCase', () => {
  it('lists labels of the tenant with counts per type', async () => {
    const db = prisma();
    const result = await new LeadLabelUseCase(db as never).list('t-1', { type: 'TEMPERATURE', page: 1, limit: 10 });
    expect(result.counts).toEqual({ TEMPERATURE: 3, TAG: 6 });
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    expect(db.leadLabel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', type: 'TEMPERATURE' }, skip: 0, take: 10 })
    );
    expect(db.leadLabel.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't-1' } }));
  });

  it('creates a label for the tenant at the end of its type', async () => {
    const db = prisma({ last: { sortOrder: 2 } });
    const label = (await new LeadLabelUseCase(db as never).create('t-1', {
      type: 'TEMPERATURE',
      name: 'Hot',
      color: '#ef4444',
      icon: 'flame',
      isRequired: true,
    })) as any;
    expect(label).toMatchObject({ tenantId: 't-1', color: '#EF4444', isRequired: true, isActive: true, sortOrder: 3 });
  });

  it('rejects required flags on tags and duplicate names', async () => {
    const tag = { type: 'TAG' as const, name: 'KPR', color: '#000000', icon: 'tag', isRequired: true };
    await expect(new LeadLabelUseCase(prisma() as never).create('t-1', tag)).rejects.toThrow(/only supported/);
    await expect(
      new LeadLabelUseCase(prisma({ createError: uniqueError() }) as never).create('t-1', { ...tag, isRequired: false })
    ).rejects.toThrow(/already exists/);
  });

  it('scopes update and delete to the tenant', async () => {
    const db = prisma({ found: null });
    await expect(new LeadLabelUseCase(db as never).update('l-x', 't-1', { name: 'X' })).rejects.toThrow(
      'Lead label not found'
    );
    await expect(new LeadLabelUseCase(db as never).remove('l-x', 't-1')).rejects.toThrow('Lead label not found');
    expect(db.leadLabel.findFirst).toHaveBeenCalledWith({ where: { id: 'l-x', tenantId: 't-1' } });
    expect(db.leadLabel.delete).not.toHaveBeenCalled();
  });

  it('updates and deletes a label of the tenant', async () => {
    const db = prisma();
    await new LeadLabelUseCase(db as never).update('l-1', 't-1', { isRequired: false, color: '#3b82f6' });
    expect(db.leadLabel.update).toHaveBeenCalledWith({ where: { id: 'l-1' }, data: { isRequired: false, color: '#3B82F6' } });
    await new LeadLabelUseCase(db as never).remove('l-1', 't-1');
    expect(db.leadLabel.delete).toHaveBeenCalledWith({ where: { id: 'l-1' } });
  });
});

describe('lead label validation', () => {
  const base = { type: 'TAG', name: ' Perlu Evaluasi ', color: '#3B82F6', icon: 'clock' };

  it('accepts a valid label and trims text', () => {
    expect(validateLeadLabelCreate({ ...base, description: '  ' })).toEqual({
      ...base,
      name: 'Perlu Evaluasi',
      description: null,
    });
  });

  it('rejects invalid color, icon, type, and unknown fields', () => {
    expect(() => validateLeadLabelCreate({ ...base, color: 'red' })).toThrow(/hex color/);
    expect(() => validateLeadLabelCreate({ ...base, icon: 'rocket' })).toThrow(/icon must be one of/);
    expect(() => validateLeadLabelCreate({ ...base, type: 'STAGE' })).toThrow(/type must be one of/);
    expect(() => validateLeadLabelCreate({ ...base, tenantId: 't-2' })).toThrow(/Unsupported field/);
    expect(() => validateLeadLabelCreate({ ...base, name: '   ' })).toThrow(/name cannot be empty/);
  });

  it('does not allow changing the type on update', () => {
    expect(() => validateLeadLabelUpdate({ type: 'TEMPERATURE' })).toThrow(/Unsupported field/);
    expect(validateLeadLabelUpdate({ isActive: false })).toEqual({ isActive: false });
  });

  it('parses the type filter', () => {
    expect(parseLeadLabelType({ type: 'tag' })).toBe('TAG');
    expect(parseLeadLabelType({})).toBeUndefined();
    expect(() => parseLeadLabelType({ type: 'x' })).toThrow(/type must be one of/);
  });
});
