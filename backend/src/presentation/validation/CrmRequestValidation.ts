import { validateBody, type FieldRule } from '../../infrastructure/utils/RequestValidation.js';

const id = (nullable = false): FieldRule => ({
  type: 'string',
  max: 36,
  allowEmpty: true,
  nullable,
});
const text = (max: number, nullable = false): FieldRule => ({ type: 'string', max, nullable });
const optionalText = (max: number, nullable = false): FieldRule => ({
  type: 'string',
  max,
  allowEmpty: true,
  nullable,
});

const leadCreateRules: Record<string, FieldRule> = {
  firstName: { ...text(100), required: true },
  lastName: optionalText(100),
  email: optionalText(255),
  phone: { ...text(30), required: true },
  age: { type: 'number', integer: true, min: 0, max: 120 },
  company: optionalText(150),
  // Lead progression is controlled by the configured Leads Pipeline.
  stageId: { ...id(), required: true, allowEmpty: false },
  // Kept optional for backward-compatible records; the UI no longer uses lead statuses.
  statusId: id(),
  sourceId: { ...id(), required: true, allowEmpty: false },
  assignedUserId: id(),
  labelIds: { type: 'array', max: 20 },
  notes: optionalText(10000),
  type: optionalText(50),
  gender: { type: 'string', allowEmpty: true, values: ['male', 'female'] },
  salutation: optionalText(20),
  organizationName: optionalText(150),
  organizationLocation: optionalText(500),
  location: optionalText(500),
  locationId: id(),
  projectId: id(),
  productVariantId: id(),
  campaignId: id(),
  budget: { type: 'number', min: 0, max: 9_999_999_999_999.99 },
  priority: { type: 'string', values: ['LOW', 'MEDIUM', 'HIGH'] },
  createDeal: { type: 'boolean' },
  source: optionalText(50),
};

const leadUpdateRules: Record<string, FieldRule> = {
  assignedUserId: id(),
  stageId: id(),
  statusId: id(),
  labelIds: { type: 'array', max: 20 },
  locationId: id(),
  statusName: optionalText(100),
  type: optionalText(50),
  converted: { type: 'boolean' },
  convertedDate: { type: 'date', nullable: true },
  firstName: optionalText(100),
  lastName: optionalText(100),
  email: optionalText(255),
  phone: optionalText(30),
  age: { type: 'number', integer: true, min: 0, max: 120 },
  gender: { type: 'string', allowEmpty: true, values: ['male', 'female'] },
  salutation: optionalText(20),
  location: optionalText(500),
  sourceId: id(),
  organizationName: optionalText(150),
  organizationLocation: optionalText(500),
  projectId: id(),
  productVariantId: id(),
  campaignId: id(),
  budget: { type: 'number', min: 0, max: 9_999_999_999_999.99 },
  priority: { type: 'string', values: ['LOW', 'MEDIUM', 'HIGH'] },
};

const dealRules: Record<string, FieldRule> = {
  customerId: id(),
  assignedUserId: id(true),
  stageId: id(true),
  statusId: id(true),
  refCode: optionalText(80),
  dealType: optionalText(50, true),
  expectedAmount: { type: 'number', min: 0, nullable: true },
  amount: { type: 'number', min: 0, nullable: true },
  currency: { type: 'string', min: 3, max: 3 },
  expectedClosingDate: { type: 'date', nullable: true },
  closingDate: { type: 'date', nullable: true },
  lostReason: optionalText(500, true),
  lostNotes: optionalText(10000, true),
  unitId: id(true),
  paymentMethod: { type: 'string', values: ['CASH', 'KPR', 'KPR_SHARIA'] },
  bankName: optionalText(150, true),
  notes: optionalText(10000, true),
  financingBankId: id(true),
};

const viewingRules: Record<string, FieldRule> = {
  slotId: id(true),
  customerId: { ...id(), required: true, allowEmpty: false },
  locationId: id(true),
  sourceId: id(true),
  unitId: id(true),
  statusId: id(true),
  actorId: id(true),
  name: optionalText(150, true),
  email: optionalText(255, true),
  scheduledAt: { type: 'date', nullable: false },
  durationMinutes: { type: 'number', integer: true, min: 15, max: 480 },
  notes: optionalText(10000, true),
};

const stageRules: Record<string, FieldRule> = {
  name: text(100),
  position: { type: 'number', integer: true, min: 0 },
  color: optionalText(50),
  entityType: { type: 'string', values: ['lead', 'deal'] },
  isTerminalStage: { type: 'boolean' },
  isDefaultStage: { type: 'boolean' },
};

const statusRules: Record<string, FieldRule> = {
  name: text(100),
  priority: { type: 'number', integer: true, min: 0 },
  color: optionalText(7),
  type: { type: 'string', values: ['lead', 'deal', 'viewing'] },
  isDefaultStatus: { type: 'boolean' },
  isClosingStatus: { type: 'boolean' },
};

const taskRules: Record<string, FieldRule> = {
  title: text(200),
  description: optionalText(10000, true),
  startDate: { type: 'date', nullable: true },
  dueDate: { type: 'date', nullable: true },
  priority: { type: 'string', values: ['low', 'normal', 'high', 'urgent'] },
  assignedUserId: id(true),
  leadActivityId: id(true),
  dealActivityId: id(true),
};

const noteRules: Record<string, FieldRule> = {
  title: optionalText(200, true),
  content: text(10000),
  leadActivityId: id(true),
  dealActivityId: id(true),
};

const accountUpdateRules: Record<string, FieldRule> = {
  userId: { ...id(), required: true },
  name: optionalText(150),
  role: { type: 'string', values: ['owner', 'member'] },
  password: { type: 'string', min: 8, max: 128 },
};

const options = { allowUnknown: ['tenantId'] as const };

const validateLeadLabelIds = (data: Record<string, unknown>) => {
  if (data.labelIds === undefined) return data;
  const labelIds = data.labelIds as unknown[];
  if (labelIds.length > 20) throw new Error('labelIds must contain at most 20 items');
  if (!labelIds.every((value) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value))) {
    throw new Error('labelIds must contain valid IDs');
  }
  if (new Set(labelIds).size !== labelIds.length) {
    throw new Error('labelIds must not contain duplicates');
  }
  return data;
};

const normalizeAndValidateLead = (data: Record<string, unknown>) => {
  for (const field of ['firstName', 'lastName', 'email', 'phone', 'location', 'notes']) {
    if (typeof data[field] === 'string') data[field] = data[field].trim();
  }

  const email = data.email as string | undefined;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('email must be a valid email address');
  }

  const phone = data.phone as string | undefined;
  if (phone) {
    if (!/^\+?[0-9\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7) {
      throw new Error('phone must be a valid phone number');
    }
  }

  if (data.productVariantId && !data.projectId) {
    throw new Error('projectId is required when productVariantId is provided');
  }
  if (data.campaignId && !data.sourceId) {
    throw new Error('sourceId is required when campaignId is provided');
  }

  return validateLeadLabelIds(data);
};

export const validateLeadCreate = (body: unknown) =>
  normalizeAndValidateLead(validateBody(body, leadCreateRules, options));
export const validateLeadUpdate = (body: unknown) =>
  normalizeAndValidateLead(validateBody(body, leadUpdateRules, { ...options, partial: true }));
export const validateDealCreate = (body: unknown) => validateBody(body, dealRules, options);
export const validateDealUpdate = (body: unknown) =>
  validateBody(body, dealRules, { ...options, partial: true });
export const validateViewingCreate = (body: unknown) =>
  validateBody(body, { ...viewingRules, scheduledAt: { type: 'date', required: true } }, options);
export const validateViewingUpdate = (body: unknown) =>
  validateBody(body, viewingRules, { ...options, partial: true });
export const validateStageCreate = (body: unknown) =>
  validateBody(body, { ...stageRules, name: { ...stageRules.name!, required: true } }, options);
export const validateStageUpdate = (body: unknown) =>
  validateBody(body, stageRules, { ...options, partial: true });
export const validateStatusCreate = (body: unknown) =>
  validateBody(body, { ...statusRules, name: { ...statusRules.name!, required: true } }, options);
export const validateStatusUpdate = (body: unknown) =>
  validateBody(body, statusRules, { ...options, partial: true });
export const validateTaskCreate = (body: unknown) =>
  validateBody(body, { ...taskRules, title: { ...taskRules.title!, required: true } });
export const validateTaskUpdate = (body: unknown) =>
  validateBody(body, taskRules, { partial: true });
export const validateNoteCreate = (body: unknown) =>
  validateBody(body, { ...noteRules, content: { ...noteRules.content!, required: true } });
export const validateNoteUpdate = (body: unknown) =>
  validateBody(body, noteRules, { partial: true });
export const validateAccountUpdate = (body: unknown) =>
  validateBody(body, accountUpdateRules);

export const validateLeadConversion = (body: unknown) =>
  validateBody(body, {
    expectedAmount: { type: 'number', min: 0 },
    currency: { type: 'string', min: 3, max: 3 },
    unitId: { ...id(), required: true, allowEmpty: false },
    paymentMethod: { type: 'string', required: true, values: ['CASH', 'KPR', 'KPR_SHARIA'] },
    financingBankId: id(true),
    notes: optionalText(10000, true),
  });

export const validateRequiredName = (body: unknown, field: 'statusName' | 'stageName') =>
  validateBody(body, { [field]: { type: 'string', required: true, max: 100 } });

export const validateLeadStageChange = (body: unknown) =>
  validateBody(body, {
    stageName: { type: 'string', required: true, max: 100 },
    evidenceAttachmentIds: { type: 'array' },
  }) as { stageName: string; evidenceAttachmentIds?: unknown[] };

export const validateViewingFailure = (body: unknown) =>
  validateBody(body, { reason: { type: 'string', required: true, max: 1000 } });
