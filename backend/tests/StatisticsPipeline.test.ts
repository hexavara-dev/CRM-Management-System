import { jest } from '@jest/globals';
import { StatisticsUseCases } from '../src/usecases/statistics/StatisticsUseCases.js';

type Mock = jest.Mock<(...args: any[]) => any>;

/** Prisma tiruan: setiap model/metode mengembalikan nilai kosong kecuali yang ditimpa. */
function fakePrisma(overrides: Record<string, unknown> = {}) {
  const cache = new Map<string, Mock>();
  const empty = (method: string) => {
    if (method === 'count') return 0;
    if (method === 'aggregate') return { _avg: { amount: null }, _sum: { stock: null } };
    return [];
  };
  const mock = (model: string, method: string): Mock => {
    const key = `${model}.${method}`;
    if (!cache.has(key)) {
      cache.set(key, jest.fn<(...args: any[]) => any>().mockResolvedValue(key in overrides ? overrides[key] : empty(method)));
    }
    return cache.get(key) as Mock;
  };
  return new Proxy({} as Record<string, Record<string, Mock>>, {
    get: (_target, model: string) => new Proxy({}, { get: (_t, method: string) => mock(model, method) }),
  });
}

describe('StatisticsUseCases pipelines', () => {
  it('counts only active leads, matching the Leads Management list (no deleted or archived)', async () => {
    const db = fakePrisma();
    await new StatisticsUseCases(db as never).getStatistics('t-1');
    expect(db.lead!.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['stageId'],
        where: expect.objectContaining({ tenantId: 't-1', isDeleted: false, archivedAt: null }),
      })
    );
  });

  it('maps stage counts onto the configured stages, with zero for empty stages', async () => {
    const db = fakePrisma({
      'stage.findMany': [
        { id: 's1', name: 'New', color: null },
        { id: 's2', name: 'Won', color: null },
      ],
      'lead.groupBy': [{ stageId: 's1', _count: { _all: 7 } }],
    });
    const stats = await new StatisticsUseCases(db as never).getStatistics('t-1');
    expect(stats.leadPipeline.map((s) => [s.name, s.count])).toEqual([
      ['New', 7],
      ['Won', 0],
    ]);
  });
});
