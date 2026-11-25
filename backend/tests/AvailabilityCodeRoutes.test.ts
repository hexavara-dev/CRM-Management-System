import { jest } from '@jest/globals';
import { AvailabilityUseCase } from '../src/usecases/availability/AvailabilityUseCase.js';

const projectId = '11111111-1111-4111-8111-111111111111';
const clusterId = '22222222-2222-4222-8222-222222222222';
const unitId = '33333333-3333-4333-8333-333333333333';

const project = {
  id: projectId,
  code: 'GREEN-HARMONY',
  categoryId: 'root',
  name: 'Green Harmony',
  address: null,
  village: null,
  subdistrict: null,
  city: 'Bandung',
  province: null,
  variants: [{ typeVariants: [{ stock: 2 }] }],
  media: [],
};
const categories = [
  { id: 'root', code: 'ROOT', parentId: null, name: 'Project', type: 'PROJECT' },
  { id: clusterId, code: 'MATAHARI', parentId: 'root', name: 'Matahari', type: 'CLUSTER' },
  { id: 'block', code: 'B1', parentId: clusterId, name: 'B1', type: 'BLOCK' },
];
const unit = {
  id: unitId,
  code: 'B1-AV-051',
  name: null,
  categoryId: 'block',
  status: 'AVAILABLE',
  variant: { name: 'Type 45', currentPrice: 650_000_000n },
  typeVariant: { id: 'tv-45', name: 'Standard', basePrice: 650_000_000n },
  typeVariantId: 'tv-45',
  media: [],
  reservations: [],
};

function setup(foundProject: typeof project | null = project) {
  const findUnique = jest.fn().mockResolvedValue(foundProject as never);
  const findFirst = jest.fn().mockResolvedValue(null as never);
  const categoryFindMany = jest.fn().mockResolvedValue(categories as never);
  const unitFindMany = jest.fn().mockResolvedValue([unit] as never);
  const useCase = new AvailabilityUseCase({
    product: { findUnique, findFirst },
    productCategory: { findMany: categoryFindMany },
    productUnit: { findMany: unitFindMany },
    reservation: { findMany: jest.fn().mockResolvedValue([]) },
    productVariantPriceLog: { findMany: jest.fn().mockResolvedValue([] as never) },
    unitPriceAdjustment: { findMany: jest.fn().mockResolvedValue([] as never) },
    productMedia: { findMany: jest.fn().mockResolvedValue([] as never) },
  } as never);
  return { useCase, findUnique, findFirst, categoryFindMany, unitFindMany };
}

describe('Availability code routes and company ownership', () => {
  it('resolves project, cluster, and unit codes within the authenticated company', async () => {
    const { useCase, findUnique, categoryFindMany, unitFindMany } = setup();

    const detail = await useCase.unit('company-a', 'GREEN-HARMONY', 'MATAHARI', 'B1-AV-051');

    expect(detail).toEqual(
      expect.objectContaining({
        id: unitId,
        code: 'B1-AV-051',
        projectId,
        projectCode: 'GREEN-HARMONY',
        clusterCode: 'MATAHARI',
      })
    );
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_code: { tenantId: 'company-a', code: 'GREEN-HARMONY' } },
      })
    );
    expect(categoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'company-a' } })
    );
    expect(unitFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'company-a', variant: { productId: projectId, tenantId: 'company-a' } },
      })
    );
  });

  it('does not resolve a code or unrelated cluster outside company-owned data', async () => {
    const denied = setup(null);
    expect(await denied.useCase.project('company-b', 'GREEN-HARMONY')).toBeNull();
    expect(denied.categoryFindMany).not.toHaveBeenCalled();
    expect(denied.unitFindMany).not.toHaveBeenCalled();

    const owned = setup();
    expect(
      await owned.useCase.unit('company-a', 'GREEN-HARMONY', 'OTHER-CLUSTER', 'B1-AV-051')
    ).toBeNull();
  });

  it('accepts legacy UUID links after a tenant-scoped lookup', async () => {
    const mocks = setup(null);
    mocks.findFirst.mockResolvedValue(project as never);

    const detail = await mocks.useCase.unit('company-a', projectId, clusterId, unitId);

    expect(detail?.code).toBe('B1-AV-051');
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectId, tenantId: 'company-a' },
      })
    );
  });

  it('shows units attached to the project root without inventing a hierarchy group', async () => {
    const mocks = setup();
    mocks.unitFindMany.mockResolvedValue([{ ...unit, categoryId: 'root' }] as never);

    const projectOverview = await mocks.useCase.project('company-a', 'GREEN-HARMONY');
    expect(projectOverview?.project.totalUnits).toBe(1);
    expect(projectOverview?.hasCluster).toBe(true);
    expect(projectOverview?.units.map((item) => item.code)).toEqual(['B1-AV-051']);

    const group = await mocks.useCase.cluster('company-a', 'GREEN-HARMONY', 'ROOT');
    expect(group?.units.map((item) => item.code)).toEqual(['B1-AV-051']);
  });

  it('uses the actual deepest hierarchy instead of requiring a cluster level', async () => {
    const mocks = setup();
    mocks.categoryFindMany.mockResolvedValue([
      categories[0],
      { id: 'block', code: 'B1', parentId: 'root', name: 'B1', type: 'BLOCK' },
    ] as never);

    const overview = await mocks.useCase.project('company-a', 'GREEN-HARMONY');

    expect(overview?.hasCluster).toBe(false);
    expect(overview?.hierarchyLevel).toBe('BLOCK');
    expect(overview?.groups).toEqual([
      expect.objectContaining({ code: 'B1', level: 'BLOCK', units: 1, available: 1 }),
    ]);
  });

  it('drills through arbitrary hierarchy levels and returns subtree units for every node', async () => {
    const mocks = setup();
    mocks.categoryFindMany.mockResolvedValue([
      categories[0],
      { id: 'zone', code: 'ZONE-A', parentId: 'root', name: 'Zona A', type: 'ZONE' },
      { id: 'tower', code: 'TOWER-1', parentId: 'zone', name: 'Tower 1', type: 'TOWER' },
      { id: 'floor', code: 'FLOOR-2', parentId: 'tower', name: 'Lantai 2', type: 'FLOOR' },
    ] as never);
    mocks.unitFindMany.mockResolvedValue([{ ...unit, categoryId: 'floor' }] as never);

    const overview = await mocks.useCase.project('company-a', 'GREEN-HARMONY');
    const zone = await mocks.useCase.hierarchyNode('company-a', 'GREEN-HARMONY', 'ZONE-A');
    const tower = await mocks.useCase.hierarchyNode('company-a', 'GREEN-HARMONY', 'TOWER-1');
    const floor = await mocks.useCase.hierarchyNode('company-a', 'GREEN-HARMONY', 'FLOOR-2');

    expect(overview?.groups).toEqual([
      expect.objectContaining({ code: 'ZONE-A', level: 'ZONE', units: 1, children: 1 }),
    ]);
    expect(overview?.hierarchyGroups).toEqual([
      expect.objectContaining({ code: 'ZONE-A', level: 'ZONE', units: 1, children: 1 }),
      expect.objectContaining({ code: 'TOWER-1', level: 'TOWER', units: 1, children: 1 }),
      expect.objectContaining({ code: 'FLOOR-2', level: 'FLOOR', units: 1, children: 0 }),
    ]);
    expect(zone).toEqual(
      expect.objectContaining({
        node: expect.objectContaining({ code: 'ZONE-A', level: 'ZONE' }),
        children: [expect.objectContaining({ code: 'TOWER-1', level: 'TOWER', units: 1 })],
        units: [
          expect.objectContaining({
            code: 'B1-AV-051',
            location: 'Lantai 2',
            locationLevel: 'FLOOR',
            locationPathIds: ['floor', 'tower', 'zone', 'root'],
          }),
        ],
      })
    );
    expect(tower?.children).toEqual([
      expect.objectContaining({ code: 'FLOOR-2', level: 'FLOOR', units: 1 }),
    ]);
    expect(floor).toEqual(
      expect.objectContaining({
        children: [],
        units: [expect.objectContaining({ code: 'B1-AV-051' })],
      })
    );
  });

  it('keeps the legacy cluster method compatible with the generic hierarchy response', async () => {
    const mocks = setup();

    const generic = await mocks.useCase.hierarchyNode('company-a', 'GREEN-HARMONY', 'MATAHARI');
    const legacy = await mocks.useCase.cluster('company-a', 'GREEN-HARMONY', 'MATAHARI');

    expect(legacy).toEqual(generic);
    expect(legacy?.node).toEqual(legacy?.cluster);
  });
});
