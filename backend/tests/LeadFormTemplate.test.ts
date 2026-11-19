import { jest } from '@jest/globals';
import {
  assignFieldKeys,
  fieldKeyOf,
  LeadFormTemplateUseCase,
} from '../src/usecases/crm/LeadFormTemplateUseCase.js';
import {
  parseFormTemplateFilters,
  validateFormTemplateCreate,
  validateFormTemplateUpdate,
} from '../src/presentation/validation/crm/leadFormTemplate.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

const actor = { tenantId: 't-1', userId: 'u-1' };
const field = (label: string, over: Record<string, unknown> = {}) => ({
  label,
  type: 'TEXT' as const,
  required: false,
  placeholder: null,
  helpText: null,
  options: null,
  ...over,
});

const template = (over: Record<string, unknown> = {}) => ({
  id: 'f-1',
  tenantId: 't-1',
  name: 'Form Lead Properti',
  description: null,
  icon: 'home',
  color: '#3B82F6',
  isDefault: false,
  defaultGuard: null,
  isActive: true,
  currentVersionId: 'v-1',
  updatedById: 'u-1',
  updatedAt: new Date('2026-11-10T02:24:00Z'),
  updatedBy: { id: 'u-1', name: 'Demo Owner' },
  ...over,
});

function prisma(
  over: { template?: unknown; duplicate?: unknown; version?: unknown; lastVersion?: number; locked?: number; names?: string[] } = {},
) {
  const version = over.version ?? { id: 'v-1', version: 1, isLocked: false, fields: [{ ...field('Budget'), key: 'budget' }] };
  const tx = {
    leadFormTemplate: {
      create: fn({ id: 'f-new' }),
      update: fn({}),
      updateMany: fn({ count: 1 }),
    },
    leadFormTemplateVersion: {
      create: fn({ id: 'v-new' }),
      update: fn({}),
      findFirst: jest.fn<(...args: any[]) => any>().mockImplementation(async (args: { select?: unknown }) =>
        args.select ? { version: over.lastVersion ?? 1 } : version
      ),
    },
  };
  return {
    tx,
    leadFormTemplate: {
      findMany: jest.fn<(...args: any[]) => any>().mockImplementation(async (args: { select?: { name?: boolean } }) =>
        args.select?.name ? (over.names ?? []).map((name) => ({ name })) : [template()]
      ),
      count: fn(1),
      findFirst: jest.fn<(...args: any[]) => any>().mockImplementation(async (args: { where: { name?: string } }) =>
        args.where.name !== undefined ? (over.duplicate ?? null) : 'template' in over ? over.template : template()
      ),
      delete: fn({}),
    },
    leadFormTemplateVersion: {
      findMany: fn([version]),
      count: fn(over.locked ?? 0),
    },
    $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
  };
}

describe('field keys', () => {
  it('builds keys from labels and keeps them unique', () => {
    expect(fieldKeyOf('Rencana Pembayaran')).toBe('rencana_pembayaran');
    expect(fieldKeyOf('  Budget (Rp)  ')).toBe('budget_rp');
    expect(fieldKeyOf('!!!')).toBe('field');
    const custom = (fields: ReturnType<typeof assignFieldKeys>) => fields.filter((f) => !f.standard).map((f) => f.key);
    expect(custom(assignFieldKeys([field('Budget'), field('budget'), field('Email')]))).toEqual(['budget', 'budget_2', 'email_2']);
  });

  it('keeps client keys and rejects duplicated keys', () => {
    const custom = assignFieldKeys([{ ...field('Anggaran'), key: 'budget' }, field('Budget')]).filter((f) => !f.standard);
    expect(custom.map((f) => f.key)).toEqual(['budget', 'budget_2']);
    expect(() => assignFieldKeys([{ ...field('A'), key: 'a' }, { ...field('B'), key: 'a' }])).toThrow(/duplicated/);
    expect(() => assignFieldKeys([{ ...field('Nama'), key: 'name' }, { ...field('Nama 2'), key: 'name' }])).toThrow(/duplicated/);
  });

  it('puts missing standard fields first and keeps the position of sent ones', () => {
    expect(assignFieldKeys([field('Budget')]).map((f) => f.key)).toEqual(['name', 'phone', 'email', 'budget']);
    expect(assignFieldKeys([field('Budget'), { ...field('Email'), key: 'email' }]).map((f) => f.key)).toEqual([
      'name',
      'phone',
      'budget',
      'email',
    ]);
  });

  it('lets standard fields change label and settings but not their type, and keeps the name required', () => {
    const result = assignFieldKeys([
      { ...field('Nama Customer', { type: 'SELECT', required: false, placeholder: 'Nama sesuai KTP' }), key: 'name' },
      { ...field('No. WhatsApp', { required: false }), key: 'phone' },
    ]);
    const name = result.find((f) => f.key === 'name');
    const phone = result.find((f) => f.key === 'phone');
    expect(name).toMatchObject({ key: 'name', label: 'Nama Customer', type: 'TEXT', required: true, placeholder: 'Nama sesuai KTP', standard: true });
    expect(phone).toMatchObject({ key: 'phone', label: 'No. WhatsApp', type: 'PHONE', required: false, standard: true });
  });
});

describe('LeadFormTemplateUseCase', () => {
  it('lists templates of the tenant with field count and last editor', async () => {
    const db = prisma();
    const result = await new LeadFormTemplateUseCase(db as never).list('t-1', { search: 'lead', isActive: true, page: 1, limit: 10 });
    expect(db.leadFormTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', name: { contains: 'lead' }, isActive: true } })
    );
    expect(result.data[0]).toMatchObject({ fieldCount: 4, version: 1, updatedBy: { name: 'Demo Owner' } });
  });

  it('creates a template with version 1', async () => {
    const db = prisma();
    await new LeadFormTemplateUseCase(db as never).create(actor, {
      name: 'Form Lead Properti',
      icon: 'home',
      color: '#3b82f6',
      fields: [field('Rencana Pembayaran', { type: 'SELECT', options: ['Tunai', 'KPR'] })],
    });
    expect(db.tx.leadFormTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 't-1', color: '#3B82F6', isDefault: false, updatedById: 'u-1' }),
    });
    expect(db.tx.leadFormTemplateVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: 'f-new',
        version: 1,
        fields: expect.arrayContaining([expect.objectContaining({ key: 'rencana_pembayaran', options: ['Tunai', 'KPR'] })]),
      }),
    });
    expect(db.tx.leadFormTemplate.update).toHaveBeenCalledWith({ where: { id: 'f-new' }, data: { currentVersionId: 'v-new' } });
  });

  it('updates the current version in place while it is not used by leads', async () => {
    const db = prisma();
    await new LeadFormTemplateUseCase(db as never).update('f-1', actor, { fields: [{ ...field('Budget'), key: 'budget' }] });
    expect(db.tx.leadFormTemplateVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-1' },
      data: { fields: expect.arrayContaining([expect.objectContaining({ key: 'budget' })]) },
    });
    expect(db.tx.leadFormTemplateVersion.create).not.toHaveBeenCalled();
  });

  it('creates a new version when the current version is locked', async () => {
    const db = prisma({ version: { id: 'v-2', version: 2, isLocked: true, fields: [] }, lastVersion: 2 });
    await new LeadFormTemplateUseCase(db as never).update('f-1', actor, { fields: [field('Budget')] });
    expect(db.tx.leadFormTemplateVersion.update).not.toHaveBeenCalled();
    expect(db.tx.leadFormTemplateVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ templateId: 'f-1', version: 3, createdById: 'u-1' }),
    });
    expect(db.tx.leadFormTemplate.update).toHaveBeenCalledWith({
      where: { id: 'f-1' },
      data: expect.objectContaining({ currentVersionId: 'v-new', updatedById: 'u-1' }),
    });
  });

  it('does not touch versions when only template info changes', async () => {
    const db = prisma();
    await new LeadFormTemplateUseCase(db as never).update('f-1', actor, { name: 'Form Baru', isActive: false });
    expect(db.tx.leadFormTemplateVersion.update).not.toHaveBeenCalled();
    expect(db.tx.leadFormTemplateVersion.create).not.toHaveBeenCalled();
  });

  it('moves the default flag and protects the default template', async () => {
    const db = prisma();
    await new LeadFormTemplateUseCase(db as never).update('f-1', actor, { isDefault: true });
    expect(db.tx.leadFormTemplate.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't-1', isDefault: true, id: { not: 'f-1' } },
      data: { isDefault: false, defaultGuard: null },
    });

    const defaults = prisma({ template: template({ isDefault: true }) });
    const useCase = new LeadFormTemplateUseCase(defaults as never);
    await expect(useCase.update('f-1', actor, { isDefault: false })).rejects.toThrow(/Choose another default/);
    await expect(useCase.update('f-1', actor, { isActive: false })).rejects.toThrow(/cannot be deactivated/);
    await expect(useCase.remove('f-1', 't-1')).rejects.toThrow(/default form template cannot be deleted/);
  });

  it('rejects deleting a template used by leads and scopes to the tenant', async () => {
    await expect(new LeadFormTemplateUseCase(prisma({ locked: 1 }) as never).remove('f-1', 't-1')).rejects.toThrow(
      /already used by leads/
    );
    const db = prisma({ template: null });
    await expect(new LeadFormTemplateUseCase(db as never).remove('f-x', 't-1')).rejects.toThrow('Form template not found');
    expect(db.leadFormTemplate.delete).not.toHaveBeenCalled();
  });

  it('rejects duplicate names', async () => {
    const db = prisma({ duplicate: { id: 'f-2' } });
    await expect(
      new LeadFormTemplateUseCase(db as never).create(actor, { name: 'form lead properti', icon: 'home', color: '#000000' })
    ).rejects.toThrow(/already exists/);
  });

  it('duplicates a template with its fields under a free copy name', async () => {
    const db = prisma({ names: ['Form Lead Properti (Salinan)'] });
    await new LeadFormTemplateUseCase(db as never).duplicate('f-1', actor);
    expect(db.tx.leadFormTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Form Lead Properti (Salinan 2)', isDefault: false }),
    });
    expect(db.tx.leadFormTemplateVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 1, fields: expect.arrayContaining([expect.objectContaining({ key: 'budget' })]) }),
    });
  });
});

describe('form template validation', () => {
  const base = { name: ' Form Lead ', icon: 'home', color: '#3B82F6' };

  it('accepts a template with fields and normalizes them', () => {
    expect(
      validateFormTemplateCreate({
        ...base,
        fields: [{ label: ' Rencana ', type: 'SELECT', options: [' Tunai ', 'KPR'], placeholder: ' ' }],
      })
    ).toEqual({
      name: 'Form Lead',
      icon: 'home',
      color: '#3B82F6',
      fields: [{ label: 'Rencana', type: 'SELECT', required: false, placeholder: null, helpText: null, options: ['Tunai', 'KPR'] }],
    });
    expect(validateFormTemplateCreate(base).fields).toEqual([]);
  });

  it('rejects invalid fields', () => {
    const create = (fields: unknown[]) => () => validateFormTemplateCreate({ ...base, fields });
    expect(create([{ label: 'A', type: 'FILE' }])).toThrow(/type must be one of/);
    expect(create([{ label: 'A', type: 'SELECT' }])).toThrow(/options must contain/);
    expect(create([{ label: 'A', type: 'RADIO' }])).toThrow(/options must contain/);
    expect(validateFormTemplateCreate({ ...base, fields: [{ label: 'Tipe', type: 'RADIO', options: ['Rumah', 'Ruko'] }] }).fields?.[0]?.options).toEqual(['Rumah', 'Ruko']);
    expect(create([{ label: 'A', type: 'SELECT', options: ['x', 'X'] }])).toThrow(/options must be unique/);
    expect(create([{ label: 'A', type: 'TEXT', key: 'Bad Key' }])).toThrow(/lowercase letters/);
    expect(create([{ label: 'A', type: 'TEXT' }, { label: 'a', type: 'TEXT' }])).toThrow(/labels must be unique/);
    expect(create(Array.from({ length: 51 }, (_, i) => ({ label: `F${i}`, type: 'TEXT' })))).toThrow(/at most 50/);
  });

  it('rejects invalid template fields', () => {
    expect(() => validateFormTemplateCreate({ ...base, color: 'blue' })).toThrow(/hex color/);
    expect(() => validateFormTemplateCreate({ ...base, icon: 'rocket' })).toThrow(/icon must be one of/);
    expect(() => validateFormTemplateUpdate({ version: 2 })).toThrow(/Unsupported field/);
    expect(() => validateFormTemplateUpdate({ tenantId: 't-2' })).toThrow(/Unsupported field/);
  });

  it('parses filters', () => {
    expect(parseFormTemplateFilters({ search: ' lead ', status: 'active' })).toEqual({ search: 'lead', isActive: true });
    expect(() => parseFormTemplateFilters({ status: 'x' })).toThrow(/active or inactive/);
  });
});
