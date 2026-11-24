import { validateLeadCreate } from '../src/presentation/validation/CrmRequestValidation.js';

const ID = '11111111-1111-1111-1111-111111111111';
const SECOND_ID = '22222222-2222-2222-2222-222222222222';

const validPayload = () => ({
  firstName: '  Budi Santoso  ',
  phone: '+62 812-3456-7890',
  email: '  budi@example.com  ',
  age: 35,
  statusId: ID,
  sourceId: SECOND_ID,
  assignedUserId: ID,
  projectId: ID,
  productVariantId: SECOND_ID,
  budget: 550_000_000,
  priority: 'HIGH',
  createDeal: true,
  labelIds: [ID],
});

describe('Lead create request validation', () => {
  it('normalizes a complete valid payload', () => {
    expect(validateLeadCreate(validPayload())).toEqual({
      ...validPayload(),
      firstName: 'Budi Santoso',
      email: 'budi@example.com',
    });
  });

  it.each([
    [null, /object/i],
    [[], /object/i],
    [{ ...validPayload(), injectedAdmin: true }, /Unsupported field/i],
    [{ ...validPayload(), firstName: '   ' }, /firstName cannot be empty/i],
    [{ ...validPayload(), firstName: 'A'.repeat(101) }, /at most 100/i],
    [{ ...validPayload(), phone: 'abc<script>' }, /valid phone/i],
    [{ ...validPayload(), phone: '123' }, /valid phone/i],
    [{ ...validPayload(), email: 'not-an-email' }, /valid email/i],
    [{ ...validPayload(), age: -1 }, /at least 0/i],
    [{ ...validPayload(), age: 121 }, /at most 120/i],
    [{ ...validPayload(), age: 20.5 }, /integer/i],
    [{ ...validPayload(), age: '35' }, /finite number/i],
    [{ ...validPayload(), budget: -1 }, /at least 0/i],
    [{ ...validPayload(), budget: Number.POSITIVE_INFINITY }, /finite number/i],
    [{ ...validPayload(), budget: '550000000' }, /finite number/i],
    [{ ...validPayload(), budget: 10_000_000_000_000 }, /at most/i],
    [{ ...validPayload(), priority: 'URGENT' }, /must be one of/i],
    [{ ...validPayload(), priority: 'high' }, /must be one of/i],
    [{ ...validPayload(), createDeal: 'true' }, /boolean/i],
    [{ ...validPayload(), gender: 'unknown' }, /must be one of/i],
    [{ ...validPayload(), labelIds: [ID, ID] }, /duplicates/i],
    [{ ...validPayload(), labelIds: ['not-an-id'] }, /valid IDs/i],
    [{ ...validPayload(), labelIds: Array.from({ length: 21 }, (_, index) => `${String(index).padStart(8, '0')}-1111-1111-1111-111111111111`) }, /at most 20/i],
  ])('rejects malformed or abusive payload %#', (payload, message) => {
    expect(() => validateLeadCreate(payload)).toThrow(message as RegExp);
  });

  it.each(['phone', 'statusId', 'sourceId'] as const)(
    'rejects a payload without required field %s',
    (field) => {
      const payload = validPayload();
      delete payload[field];
      expect(() => validateLeadCreate(payload)).toThrow(new RegExp(`${field} is required`, 'i'));
    },
  );

  it('requires a project when a product variant is supplied', () => {
    const payload = validPayload();
    delete payload.projectId;
    expect(() => validateLeadCreate(payload)).toThrow(/projectId is required/i);
  });
});
