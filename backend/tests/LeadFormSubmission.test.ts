import { jest } from '@jest/globals';
import { LeadFormSubmissionUseCase } from '../src/usecases/crm/LeadFormSubmissionUseCase.js';
import { systemField } from '../src/usecases/crm/LeadFormTemplateUseCase.js';
import { validateLeadFormSubmission } from '../src/presentation/validation/crm/leadFormSubmission.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

const actor = { tenantId: 't-1', userId: 'u-1', role: 'owner' };

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
  systemField('customer_gender'),
  systemField('customer_age'),
  systemField('interest_projects'),
  systemField('interest_types'),
  systemField('lead_budget'),
  systemField('lead_notes'),
  systemField('lead_campaign'),
  systemField('lead_stage'),
  systemField('lead_temperature'),
  custom('rencana_bayar', 'RADIO', { options: ['KPR', 'Cash'], required: true }),
  systemField('lead_source'),
  systemField('assigned_sales'),
];

const LABELS = [
  { id: 'hot', type: 'TEMPERATURE' },
  { id: 'warm', type: 'TEMPERATURE' },
  { id: 'tag-1', type: 'TAG' },
];

function prisma(over: Record<string, unknown> = {}) {
  const tx = {
    customer: { create: fn({ id: 'c-1' }) },
    lead: { create: fn({ id: 'l-1' }) },
    leadInterest: { createMany: fn({ count: 1 }) },
    leadActivity: { create: fn({}) },
    leadFormTemplateVersion: { updateMany: fn({ count: 1 }) },
  };
  const labels = (over.labels as typeof LABELS | undefined) ?? LABELS;
  return {
    tx,
    leadFormTemplate: { findFirst: fn('template' in over ? over.template : { id: 'tpl-1', name: 'Form Lead', currentVersionId: 'v-1' }) },
    leadFormTemplateVersion: { findFirst: fn({ id: 'v-1', version: 1, fields: over.fields ?? defaultFields() }) },
    source: { findFirst: fn('source' in over ? over.source : { id: 'src-1' }) },
    user: { findFirst: jest.fn(async (args: { where: { id: string } }) => ('sales' in over ? over.sales : { id: args.where.id })) },
    leadCampaign: { findFirst: fn('campaign' in over ? over.campaign : { id: 'cmp-1' }) },
    leadLabel: {
      findMany: jest.fn(async (args: { where: { id: { in: string[] } } }) => labels.filter((l) => args.where.id.in.includes(l.id))),
    },
    product: { findFirst: fn('project' in over ? over.project : { id: 'p-1' }) },
    productVariant: { findFirst: fn('type' in over ? over.type : { id: 'v36', productId: 'p-1' }) },
    stage: {
      findFirst: jest.fn(async (args: { where: { id?: string } }) =>
        args.where.id ? ('stage' in over ? over.stage : { id: args.where.id }) : { id: 'stage-new' }
      ),
    },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
}

const values = (over: Record<string, unknown> = {}) => ({
  name: ' Siti Rahmawati ',
  phone: '812 3456 7890',
  email: 'siti@example.com',
  customer_gender: 'male',
  customer_age: 30,
  interest_projects: 'p-1',
  interest_types: 'v36',
  lead_budget: 550_000_000,
  lead_notes: ' Butuh KPR ',
  lead_campaign: 'cmp-1',
  lead_stage: 'stage-2',
  lead_temperature: ['hot', 'tag-1'],
  rencana_bayar: 'KPR',
  lead_source: 'src-1',
  assigned_sales: 'u-2',
  ...over,
});

const submit = (db: ReturnType<typeof prisma>, v = values(), versionId = 'v-1', who: typeof actor = actor) =>
  new LeadFormSubmissionUseCase(db as never).submit(who, { templateVersionId: versionId, values: v });

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

  it('fails when the company has templates but none is the active default', async () => {
    const db = { ...prisma({ template: null }), leadFormTemplate: { findFirst: fn(null), count: fn(2) } };
    await expect(new LeadFormSubmissionUseCase(db as never).defaultForm('t-1', 'u-1')).rejects.toThrow(
      /Default form template not found/
    );
  });

  it('creates the standard default template for a company without any template', async () => {
    const tx = {
      leadFormTemplate: { create: fn({ id: 'tpl-std' }), update: fn({}) },
      leadFormTemplateVersion: { create: fn({ id: 'v-std' }) },
    };
    const findFirst = jest
      .fn<(...args: any[]) => any>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'tpl-std', name: 'Form Lead Standar', currentVersionId: 'v-std' });
    const db = {
      ...prisma(),
      leadFormTemplate: { findFirst, count: fn(0) },
      leadFormTemplateVersion: { findFirst: fn({ id: 'v-std', version: 1, fields: defaultFields() }) },
      $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const form = await new LeadFormSubmissionUseCase(db as never).defaultForm('t-1', 'u-1');
    expect(form).toMatchObject({ templateId: 'tpl-std', versionId: 'v-std' });
    expect(tx.leadFormTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 't-1', name: 'Form Lead Standar', isDefault: true, isActive: true, updatedById: 'u-1' }),
    });
    const fields = (tx.leadFormTemplateVersion.create.mock.calls[0]?.[0] as { data: { fields: { key: string }[] } }).data.fields;
    expect(fields.map((f) => f.key)).toEqual([
      'section_informasi_personal', 'name', 'customer_gender', 'customer_age',
      'section_informasi_kontak', 'phone', 'email', 'customer_address',
      'section_minat_kebutuhan', 'interest_projects', 'interest_types', 'lead_budget', 'lead_notes',
      'section_sumber_lead', 'lead_source', 'lead_campaign',
      'section_penugasan_pipeline', 'assigned_sales', 'lead_stage', 'lead_temperature',
    ]);
    expect(tx.leadFormTemplate.update).toHaveBeenCalledWith({ where: { id: 'tpl-std' }, data: { currentVersionId: 'v-std' } });
  });

  it('creates the customer, lead, interest, and registration activity like the legacy form, and locks the version', async () => {
    const db = prisma();
    await expect(submit(db)).resolves.toEqual({ id: 'l-1' });
    expect(db.tx.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenantId: 't-1',
          firstName: 'Siti Rahmawati',
          phoneNumber: '812 3456 7890',
          email: 'siti@example.com',
          gender: 'male',
          age: 30,
          location: null,
        },
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
          stageId: 'stage-2',
          campaignId: 'cmp-1',
          projectId: 'p-1',
          productVariantId: 'v36',
          labelAssignments: {
            create: [
              { tenantId: 't-1', labelId: 'hot' },
              { tenantId: 't-1', labelId: 'tag-1' },
            ],
          },
          budget: BigInt(550_000_000),
          needsNotes: 'Butuh KPR',
          formTemplateVersionId: 'v-1',
          customValues: { rencana_bayar: 'KPR' },
        }),
      })
    );
    expect(db.tx.leadInterest.createMany).toHaveBeenCalledWith({
      data: [{ productId: 'p-1', variantId: 'v36', tenantId: 't-1', leadId: 'l-1' }],
    });
    // Catatan menjadi catatan aktivitas registrasi (kartu "Catatan Terakhir").
    expect(db.tx.leadActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityType: 'registration',
        leadId: 'l-1',
        notes: { create: { tenantId: 't-1', content: 'Butuh KPR' } },
      }),
    });
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

  it('always assigns leads created by non-owners to themselves', async () => {
    const db = prisma();
    await submit(db, values({ assigned_sales: 'u-2' }), 'v-1', { ...actor, role: 'sales' });
    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u-1', tenantId: 't-1' } }));
    expect(db.tx.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedUserId: 'u-1' }) })
    );
  });

  it('stores minimal leads without optional relations and uses the active default stage', async () => {
    const db = prisma();
    const minimal = { name: 'Budi', phone: '0812345678', lead_source: 'src-1', rencana_bayar: 'Cash' };
    await submit(db, minimal);
    expect(db.stage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', entityType: 'lead', isDefaultStage: true, isActive: true } })
    );
    const data = (db.tx.lead.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ stageId: 'stage-new', projectId: null, productVariantId: null, needsNotes: null });
    expect(data.labelAssignments).toBeUndefined();
    expect(db.tx.leadInterest.createMany).not.toHaveBeenCalled();
    expect(db.tx.leadActivity.create).toHaveBeenCalledWith({ data: expect.not.objectContaining({ notes: expect.anything() }) });
  });

  it('maps the gender label to the stored value and rejects unknown genders', async () => {
    const db = prisma();
    await submit(db, values({ customer_gender: 'Perempuan' }));
    expect(db.tx.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: 'female' }) })
    );
    await expect(submit(prisma(), values({ customer_gender: 'x' }))).rejects.toThrow(/Jenis Kelamin must be one of the available options/);
  });

  it('validates age, project, type, stage, and labels', async () => {
    await expect(submit(prisma(), values({ customer_age: 150 }))).rejects.toThrow(/Umur must be a whole number between 0 and 120/);
    await expect(submit(prisma(), values({ customer_age: 'abc' }))).rejects.toThrow(/Umur must be a whole number/);
    await expect(submit(prisma(), values({ interest_projects: ['p-1', 'p-2'] }))).rejects.toThrow(/Project Diminati is invalid/);
    // Pesan harus dikenali HttpErrorMapper sebagai 400 (bukan 500 generik).
    await expect(submit(prisma(), values({ interest_projects: undefined }))).rejects.toThrow(/Tipe Rumah is invalid without Project Diminati/);
    await expect(submit(prisma({ stage: null }), values())).rejects.toThrow(/Tahapan Pipeline not found/);
    await expect(submit(prisma(), values({ lead_temperature: ['hot', 'warm'] }))).rejects.toThrow(/must be limited to one Temperature/);
    await expect(submit(prisma(), values({ lead_temperature: ['hot', 'hot'] }))).rejects.toThrow(/must not contain duplicates/);
    await expect(submit(prisma(), values({ lead_temperature: ['gone'] }))).rejects.toThrow(/Status Qualified not found/);
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
    await expect(submit(prisma({ project: null }))).rejects.toThrow(/Project Diminati not found/);
    await expect(submit(prisma({ type: null }))).rejects.toThrow(/must belong to the selected project/);
  });

  it('checks campaigns, types, stages, and labels within the tenant', async () => {
    const db = prisma();
    await submit(db);
    expect(db.leadCampaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'cmp-1', tenantId: 't-1', sourceId: 'src-1', isActive: true }) })
    );
    expect(db.productVariant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v36', tenantId: 't-1', productId: 'p-1' } })
    );
    expect(db.stage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'stage-2', tenantId: 't-1', entityType: 'lead', isActive: true } })
    );
    expect(db.leadLabel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['hot', 'tag-1'] }, tenantId: 't-1', isActive: true } })
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
