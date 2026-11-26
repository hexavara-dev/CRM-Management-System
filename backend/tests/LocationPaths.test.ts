import { jest } from '@jest/globals';
import { loadLocationPaths } from '../src/usecases/product/locationPaths.js';

const row = (id: string, name: string, type: string, parentId: string | null) => ({ id, name, type, parentId });

describe('loadLocationPaths', () => {
  const findMany = jest.fn<(...args: any[]) => any>().mockResolvedValue([
    row('p', 'Proyek', 'PROJECT', null),
    row('t1', 'Arjuna', 'TOWER', 'p'),
    row('t2', 'Bromo', 'TOWER', 'p'),
    row('f1', 'Lantai 1', 'FLOOR', 't1'),
    row('f2', 'Lantai 1', 'FLOOR', 't2'),
    row('x', 'X', 'BLOCK', 'y'),
    row('y', 'Y', 'BLOCK', 'x'),
  ]);
  const load = (ids: string[]) => loadLocationPaths({ productCategory: { findMany } } as never, 't-1', ids);

  it('tells locations with the same name apart, without the project', async () => {
    expect(Object.fromEntries(await load(['f1', 'f2', 'p', 'missing']))).toEqual({
      f1: 'Arjuna > Lantai 1',
      f2: 'Bromo > Lantai 1',
      p: '',
      missing: '',
    });
    expect(findMany.mock.calls[0]![0].where).toEqual({ tenantId: 't-1' });
  });

  it('stops on a broken hierarchy and skips the query without ids', async () => {
    expect((await load(['x'])).get('x')).toBe('Y > X');
    findMany.mockClear();
    expect((await load([])).size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});
