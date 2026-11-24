import {
  parseArchiveListQuery,
  validateArchiveBulkCategoryChange,
  validateArchiveBulkIds,
  validateArchiveLead,
} from '../src/presentation/validation/LeadArchiveValidation.js';

const ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';

describe('Lead archive request validation', () => {
  it('accepts an archive category with an optional blank reason', () => {
    expect(validateArchiveLead({ category: 'INVALID', reason: '' })).toEqual({ category: 'INVALID', reason: '' });
    expect(validateArchiveLead({ category: 'NOT_RESPOND', reason: null })).toEqual({ category: 'NOT_RESPOND', reason: null });
  });

  it.each([
    [null, /object/i],
    [{}, /category is required/i],
    [{ category: 'invalid' }, /must be one of/i],
    [{ category: 123 }, /must be a string/i],
    [{ category: 'INVALID', reason: 123 }, /reason must be a string/i],
    [{ category: 'INVALID', reason: 'x'.repeat(501) }, /at most 500/i],
    [{ category: 'INVALID', tenantId: ID }, /unsupported field/i],
  ])('rejects malformed archive payload %#', (payload, message) => {
    expect(() => validateArchiveLead(payload)).toThrow(message as RegExp);
  });

  it.each([
    [{ ids: [] }, /between 1 and 100/i],
    [{ ids: Array.from({ length: 101 }, () => ID) }, /between 1 and 100/i],
    [{ ids: [ID, ID] }, /duplicates/i],
    [{ ids: ['wrong-id'] }, /valid Lead IDs/i],
    [{ ids: 'not-an-array' }, /array/i],
  ])('rejects unsafe bulk IDs %#', (payload, message) => {
    expect(() => validateArchiveBulkIds(payload)).toThrow(message as RegExp);
  });

  it('validates bulk category changes as one strict request', () => {
    expect(validateArchiveBulkCategoryChange({ ids: [ID, OTHER_ID], category: 'NOT_QUALIFIED', reason: 'Budget tidak sesuai' })).toEqual({ ids: [ID, OTHER_ID], category: 'NOT_QUALIFIED', reason: 'Budget tidak sesuai' });
  });

  it.each([
    [{ category: 'INVALID', projectId: ID, direction: 'asc' }, { category: 'INVALID', projectId: ID, direction: 'asc' }],
    [{ from: '2026-11-01', to: '2026-11-30' }, { direction: 'desc' }],
  ])('parses valid list query %#', (query, partial) => {
    expect(parseArchiveListQuery(query)).toEqual(expect.objectContaining(partial));
  });

  it('includes the whole selected end date in a period filter', () => {
    const end = parseArchiveListQuery({ to: '2026-11-30' }).to;
    expect(end?.getHours()).toBe(23);
    expect(end?.getMinutes()).toBe(59);
    expect(end?.getSeconds()).toBe(59);
    expect(end?.getMilliseconds()).toBe(999);
  });

  it.each([
    [{ category: 'NOT_RESPOND', unsupported: 'x' }, /Unsupported query/i],
    [{ category: 'TYPO' }, /valid archive category/i],
    [{ projectId: '7' }, /projectId must be a valid ID/i],
    [{ from: 'not-a-date' }, /from must be a valid date/i],
    [{ from: '2026-12-02', to: '2026-12-01' }, /from must be before/i],
    [{ sort: 'customerName' }, /Unsupported archive sort/i],
    [{ direction: 'sideways' }, /Unsupported archive sort/i],
  ])('rejects unexpected query values %#', (query, message) => {
    expect(() => parseArchiveListQuery(query)).toThrow(message as RegExp);
  });
});
