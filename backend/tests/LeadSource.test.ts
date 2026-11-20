import { jest } from '@jest/globals';
import { LeadSourceUseCase } from '../src/usecases/crm/LeadSourceUseCase.js';
import {
  parseLeadSourceFilters,
  validateLeadSourceCreate,
  validateLeadSourceUpdate,
} from '../src/presentation/validation/crm/leadSource.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

function prisma(over: { found?: unknown; duplicate?: unknown; used?: number } = {}) {
  return {
    source: {
      findMany: fn([{ id: 's-1', name: 'Website', _count: { campaigns: 2 } }]),
      count: fn(1),
      // Panggilan pertama: cek source ada; panggilan berikutnya: cek nama duplikat.
      findFirst: jest.fn<(...args: any[]) => any>().mockImplementation(async (args: { where: { name?: string } }) =>
        args.where.name !== undefined ? (over.duplicate ?? null) : 'found' in over ? over.found : { id: 's-1' }
      ),
      create: jest.fn(async ({ data }: { data: object }) => ({ ...data, _count: { campaigns: 0 } })),
      update: jest.fn(async ({ data }: { data: object }) => ({ ...data, _count: { campaigns: 0 } })),
      delete: fn({}),
    },
    lead: { count: fn(over.used ?? 0) },
  };
}

describe('LeadSourceUseCase', () => {
  it('lists lead sources of the tenant with search, status, and pagination', async () => {
    const db = prisma();
    const result = await new LeadSourceUseCase(db as never).list('t-1', {
      search: 'web',
      isActive: true,
      page: 2,
      limit: 10,
    });
    expect(result.meta).toEqual({ total: 1, page: 2, limit: 10, totalPages: 1 });
    expect(result.data).toEqual([{ id: 's-1', name: 'Website', campaignCount: 2 }]);
    expect(db.source.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't-1', type: 'lead', name: { contains: 'web' }, isActive: true },
        skip: 10,
        take: 10,
      })
    );
  });

  it('creates a lead source for the tenant', async () => {
    const source = (await new LeadSourceUseCase(prisma() as never).create('t-1', {
      name: 'Website',
      color: '#3b82f6',
    })) as any;
    expect(source).toMatchObject({ tenantId: 't-1', type: 'lead', color: '#3B82F6', isActive: true, description: null });
  });

  it('rejects duplicate names within the tenant', async () => {
    const db = prisma({ duplicate: { id: 's-2' } });
    await expect(
      new LeadSourceUseCase(db as never).create('t-1', { name: 'website', color: '#000000' })
    ).rejects.toThrow(/already exists/);
    await expect(new LeadSourceUseCase(db as never).update('s-1', 't-1', { name: 'website' })).rejects.toThrow(
      /already exists/
    );
    expect(db.source.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', type: 'lead', name: 'website', id: { not: 's-1' } } })
    );
  });

  it('scopes update and delete to lead sources of the tenant', async () => {
    const db = prisma({ found: null });
    await expect(new LeadSourceUseCase(db as never).update('s-x', 't-1', { isActive: false })).rejects.toThrow(
      'Lead source not found'
    );
    await expect(new LeadSourceUseCase(db as never).remove('s-x', 't-1')).rejects.toThrow('Lead source not found');
    expect(db.source.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's-x', tenantId: 't-1', type: 'lead' } })
    );
  });

  it('rejects deleting a source used by leads', async () => {
    const db = prisma({ used: 3 });
    await expect(new LeadSourceUseCase(db as never).remove('s-1', 't-1')).rejects.toThrow(/used by 3 leads/);
    expect(db.lead.count).toHaveBeenCalledWith({ where: { tenantId: 't-1', sourceId: 's-1' } });
    expect(db.source.delete).not.toHaveBeenCalled();
  });

  it('deletes an unused source', async () => {
    const db = prisma();
    await new LeadSourceUseCase(db as never).remove('s-1', 't-1');
    expect(db.source.delete).toHaveBeenCalledWith({ where: { id: 's-1' } });
  });
});

describe('lead source validation', () => {
  it('accepts a valid source and trims text', () => {
    expect(validateLeadSourceCreate({ name: ' Website ', color: '#3B82F6', description: ' ' })).toEqual({
      name: 'Website',
      color: '#3B82F6',
      description: null,
    });
  });

  it('rejects invalid color, long names, and unknown fields', () => {
    expect(() => validateLeadSourceCreate({ name: 'A', color: 'blue' })).toThrow(/hex color/);
    expect(() => validateLeadSourceCreate({ name: 'A'.repeat(256), color: '#000000' })).toThrow();
    expect(() => validateLeadSourceCreate({ name: 'A', color: '#000000', type: 'viewing' })).toThrow(
      /Unsupported field/
    );
    expect(() => validateLeadSourceUpdate({ tenantId: 't-2' })).toThrow(/Unsupported field/);
  });

  it('parses search and status filters', () => {
    expect(parseLeadSourceFilters({ search: ' web ', status: 'inactive' })).toEqual({ search: 'web', isActive: false });
    expect(parseLeadSourceFilters({ status: '' })).toEqual({});
    expect(() => parseLeadSourceFilters({ status: 'all' })).toThrow(/active or inactive/);
  });
});
