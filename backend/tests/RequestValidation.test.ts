import {
  parsePagination,
  parseSearch,
  validateBody,
} from '../src/infrastructure/utils/RequestValidation.js';
import {
  validateDealUpdate,
  validateAccountUpdate,
  validateNoteUpdate,
  validateStageCreate,
  validateTaskUpdate,
  validateViewingCreate,
  validateViewingUpdate,
} from '../src/presentation/validation/CrmRequestValidation.js';

describe('request validation', () => {
  it('parses bounded positive pagination values', () => {
    expect(parsePagination({ page: '2', limit: '25' })).toEqual({ page: 2, limit: 25 });
    expect(() => parsePagination({ page: '0' })).toThrow('page must be a positive integer');
    expect(() => parsePagination({ limit: '101' })).toThrow('limit must be at most 100');
    expect(() => parsePagination({ page: 'abc' })).toThrow('page must be a positive integer');
  });

  it('normalizes and bounds server-side search text', () => {
    expect(parseSearch({ search: '  Acme  ' })).toBe('Acme');
    expect(parseSearch({ search: '   ' })).toBeUndefined();
    expect(() => parseSearch({ search: ['Acme'] })).toThrow('search must be a string');
    expect(() => parseSearch({ search: 'x'.repeat(101) })).toThrow(
      'search must contain at most 100 characters'
    );
  });

  it('rejects unknown fields and invalid enums', () => {
    expect(() => validateStageCreate({ name: 'Qualified', entityType: 'user' })).toThrow(
      'entityType must be one of: lead, deal'
    );
    expect(() => validateStageCreate({ name: 'Qualified', password: 'unsafe' })).toThrow(
      'Unsupported field(s): password'
    );
  });

  it('converts valid dates and rejects invalid dates', () => {
    const result = validateViewingCreate({
      leadId: 'lead-1',
      scheduledAt: '2026-10-28T10:00:00.000Z',
    });
    expect(result.scheduledAt).toBeInstanceOf(Date);
    expect(() =>
      validateViewingCreate({ leadId: 'lead-1', scheduledAt: 'not-a-date' })
    ).toThrow('scheduledAt must be a valid date');
  });

  it('accepts a viewing durationMinutes between 15 and 480 whole minutes', () => {
    const base = { leadId: 'lead-1', scheduledAt: '2026-11-16T10:00:00.000Z' };
    expect(validateViewingCreate({ ...base, durationMinutes: 90 }).durationMinutes).toBe(90);
    expect(validateViewingUpdate({ durationMinutes: 30 }).durationMinutes).toBe(30);
    for (const invalid of [10, 500, 60.5]) {
      expect(() => validateViewingCreate({ ...base, durationMinutes: invalid })).toThrow(
        /durationMinutes/
      );
    }
  });

  it('requires at least one supported field for partial updates', () => {
    expect(() => validateDealUpdate({})).toThrow('At least one supported field is required');
  });

  it('rejects nested Prisma relation input from task requests', () => {
    expect(() =>
      validateTaskUpdate({ assignedUser: { connect: { id: 'user-1' } } })
    ).toThrow('Unsupported field(s): assignedUser');
  });

  it('rejects tenant and nested relation input from note requests', () => {
    expect(() => validateNoteUpdate({ tenantId: 'tenant-2' })).toThrow(
      'Unsupported field(s): tenantId'
    );
    expect(() =>
      validateNoteUpdate({ leadActivity: { connect: { id: 'activity-1' } } })
    ).toThrow('Unsupported field(s): leadActivity');
  });

  it('restricts account update fields, roles, and password length', () => {
    expect(() =>
      validateAccountUpdate({ userId: 'user-1', role: 'superadmin' })
    ).toThrow('role must be one of: owner, member');
    expect(() =>
      validateAccountUpdate({ userId: 'user-1', password: 'short' })
    ).toThrow('password must contain at least 8 characters');
    expect(() =>
      validateAccountUpdate({ userId: 'user-1', tenantId: 'tenant-2' })
    ).toThrow('Unsupported field(s): tenantId');
  });

  it('rejects non-object bodies', () => {
    expect(() => validateBody([], {})).toThrow('Request body must be an object');
  });
});
