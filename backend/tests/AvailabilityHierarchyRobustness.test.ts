import { jest } from '@jest/globals';
import { AvailabilityUseCase } from '../src/usecases/availability/AvailabilityUseCase.js';

type Category = {
  id: string;
  code: string;
  parentId: string | null;
  name: string;
  type: 'PROJECT' | 'CLUSTER' | 'ZONE' | 'BLOCK' | 'TOWER' | 'FLOOR';
};

const project = {
  id: 'project-1',
  code: 'ROBUST-PROJECT',
  categoryId: 'root',
  name: 'Robust Project',
  address: null,
  village: null,
  subdistrict: null,
  city: null,
  province: null,
  variants: [{ typeVariants: [{ stock: 1_000 }] }],
  media: [],
};

const root: Category = {
  id: 'root',
  code: 'ROOT',
  parentId: null,
  name: 'Project Root',
  type: 'PROJECT',
};

function makeUnit(id: string, categoryId: string) {
  return {
    id,
    code: id.toUpperCase(),
    name: null,
    categoryId,
    status: 'AVAILABLE',
    variant: { name: 'Type 36', currentPrice: 400_000_000n },
    typeVariant: {
      id: 'type-variant-1',
      name: 'Standard',
      basePrice: 400_000_000n,
      currentPrice: 400_000_000n,
    },
    typeVariantId: 'type-variant-1',
    media: [],
    reservations: [],
  };
}

function setup(categories: Category[], units: ReturnType<typeof makeUnit>[] = []) {
  return new AvailabilityUseCase({
    product: {
      findUnique: jest.fn().mockResolvedValue(project as never),
      findFirst: jest.fn().mockResolvedValue(null as never),
    },
    productCategory: {
      findMany: jest.fn().mockResolvedValue(categories as never),
    },
    productUnit: {
      findMany: jest.fn().mockResolvedValue(units as never),
    },
    reservation: { findMany: jest.fn().mockResolvedValue([]) },
    productVariantPriceLog: { findMany: jest.fn().mockResolvedValue([] as never) },
    unitPriceAdjustment: { findMany: jest.fn().mockResolvedValue([] as never) },
  } as never);
}

describe('Availability hierarchy robustness for inconsistent persisted data', () => {
  it('keeps overview totals consistent by excluding categories outside the project tree', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([
        {
          variantId: 'variant-1',
          categoryId: 'root',
          status: 'AVAILABLE',
          _count: { _all: 2 },
        },
        {
          variantId: 'variant-1',
          categoryId: 'other-project-block',
          status: 'SOLD',
          _count: { _all: 1 },
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    const useCase = new AvailabilityUseCase({
      product: {
        findMany: jest.fn().mockResolvedValue([
          { ...project, variants: [{ id: 'variant-1', typeVariants: [{ stock: 3 }] }] },
        ] as never),
      },
      productCategory: { findMany: jest.fn().mockResolvedValue([root] as never) },
      productUnit: { groupBy },
      reservation: { findMany: jest.fn().mockResolvedValue([]) },
    } as never);

    const result = await useCase.overview('tenant-1');

    expect(result.summary).toEqual(
      expect.objectContaining({ total: 2, available: 2, sold: 0 })
    );
    expect(result.projects[0]).toEqual(
      expect.objectContaining({
        total: 2,
        available: 2,
        sold: 0,
        integrity: {
          status: 'degraded',
          ignoredUnitCount: 1,
          skippedCycleEdges: 0,
        },
      })
    );
  });

  it('handles uneven branches, repeated level types, and units on intermediate and leaf nodes', async () => {
    const categories: Category[] = [
      root,
      { id: 'zone-a', code: 'ZONE-A', parentId: 'root', name: 'Zone A', type: 'ZONE' },
      { id: 'zone-a2', code: 'ZONE-A2', parentId: 'zone-a', name: 'Zone A2', type: 'ZONE' },
      { id: 'block-a', code: 'BLOCK-A', parentId: 'zone-a', name: 'Block A', type: 'BLOCK' },
      { id: 'tower-a', code: 'TOWER-A', parentId: 'zone-a', name: 'Tower A', type: 'TOWER' },
      { id: 'floor-a', code: 'FLOOR-A', parentId: 'tower-a', name: 'Floor A', type: 'FLOOR' },
    ];
    const useCase = setup(categories, [
      makeUnit('unit-zone', 'zone-a'),
      makeUnit('unit-block', 'block-a'),
      makeUnit('unit-floor', 'floor-a'),
    ]);

    const overview = await useCase.project('tenant-1', project.code);
    const zone = await useCase.hierarchyNode('tenant-1', project.code, 'ZONE-A');

    expect(overview?.project.totalUnits).toBe(3);
    expect(overview?.hierarchyGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ZONE-A', level: 'ZONE', units: 3 }),
        expect.objectContaining({ code: 'ZONE-A2', level: 'ZONE', units: 0 }),
        expect.objectContaining({ code: 'BLOCK-A', level: 'BLOCK', units: 1 }),
        expect.objectContaining({ code: 'TOWER-A', level: 'TOWER', units: 1 }),
        expect.objectContaining({ code: 'FLOOR-A', level: 'FLOOR', units: 1 }),
      ])
    );
    expect(zone?.units.map((unit) => unit.code).sort()).toEqual([
      'UNIT-BLOCK',
      'UNIT-FLOOR',
      'UNIT-ZONE',
    ]);
    expect(zone?.units.find((unit) => unit.code === 'UNIT-FLOOR')?.locationPathIds).toEqual([
      'floor-a',
      'tower-a',
      'zone-a',
      'root',
    ]);
  });

  it('returns a stable empty response for a root-only hierarchy with no units', async () => {
    const overview = await setup([root]).project('tenant-1', project.code);

    expect(overview).toEqual(
      expect.objectContaining({
        project: expect.objectContaining({ totalUnits: 0, available: 0 }),
        groups: [],
        hierarchyGroups: [],
        units: [],
      })
    );
  });

  it('fails closed when the project root category is missing', async () => {
    const overview = await setup([
      { id: 'orphan', code: 'ORPHAN', parentId: null, name: 'Orphan', type: 'ZONE' },
    ]).project('tenant-1', project.code);

    expect(overview).toBeNull();
  });

  it('ignores disconnected categories and refuses to navigate to them', async () => {
    const useCase = setup([
      root,
      { id: 'block-a', code: 'BLOCK-A', parentId: 'root', name: 'Block A', type: 'BLOCK' },
      { id: 'orphan', code: 'ORPHAN', parentId: 'missing-parent', name: 'Orphan', type: 'ZONE' },
    ]);

    const overview = await useCase.project('tenant-1', project.code);
    const orphan = await useCase.hierarchyNode('tenant-1', project.code, 'ORPHAN');

    expect(overview?.hierarchyGroups.map((group) => group.code)).toEqual(['BLOCK-A']);
    expect(orphan).toBeNull();
  });

  it('terminates a reachable parent cycle without duplicating categories or units', async () => {
    const cyclicRoot = { ...root, parentId: 'block-a' };
    const useCase = setup(
      [
        cyclicRoot,
        { id: 'block-a', code: 'BLOCK-A', parentId: 'root', name: 'Block A', type: 'BLOCK' },
      ],
      [makeUnit('unit-a', 'block-a')]
    );

    const overview = await useCase.project('tenant-1', project.code);
    const block = await useCase.hierarchyNode('tenant-1', project.code, 'BLOCK-A');

    expect(overview?.project.totalUnits).toBe(1);
    expect(overview?.hierarchyGroups.map((group) => group.code)).toEqual(['BLOCK-A']);
    expect(block?.units).toHaveLength(1);
    expect(block?.units[0]?.locationPathIds).toEqual(['block-a', 'root']);
  });

  it('handles a 250-level hierarchy without recursion failure or duplicate units', async () => {
    const categories: Category[] = [root];
    for (let index = 1; index <= 250; index += 1) {
      categories.push({
        id: `level-${index}`,
        code: `LEVEL-${index}`,
        parentId: index === 1 ? 'root' : `level-${index - 1}`,
        name: `Level ${index}`,
        type: index % 2 === 0 ? 'BLOCK' : 'ZONE',
      });
    }
    const useCase = setup(categories, [makeUnit('unit-deep', 'level-250')]);

    const overview = await useCase.project('tenant-1', project.code);
    const deepest = await useCase.hierarchyNode('tenant-1', project.code, 'LEVEL-250');

    expect(overview?.hierarchyGroups).toHaveLength(250);
    expect(overview?.project.totalUnits).toBe(1);
    expect(deepest?.units).toHaveLength(1);
    expect(deepest?.units[0]?.locationPathIds).toHaveLength(251);
  }, 15_000);

  it('excludes and reports a unit whose category is outside the project hierarchy', async () => {
    const useCase = setup([root], [makeUnit('unit-outside', 'other-project-block')]);

    const overview = await useCase.project('tenant-1', project.code);
    const rootNode = await useCase.hierarchyNode('tenant-1', project.code, root.code);
    const unitDetail = await useCase.unit(
      'tenant-1',
      project.code,
      root.code,
      'UNIT-OUTSIDE'
    );

    expect(overview?.project.totalUnits).toBe(0);
    expect(overview?.units).toEqual([]);
    expect(overview?.integrity).toEqual({
      status: 'degraded',
      ignoredUnitCount: 1,
      skippedCycleEdges: 0,
    });
    expect(rootNode?.summary.total).toBe(0);
    expect(rootNode?.integrity).toEqual(overview?.integrity);
    expect(unitDetail).toBeNull();
  });

  it('sanitizes a reachable cycle so the project root is not exposed again as a child node', async () => {
    const useCase = setup(
      [
        { ...root, parentId: 'block-a' },
        { id: 'block-a', code: 'BLOCK-A', parentId: 'root', name: 'Block A', type: 'BLOCK' },
      ],
      [makeUnit('unit-a', 'block-a')]
    );

    const block = await useCase.hierarchyNode('tenant-1', project.code, 'BLOCK-A');

    expect(block?.children.map((child) => child.id)).not.toContain('root');
    expect(block?.units).toHaveLength(1);
    expect(block?.integrity).toEqual({
      status: 'degraded',
      ignoredUnitCount: 0,
      skippedCycleEdges: 1,
    });
  });
});
