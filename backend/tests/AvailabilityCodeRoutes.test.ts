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
  variants: [{ stock: 2 }],
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
  variant: { name: 'Type 45', currentPrice: 650_000_000n, attributes: [] },
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
  } as never);
  return { useCase, findUnique, findFirst, categoryFindMany, unitFindMany };
}

describe('Availability code routes and company ownership', () => {
  it('resolves project, cluster, and unit codes within the authenticated company', async () => {
    const { useCase, findUnique, categoryFindMany, unitFindMany } = setup();

    const detail = await useCase.unit('company-a', 'GREEN-HARMONY', 'MATAHARI', 'B1-AV-051');

    expect(detail).toEqual(expect.objectContaining({
      id: unitId,
      code: 'B1-AV-051',
      projectId,
      projectCode: 'GREEN-HARMONY',
      clusterCode: 'MATAHARI',
    }));
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_code: { tenantId: 'company-a', code: 'GREEN-HARMONY' } },
    }));
    expect(categoryFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'company-a' } }));
    expect(unitFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'company-a', variant: { productId: projectId, tenantId: 'company-a' } },
    }));
  });

  it('does not resolve a code or unrelated cluster outside company-owned data', async () => {
    const denied = setup(null);
    expect(await denied.useCase.project('company-b', 'GREEN-HARMONY')).toBeNull();
    expect(denied.categoryFindMany).not.toHaveBeenCalled();
    expect(denied.unitFindMany).not.toHaveBeenCalled();

    const owned = setup();
    expect(await owned.useCase.unit('company-a', 'GREEN-HARMONY', 'OTHER-CLUSTER', 'B1-AV-051')).toBeNull();
  });

  it('accepts legacy UUID links after a tenant-scoped lookup', async () => {
    const mocks = setup(null);
    mocks.findFirst.mockResolvedValue(project as never);

    const detail = await mocks.useCase.unit('company-a', projectId, clusterId, unitId);

    expect(detail?.code).toBe('B1-AV-051');
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: projectId, tenantId: 'company-a' },
    }));
  });

  it('includes units without a cluster in a navigable project group', async () => {
    const mocks = setup();
    mocks.unitFindMany.mockResolvedValue([{ ...unit, categoryId: 'root' }] as never);

    const projectOverview = await mocks.useCase.project('company-a', 'GREEN-HARMONY');
    expect(projectOverview?.project.totalUnits).toBe(2);
    const rootGroup = projectOverview?.clusters.find((item) => item.name === 'Tanpa cluster');
    expect(rootGroup).toEqual(expect.objectContaining({ units: 1, available: 1 }));

    const group = await mocks.useCase.cluster('company-a', 'GREEN-HARMONY', 'ROOT');
    expect(group?.units.map((item) => item.code)).toEqual(['B1-AV-051']);
  });
});
