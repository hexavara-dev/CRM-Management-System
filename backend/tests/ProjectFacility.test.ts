import { jest } from '@jest/globals';
import {
  parseProjectFacilityFilters,
  validateProjectFacilityCreate,
  validateProjectFacilityUpdate,
} from '../src/presentation/validation/product/projectFacility.js';
import { AttributeUseCase } from '../src/usecases/product/AttributeUseCase.js';
import { ProductUseCase } from '../src/usecases/product/ProductUseCase.js';
import { DEFAULT_PROJECT_FACILITIES, defaultProjectFacilities } from '../src/usecases/product/projectFacilities.js';
import { ProjectFacilityUseCase } from '../src/usecases/product/ProjectFacilityUseCase.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

function prisma(over: { found?: unknown; duplicate?: unknown; used?: number } = {}) {
  const echo = async ({ data }: any) => ({ ...data, _count: { values: 0 } });
  return {
    attribute: {
      findMany: fn([{ id: 'f-1', name: 'Taman', _count: { values: 3 } }]),
      count: fn(1),
      // Dengan `name`: cek duplikat; tanpa `name`: cek fasilitas ada.
      findFirst: jest.fn<(...args: any[]) => any>().mockImplementation(async (args: any) =>
        args.where.name !== undefined ? (over.duplicate ?? null) : 'found' in over ? over.found : { id: 'f-1' }
      ),
      create: jest.fn(echo),
      update: jest.fn(echo),
      delete: fn({}),
    },
    productAttribute: { count: fn(over.used ?? 0) },
  };
}
const useCase = (db: unknown) => new ProjectFacilityUseCase(db as never);

describe('ProjectFacilityUseCase', () => {
  it('lists only facilities of the tenant with their usage', async () => {
    const db = prisma();
    const result = await useCase(db).list('t-1', { search: 'tam', isActive: true, page: 2, limit: 10 });
    expect(result.data).toEqual([{ id: 'f-1', name: 'Taman', usageCount: 3 }]);
    expect(result.meta).toEqual({ total: 1, page: 2, limit: 10, totalPages: 1 });
    expect(db.attribute.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't-1', source: 'PROJECT', name: { contains: 'tam' }, isActive: true },
        skip: 10,
        take: 10,
      })
    );
  });

  it('creates a project attribute with a generated code', async () => {
    const row = (await useCase(prisma()).create('t-1', { name: 'Gym', iconKey: 'dumbbell' })) as any;
    expect(row).toMatchObject({ tenantId: 't-1', source: 'PROJECT', dataType: 'NUMBER', isActive: true, usageCount: 0 });
    expect(row.code).toMatch(/^facility_.{36}$/);
  });

  it('rejects duplicate names but ignores itself on update', async () => {
    await expect(
      useCase(prisma({ duplicate: { id: 'f-2' } })).create('t-1', { name: 'Gym', iconKey: 'dumbbell' })
    ).rejects.toThrow(/already exists/);
    const db = prisma();
    await useCase(db).update('f-1', 't-1', { name: 'Gym' });
    expect(db.attribute.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', source: 'PROJECT', name: 'Gym', id: { not: 'f-1' } } })
    );
    expect(db.attribute.update.mock.calls[0]![0].data).toEqual({ name: 'Gym' });
  });

  it('does not reach other tenants or unit specifications', async () => {
    const db = prisma({ found: null });
    await expect(useCase(db).update('x', 't-1', { isActive: false })).rejects.toThrow(/not found/);
    await expect(useCase(db).remove('x', 't-1')).rejects.toThrow(/not found/);
    expect(db.attribute.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'x', tenantId: 't-1', source: 'PROJECT' } })
    );
    expect(db.attribute.delete).not.toHaveBeenCalled();
  });

  it('deletes unused facilities only', async () => {
    const used = prisma({ used: 2 });
    await expect(useCase(used).remove('f-1', 't-1')).rejects.toThrow(/Conflict.*2 proyek/);
    expect(used.attribute.delete).not.toHaveBeenCalled();
    const free = prisma();
    await useCase(free).remove('f-1', 't-1');
    expect(free.attribute.delete).toHaveBeenCalledWith({ where: { id: 'f-1' } });
  });
});

describe('facility validation and defaults', () => {
  it('provides valid starter facilities per company', () => {
    expect(defaultProjectFacilities('t-1')).toHaveLength(7);
    expect(defaultProjectFacilities('t-1').every((row) => row.tenantId === 't-1' && row.source === 'PROJECT')).toBe(true);
    for (const { name, iconKey } of DEFAULT_PROJECT_FACILITIES) {
      expect(() => validateProjectFacilityCreate({ name, iconKey })).not.toThrow();
    }
  });

  it('validates input and filters', () => {
    expect(validateProjectFacilityCreate({ name: ' Gym ', iconKey: 'dumbbell', description: ' ' })).toEqual({
      name: 'Gym',
      iconKey: 'dumbbell',
      description: null,
    });
    expect(() => validateProjectFacilityCreate({ name: 'Gym', iconKey: 'rocket' })).toThrow(/iconKey/);
    expect(() => validateProjectFacilityCreate({ name: '  ', iconKey: 'dumbbell' })).toThrow();
    expect(() => validateProjectFacilityUpdate({ tenantId: 't-2' })).toThrow();
    expect(parseProjectFacilityFilters({ search: ' a ', status: 'inactive' })).toEqual({ search: 'a', isActive: false });
    expect(() => parseProjectFacilityFilters({ status: 'x' })).toThrow(/status/);
  });
});

describe('generic attribute routes', () => {
  it('do not manage project facilities', async () => {
    const db = prisma({ found: { id: 'f-1', source: 'PROJECT' } });
    const attributes = new AttributeUseCase(db as never);
    const input = { name: 'A', code: 'a', dataType: 'NUMBER', source: 'PROJECT' } as const;
    await expect(attributes.create('t-1', input)).rejects.toThrow(/Invalid source/);
    await expect(attributes.update('f-1', 't-1', { name: 'B' })).rejects.toThrow(/Invalid source/);
    await expect(attributes.remove('f-1', 't-1')).rejects.toThrow(/Invalid source/);
    const unit = prisma({ found: { id: 'a-1', source: 'UNIT_TYPE' } });
    await expect(new AttributeUseCase(unit as never).update('a-1', 't-1', { source: 'PROJECT' })).rejects.toThrow(/Invalid source/);
    await new AttributeUseCase(unit as never).update('a-1', 't-1', { unit: 'm' });
    expect(unit.attribute.update).toHaveBeenCalledTimes(1);
  });
});

describe('facilities on projects', () => {
  it('rejects inactive facilities on a new project', async () => {
    const db = { attribute: { count: fn(0) } };
    await expect(
      new ProductUseCase(db as never).create('t-1', { name: 'P', code: 'P', facilityAttributeIds: ['f-1'] } as never)
    ).rejects.toThrow('Invalid facility attribute IDs');
    expect(db.attribute.count.mock.calls[0]![0].where).toEqual({
      tenantId: 't-1',
      id: { in: ['f-1'] },
      source: 'PROJECT',
      isActive: true,
    });
  });
});
