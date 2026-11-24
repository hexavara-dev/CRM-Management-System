import { mapHttpError } from '../src/infrastructure/utils/HttpErrorMapper.js';
import { buildViewingListQuery } from '../src/usecases/viewing/viewingListQuery.js';

describe('buildViewingListQuery', () => {
  it('scopes to the tenant and sorts by newest visit by default', () => {
    const { where, orderBy } = buildViewingListQuery('t1', {});
    expect(where.tenantId).toBe('t1');
    expect(orderBy).toEqual([{ scheduledAt: 'desc' }, { id: 'asc' }]);
  });

  it('never lets the query override the tenant', () => {
    const { where } = buildViewingListQuery('t1', { tenantId: 'other' });
    expect(where.tenantId).toBe('t1');
    expect(JSON.stringify(where)).not.toContain('other');
  });

  it('keeps project and sales filters as separate lead conditions', () => {
    const { where } = buildViewingListQuery('t1', { projectId: 'p1', assignedUserId: 'u1' });
    expect(where.AND).toEqual(
      expect.arrayContaining([{ lead: { projectId: 'p1' } }, { lead: { assignedUserId: 'u1' } }])
    );
  });

  it('applies direct filters for status and the legacy lead, source, location, actor ids', () => {
    const { where } = buildViewingListQuery('t1', {
      statusId: 's1',
      leadId: 'l1',
      sourceId: 'so1',
      locationId: 'lo1',
      actorId: 'a1',
    });
    expect(where).toMatchObject({
      statusId: 's1',
      leadId: 'l1',
      sourceId: 'so1',
      locationId: 'lo1',
      actorId: 'a1',
    });
  });

  it('searches customer, phone, viewing name, sales and project with a trimmed term', () => {
    const { where } = buildViewingListQuery('t1', { search: '  budi ' });
    const searchClause = (where.AND as Array<{ OR?: unknown[] }>).find((c) => c.OR);
    expect(searchClause?.OR).toHaveLength(6);
    expect(JSON.stringify(searchClause)).toContain('"contains":"budi"');
  });

  it('ignores a blank search term', () => {
    const { where } = buildViewingListQuery('t1', { search: '   ' });
    expect(JSON.stringify(where)).not.toContain('contains');
  });

  it('maps whitelisted sort fields to Prisma ordering with a stable tiebreaker', () => {
    expect(
      buildViewingListQuery('t1', { sortBy: 'customerName', sortOrder: 'asc' }).orderBy
    ).toEqual([{ lead: { customer: { firstName: 'asc' } } }, { id: 'asc' }]);
    expect(buildViewingListQuery('t1', { sortBy: 'phone' }).orderBy[0]).toEqual({
      lead: { customer: { phoneNumber: 'desc' } },
    });
    expect(buildViewingListQuery('t1', { sortBy: 'sales', sortOrder: 'asc' }).orderBy[0]).toEqual({
      lead: { assignedUser: { name: 'asc' } },
    });
    expect(buildViewingListQuery('t1', { sortBy: 'status', sortOrder: 'asc' }).orderBy[0]).toEqual({
      status: { name: 'asc' },
    });
  });

  it('rejects unknown sort fields and orders instead of forwarding them', () => {
    expect(() => buildViewingListQuery('t1', { sortBy: 'password' })).toThrow(
      /sortBy must be one of/
    );
    expect(() => buildViewingListQuery('t1', { sortOrder: 'sideways' })).toThrow(
      /sortOrder must be one of/
    );
  });

  it('rejects non-string values for known parameters', () => {
    expect(() => buildViewingListQuery('t1', { statusId: ['a', 'b'] })).toThrow(
      /statusId must be a string/
    );
    expect(() => buildViewingListQuery('t1', { search: { $ne: 1 } })).toThrow(
      /search must be a string/
    );
  });

  it('ignores unknown parameters', () => {
    const { where } = buildViewingListQuery('t1', { 'lead[user][password]': 'x', unknown: 'y' });
    expect(JSON.stringify(where)).not.toContain('password');
    expect(JSON.stringify(where)).not.toContain('unknown');
  });

  it('converts a date range and rejects invalid or reversed ranges', () => {
    const { where } = buildViewingListQuery('t1', {
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.999Z',
    });
    expect(where.scheduledAt).toEqual({
      gte: new Date('2026-11-01T00:00:00.000Z'),
      lte: new Date('2026-11-30T23:59:59.999Z'),
    });
    expect(() => buildViewingListQuery('t1', { startDate: 'abc' })).toThrow(
      /startDate must be a valid date/
    );
    expect(() =>
      buildViewingListQuery('t1', {
        startDate: '2026-12-01T00:00:00.000Z',
        endDate: '2026-11-01T00:00:00.000Z',
      })
    ).toThrow(/startDate must be on or before endDate/);
  });

  it('matches nothing for a non-owner whose token carries no user id', () => {
    const { where } = buildViewingListQuery('t1', {}, { userId: '', role: 'member' });
    expect(where.AND).toEqual(expect.arrayContaining([{ id: { in: [] } }]));
    expect(JSON.stringify(where)).not.toContain('undefined');
  });

  it('limits non-owners to visits of their own assigned leads', () => {
    const member = buildViewingListQuery('t1', {}, { userId: 'u9', role: 'member' });
    expect(member.where.AND).toEqual(
      expect.arrayContaining([{ lead: { assignedUserId: 'u9' } }])
    );
    const owner = buildViewingListQuery('t1', {}, { userId: 'u1', role: 'owner' });
    expect(JSON.stringify(owner.where)).not.toContain('assignedUserId');
  });

  it('reports an over-long search as a client error, not a server error', () => {
    let thrown: unknown;
    try {
      buildViewingListQuery('t1', { search: 'a'.repeat(101) });
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).toBe('search must be at most 100 characters');
    expect(mapHttpError(thrown).status).toBe(400);
  });

  it('fails closed when the tenant is missing instead of widening the query', () => {
    expect(() => buildViewingListQuery('', {})).toThrow(/tenant/i);
    expect(() => buildViewingListQuery(undefined as unknown as string, {})).toThrow(/tenant/i);
  });
});
