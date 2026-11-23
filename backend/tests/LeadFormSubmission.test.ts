import { jest } from '@jest/globals';
import { LeadFormSubmissionUseCase } from '../src/usecases/crm/LeadFormSubmissionUseCase.js';
import { systemField } from '../src/usecases/crm/LeadFormTemplateUseCase.js';
import { validateLeadFormSubmission } from '../src/presentation/validation/crm/leadFormSubmission.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

const actor = { tenantId: 't-1', userId: 'u-1' };

const custom = (key: string, type: string, over: Record<string, unknown> = {}) => ({
  key,
  label: key,
  type,
  required: false,
  placeholder: null,
  helpText: null,
  options: null,
  ...over,
});

const defaultFields = () => [
  { key: 'section_personal', label: 'Informasi Personal', type: 'SECTION', required: false, placeholder: null, helpText: null, options: null },
  systemField('name'),
  systemField('phone'),
  systemField('email'),
  systemField('interest_projects'),
  systemField('interest_types'),
  systemField('lead_budget'),
  systemField('lead_campaign'),
  systemField('lead_temperature'),
  custom('rencana_bayar', 'RADIO', { options: ['KPR', 'Cash'], required: true }),
  systemField('lead_source'),
  systemField('assigned_sales'),
];

function prisma(over: Record<string, unknown> = {}) {
  const tx = {
    customer: { create: fn({ id: 'c-1' }) },
    lead: { create: fn({ id: 'l-1' }) },
    leadInterest: { createMany: fn({ count: 1 }) },
    leadActivity: { create: fn({}) },
    leadFormTemplateVersion: { updateMany: fn({ count: 1 }) },
  };
  return {
    tx,
    leadFormTemplate: { findFirst: fn('template' in over ? over.template : { id: 'tpl-1', name: 'Form Lead', currentVersionId: 'v-1' }) },
    leadFormTemplateVersion: { findFirst: fn({ id: 'v-1', version: 1, fields: over.fields ?? defaultFields() }) },
    source: { findFirst: fn('source' in over ? over.source : { id: 'src-1' }) },
    user: { findFirst: fn('sales' in over ? over.sales : { id: 'u-2' }) },
    leadCampaign: { findFirst: fn('campaign' in over ? over.campaign : { id: 'cmp-1' }) },
    leadLabel: { findFirst: fn('label' in over ? over.label : { id: 'hot' }) },
    product: { findMany: fn(over.products ?? [{ id: 'p-1' }, { id: 'p-2' }]) },
    productVariant: { findMany: fn(over.types ?? [{ id: 'v36', productId: 'p-1' }]) },
    stage: { findFirst: fn({ id: 'stage-new' }) },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
}

const values = (over: Record<string, unknown> = {}) => ({
  name: ' Siti Rahmawati ',
  phone: '812 3456 7890',
  email: 'siti@example.com',
  interest_projects: ['p-1', 'p-2'],
  interest_types: ['v36'],
  lead_budget: 550_000_000,
  lead_campaign: 'cmp-1',
  lead_temperature: 'hot',
  rencana_bayar: 'KPR',
  lead_source: 'src-1',
  assigned_sales: 'u-2',
  ...over,
});

const submit = (db: ReturnType<typeof prisma>, v = values(), versionId = 'v-1') =>
  new LeadFormSubmissionUseCase(db as never).submit(actor, { templateVersionId: versionId, values: v });

describe('LeadFormSubmissionUseCase', () => {
  it('returns the default form with always-present system fields', async () => {
    const db = prisma({ fields: [custom('catatan', 'TEXT')] });
    const form = await new LeadFormSubmissionUseCase(db as never).defaultForm('t-1');
    expect(form).toMatchObject({ templateId: 'tpl-1', versionId: 'v-1', version: 1 });
    expect(form.fields.map((f) => f.key)).toEqual(['name', 'phone', 'email', 'catatan', 'lead_source', 'assigned_sales']);
    expect(db.leadFormTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', isDefault: true, isActive: true } })
    );
  });

  it('fails when the company has no default template', async () => {
    await expect(new LeadFormSubmissionUseCase(prisma({ template: null }) as never).defaultForm('t-1')).rejects.toThrow(
      /Default form template not found/
    );
  });

  it('creates the customer, lead, interests, and registration activity, and locks the version', async () => {
    const db = prisma();
    await expect(submit(db)).resolves.toEqual({ id: 'l-1' });
    expect(db.tx.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { tenantId: 't-1', firstName: 'Siti Rahmawati', phoneNumber: '812 3456 7890', email: 'siti@example.com', gender: null, location: null },
      })
    );
    expect(db.tx.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't-1',
          customerId: 'c-1',
          assignedUserId: 'u-2',
          sourceUserId: 'u-1',
          sourceId: 'src-1',
          stageId: 'stage-new',
          campaignId: 'cmp-1',
          temperatureLabelId: 'hot',
          budget: BigInt(550_000_000),
          formTemplateVersionId: 'v-1',
          customValues: { rencana_bayar: 'KPR' },
        }),
      })
    );
    // p-1 dengan tipe 36; p-2 tanpa tipe.
    expect(db.tx.leadInterest.createMany).toHaveBeenCalledWith({
      data: [
        { productId: 'p-1', variantId: 'v36', tenantId: 't-1', leadId: 'l-1' },
        { productId: 'p-2', variantId: null, tenantId: 't-1', leadId: 'l-1' },
      ],
    });
    expect(db.tx.leadActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ activityType: 'registration', leadId: 'l-1' }) })
    );
    expect(db.tx.leadFormTemplateVersion.updateMany).toHaveBeenCalledWith({
      where: { id: 'v-1', tenantId: 't-1', isLocked: false },
      data: { isLocked: true },
    });
  });

  it('assigns the lead to the creator when no sales is chosen', async () => {
    const db = prisma({ sales: { id: 'u-1' } });
    await submit(db, values({ assigned_sales: '' }));
    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u-1', tenantId: 't-1' } }));
  });

  it('rejects a stale form version and unknown fields', async () => {
    await expect(submit(prisma(), values(), 'v-old')).rejects.toThrow(/form has changed/);
    await expect(submit(prisma(), values({ hacked: 'x' }))).rejects.toThrow(/Unsupported field/);
  });

  it('validates required fields and custom field values against the template', async () => {
    await expect(submit(prisma(), values({ name: '  ' }))).rejects.toThrow(/Nama Lengkap is required/);
    await expect(submit(prisma(), values({ lead_source: undefined }))).rejects.toThrow(/Sumber Lead is required/);
    await expect(submit(prisma(), values({ rencana_bayar: 'Cicil' }))).rejects.toThrow(/available options/);
    await expect(submit(prisma(), values({ email: 'bukan-email' }))).rejects.toThrow(/valid email/);
    await expect(submit(prisma(), values({ lead_budget: -1 }))).rejects.toThrow(/whole number/);
  });

  it('rejects relations outside the tenant or not selectable', async () => {
    await expect(submit(prisma({ source: null }))).rejects.toThrow(/Sumber Lead not found/);
    await expect(submit(prisma({ campaign: null }))).rejects.toThrow(/Campaign is invalid for the selected lead source/);
    await expect(submit(prisma({ label: null }))).rejects.toThrow(/Status Lead not found/);
    await expect(submit(prisma({ products: [{ id: 'p-1' }] }))).rejects.toThrow(/Project Diminati not found/);
    await expect(submit(prisma({ types: [] }))).rejects.toThrow(/must belong to the selected projects/);
  });

  it('checks campaigns against the chosen source, active flag, and period', async () => {
    const db = prisma();
    await submit(db);
    expect(db.leadCampaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'cmp-1', tenantId: 't-1', sourceId: 'src-1', isActive: true }) })
    );
    expect(db.productVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['v36'] }, tenantId: 't-1', productId: { in: ['p-1', 'p-2'] } } })
    );
  });
});

describe('lead form submission validation', () => {
  it('requires a version id and a values object', () => {
    expect(validateLeadFormSubmission({ templateVersionId: 'v-1', values: { name: 'A' } })).toEqual({
      templateVersionId: 'v-1',
      values: { name: 'A' },
    });
    expect(() => validateLeadFormSubmission({ values: {} })).toThrow(/templateVersionId/);
    expect(() => validateLeadFormSubmission({ templateVersionId: 'v-1', values: [] })).toThrow(/values must be an object/);
    expect(() => validateLeadFormSubmission({ templateVersionId: 'v-1', values: {}, tenantId: 't-2' })).toThrow(/Unsupported field/);
  });
});
