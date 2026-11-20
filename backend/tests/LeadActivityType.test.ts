import { jest } from '@jest/globals';
import {
  DEFAULT_LEAD_ACTIVITY_TYPES,
  LeadActivityTypeUseCase,
  defaultLeadActivityTypes,
} from '../src/usecases/crm/LeadActivityTypeUseCase.js';
import {
  parseLeadActivityTypeFilters,
  validateLeadActivityTypeCreate,
  validateLeadActivityTypeUpdate,
} from '../src/presentation/validation/crm/leadActivityType.js';
import { LEAD_LABEL_ICONS } from '../src/usecases/crm/leadLabelIcons.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

function prisma(over: { found?: unknown; duplicate?: unknown; maxSort?: number | null } = {}) {
  return {
    leadActivityType: {
      findMany: fn([{ id: 'a-1', name: 'Meeting' }]),
      count: fn(1),
      // Dengan `name`: cek duplikat; tanpa `name`: cek jenis ada.
      findFirst: jest.fn<(...args: any[]) => any>().mockImplementation(async (args: { where: { name?: string } }) =>
        args.where.name !== undefined ? (over.duplicate ?? null) : 'found' in over ? over.found : { id: 'a-1' }
      ),
      aggregate: fn({ _max: { sortOrder: 'maxSort' in over ? over.maxSort : 5 } }),
      create: jest.fn(async ({ data }: { data: unknown }) => data),
      update: jest.fn(async ({ data }: { data: unknown }) => data),
      delete: fn({}),
    },
  };
}

describe('LeadActivityTypeUseCase', () => {
  it('lists activity types of the tenant with search, status, and pagination', async () => {
    const db = prisma();
    const result = await new LeadActivityTypeUseCase(db as never).list('t-1', {
      search: 'meet',
      isActive: false,
      page: 2,
      limit: 10,
    });
    expect(result.meta).toEqual({ total: 1, page: 2, limit: 10, totalPages: 1 });
    expect(db.leadActivityType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't-1', name: { contains: 'meet' }, isActive: false },
        skip: 10,
        take: 10,
      })
    );
  });

  it('creates an activity type at the end of the tenant order', async () => {
    const db = prisma();
    const type = (await new LeadActivityTypeUseCase(db as never).create('t-1', {
      name: 'Meeting',
      icon: 'calendar',
      color: 'blue',
    })) as any;
    expect(type).toMatchObject({ tenantId: 't-1', sortOrder: 6, isActive: true, description: null });
    expect(db.leadActivityType.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't-1' } }));
  });

  it('starts ordering at zero for the first activity type', async () => {
    const type = (await new LeadActivityTypeUseCase(prisma({ maxSort: null }) as never).create('t-1', {
      name: 'Meeting',
      icon: 'calendar',
      color: 'blue',
    })) as any;
    expect(type.sortOrder).toBe(0);
  });

  it('rejects duplicate names within the tenant', async () => {
    const db = prisma({ duplicate: { id: 'a-2' } });
    await expect(
      new LeadActivityTypeUseCase(db as never).create('t-1', { name: 'meeting', icon: 'calendar', color: 'blue' })
    ).rejects.toThrow(/already exists/);
    expect(db.leadActivityType.create).not.toHaveBeenCalled();
  });

  it('updates only provided fields and excludes itself from the duplicate check', async () => {
    const db = prisma();
    const data = (await new LeadActivityTypeUseCase(db as never).update('a-1', 't-1', {
      name: 'Meeting Online',
      isActive: false,
    })) as any;
    expect(data).toEqual({ name: 'Meeting Online', isActive: false });
    expect(db.leadActivityType.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', name: 'Meeting Online', id: { not: 'a-1' } } })
    );
  });

  it('returns not found for an activity type of another tenant', async () => {
    const db = prisma({ found: null });
    const useCase = new LeadActivityTypeUseCase(db as never);
    await expect(useCase.update('a-9', 't-1', { isActive: false })).rejects.toThrow(/not found/);
    await expect(useCase.remove('a-9', 't-1')).rejects.toThrow(/not found/);
    expect(db.leadActivityType.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a-9', tenantId: 't-1' } })
    );
    expect(db.leadActivityType.delete).not.toHaveBeenCalled();
  });

  it('deletes an activity type of the tenant', async () => {
    const db = prisma();
    await new LeadActivityTypeUseCase(db as never).remove('a-1', 't-1');
    expect(db.leadActivityType.delete).toHaveBeenCalledWith({ where: { id: 'a-1' } });
  });
});

describe('default lead activity types', () => {
  it('provides the six starter types in order for a tenant', () => {
    const data = defaultLeadActivityTypes('t-1');
    expect(data.map((d) => d.name)).toEqual([
      'Follow Up (FU)',
      'Penawaran',
      'Visit / Survey',
      'Meeting',
      'Presentasi',
      'Catatan',
    ]);
    expect(data.every((d, i) => d.tenantId === 't-1' && d.sortOrder === i)).toBe(true);
  });

  it('uses only known icons and passes request validation', () => {
    for (const type of DEFAULT_LEAD_ACTIVITY_TYPES) {
      expect(LEAD_LABEL_ICONS).toContain(type.icon);
      expect(() => validateLeadActivityTypeCreate(type)).not.toThrow();
    }
  });
});

describe('lead activity type validation', () => {
  it('trims input and turns an empty description into null', () => {
    expect(
      validateLeadActivityTypeCreate({ name: '  Meeting ', icon: 'calendar', color: 'blue', description: '  ' })
    ).toEqual({ name: 'Meeting', icon: 'calendar', color: 'blue', description: null });
  });

  it('rejects unknown icons, colors, and fields', () => {
    expect(() => validateLeadActivityTypeCreate({ name: 'A', icon: 'rocket', color: 'blue' })).toThrow(/icon/);
    expect(() => validateLeadActivityTypeCreate({ name: 'A', icon: 'phone', color: '#FF0000' })).toThrow(/color/);
    expect(() => validateLeadActivityTypeUpdate({ tenantId: 't-2' })).toThrow();
  });

  it('requires name, icon, and color on create only', () => {
    expect(() => validateLeadActivityTypeCreate({ name: 'A' })).toThrow();
    expect(validateLeadActivityTypeUpdate({ isActive: false })).toEqual({ isActive: false });
  });

  it('parses status filters', () => {
    expect(parseLeadActivityTypeFilters({ search: ' fu ', status: 'active' })).toEqual({ search: 'fu', isActive: true });
    expect(() => parseLeadActivityTypeFilters({ status: 'archived' })).toThrow(/status/);
  });
});
