import type { Prisma, PrismaClient } from '@prisma/client';
import {
  assignFieldKeys,
  isDataField,
  systemField,
  type FormField,
  type FormFieldInput,
  type SystemFieldKey,
} from './LeadFormTemplateUseCase.js';

const section = (label: string, icon: string): FormFieldInput => ({
  label,
  type: 'SECTION',
  required: false,
  placeholder: null,
  helpText: null,
  options: null,
  icon,
});

/** Susunan form Add Lead standar (sama dengan dialog sebelum memakai template). */
export const STANDARD_LEAD_FORM: FormFieldInput[] = [
  section('Informasi Personal', 'user'),
  systemField('name'),
  systemField('customer_gender'),
  systemField('customer_age'),
  section('Informasi Kontak', 'phone'),
  systemField('phone'),
  systemField('email'),
  systemField('customer_address'),
  section('Minat & Kebutuhan', 'home'),
  systemField('interest_projects'),
  systemField('interest_types'),
  systemField('lead_budget'),
  systemField('lead_notes'),
  section('Sumber Lead', 'target'),
  systemField('lead_source'),
  systemField('lead_campaign'),
  section('Penugasan & Pipeline', 'users'),
  systemField('assigned_sales'),
  systemField('lead_stage'),
  systemField('lead_temperature'),
];

const STANDARD_TEMPLATE_NAME = 'Form Lead Standar';

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';

export type Actor = { tenantId: string; userId: string; role?: string | undefined };

export type LeadFormSubmission = {
  /** Versi template yang dipakai form; harus versi terbaru template default. */
  templateVersionId: string;
  /** Isian per kunci field. */
  values: Record<string, unknown>;
};

const MAX_TEXT = 255;
const MAX_LONG_TEXT = 5000;
const MAX_LABELS = 20;
const MAX_AGE = 120;
const MAX_AMOUNT = 999_999_999_999_999;
const PHONE = /^\+?[0-9 ()-]{6,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const fieldsOf = (value: Prisma.JsonValue): FormField[] => (Array.isArray(value) ? (value as unknown as FormField[]) : []);

const isEmpty = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0);

/** Tanggal hari ini (UTC) sebagai DATE untuk periode campaign. */
const today = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

function text(field: FormField, value: unknown, max: number) {
  if (typeof value !== 'string') throw new Error(`${field.label} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`${field.label} must contain at most ${max} characters`);
  return trimmed;
}

function id(field: FormField, value: unknown) {
  if (typeof value !== 'string' || !value || value.length > 36) throw new Error(`${field.label} is invalid`);
  return value;
}

/** Nilai jenis kelamin yang disimpan sama dengan form Lead lama; label opsi juga diterima. */
const GENDER_VALUES: Record<string, 'male' | 'female'> = {
  male: 'male',
  female: 'female',
  'Laki-laki': 'male',
  Perempuan: 'female',
};

function ids(field: FormField, value: unknown) {
  if (!Array.isArray(value)) throw new Error(`${field.label} must be a list`);
  if (value.length > MAX_LABELS) throw new Error(`${field.label} must contain at most ${MAX_LABELS} items`);
  const list = value.map((item) => id(field, item));
  if (new Set(list).size !== list.length) throw new Error(`${field.label} must not contain duplicates`);
  return list;
}

function amount(field: FormField, value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_AMOUNT) {
    throw new Error(`${field.label} must be a whole number of at least 0`);
  }
  return value;
}

/** Nilai custom field sesuai tipenya; disimpan apa adanya di `custom_values`. */
function customValue(field: FormField, value: unknown): unknown {
  switch (field.type) {
    case 'TEXT':
      return text(field, value, MAX_TEXT);
    case 'TEXTAREA':
      return text(field, value, MAX_LONG_TEXT);
    case 'NUMBER':
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field.label} must be a number`);
      return value;
    case 'CURRENCY':
      return amount(field, value);
    case 'DATE': {
      const date = text(field, value, 10);
      const parsed = new Date(`${date}T00:00:00.000Z`);
      if (!DATE.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        throw new Error(`${field.label} must be a valid date in YYYY-MM-DD format`);
      }
      return date;
    }
    case 'SELECT':
    case 'RADIO': {
      const choice = text(field, value, 100);
      if (!field.options?.includes(choice)) throw new Error(`${field.label} must be one of the available options`);
      return choice;
    }
    case 'MULTISELECT': {
      if (!Array.isArray(value)) throw new Error(`${field.label} must be a list`);
      const choices = value.map((item) => text(field, item, 100));
      if (choices.some((choice) => !field.options?.includes(choice)) || new Set(choices).size !== choices.length) {
        throw new Error(`${field.label} must contain available options only`);
      }
      return choices;
    }
    case 'BOOLEAN':
      if (typeof value !== 'boolean') throw new Error(`${field.label} must be true or false`);
      return value;
    case 'PHONE': {
      const phone = text(field, value, 30);
      if (!PHONE.test(phone)) throw new Error(`${field.label} must be a valid phone number`);
      return phone;
    }
    case 'EMAIL': {
      const email = text(field, value, MAX_TEXT);
      if (!EMAIL.test(email)) throw new Error(`${field.label} must be a valid email address`);
      return email;
    }
    default:
      throw new Error(`${field.label} has an unsupported type`);
  }
}

/** Menyimpan Lead baru dari form Add Lead sesuai template default company. */
export class LeadFormSubmissionUseCase {
  constructor(private prisma: PrismaClient) {}

  /**
   * Company yang belum memiliki template sama sekali mendapat template standar sebagai default,
   * agar Add Lead langsung dapat dipakai. Company yang sudah memiliki template tidak diubah.
   */
  private async createStandardTemplate(tenantId: string, userId: string) {
    if ((await this.prisma.leadFormTemplate.count({ where: { tenantId } })) > 0) return;
    const fields = assignFieldKeys(STANDARD_LEAD_FORM);
    try {
      await this.prisma.$transaction(async (tx) => {
        const template = await tx.leadFormTemplate.create({
          data: {
            tenantId,
            name: STANDARD_TEMPLATE_NAME,
            description: 'Dibuat otomatis dari susunan form Add Lead standar.',
            icon: 'user',
            color: '#0B63F6',
            isActive: true,
            isDefault: true,
            defaultGuard: 'default',
            updatedById: userId,
          },
        });
        const version = await tx.leadFormTemplateVersion.create({
          data: { tenantId, templateId: template.id, version: 1, fields: fields as unknown as Prisma.InputJsonValue, createdById: userId },
        });
        await tx.leadFormTemplate.update({ where: { id: template.id }, data: { currentVersionId: version.id } });
      });
    } catch (error) {
      // Permintaan bersamaan sudah membuatnya.
      if (!isUniqueViolation(error)) throw error;
    }
  }

  private findDefaultTemplate(tenantId: string) {
    return this.prisma.leadFormTemplate.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
      select: { id: true, name: true, currentVersionId: true },
    });
  }

  /** Template default beserta versi terbarunya; dipakai form Add Lead. */
  async defaultForm(tenantId: string, userId?: string) {
    let template = await this.findDefaultTemplate(tenantId);
    if (!template && userId) {
      await this.createStandardTemplate(tenantId, userId);
      template = await this.findDefaultTemplate(tenantId);
    }
    if (!template?.currentVersionId) throw new Error('Default form template not found');
    const version = await this.prisma.leadFormTemplateVersion.findFirst({
      where: { id: template.currentVersionId, tenantId },
      select: { id: true, version: true, fields: true },
    });
    if (!version) throw new Error('Default form template not found');
    const stored = fieldsOf(version.fields);
    const missing = (keys: SystemFieldKey[]) => keys.filter((key) => !stored.some((f) => f.key === key)).map(systemField);
    // Versi lama tanpa field yang selalu ada: ditambahkan seperti saat dibaca di editor.
    const fields = [...missing(['name', 'phone', 'email']), ...stored, ...missing(['lead_source', 'assigned_sales'])];
    return { templateId: template.id, name: template.name, versionId: version.id, version: version.version, fields };
  }

  async submit(actor: Actor, input: LeadFormSubmission) {
    const form = await this.defaultForm(actor.tenantId);
    if (form.versionId !== input.templateVersionId) {
      throw new Error('The lead form has changed; reload the form and try again (conflict)');
    }
    const fields = form.fields.filter(isDataField);
    const known = new Set(fields.map((f) => f.key));
    const unknown = Object.keys(input.values).filter((key) => !known.has(key));
    if (unknown.length) throw new Error(`Unsupported field(s): ${unknown.join(', ')}`);

    const system: Partial<Record<SystemFieldKey, unknown>> = {};
    const customValues: Record<string, unknown> = {};
    for (const field of fields) {
      const value = input.values[field.key];
      if (isEmpty(value)) {
        if (field.required && field.key !== 'assigned_sales') throw new Error(`${field.label} is required`);
        continue;
      }
      if (field.standard) system[field.key as SystemFieldKey] = value;
      else customValues[field.key] = customValue(field, value);
    }
    const byKey = new Map(fields.map((f) => [f.key, f]));
    const f = (key: SystemFieldKey) => byKey.get(key) ?? systemField(key);

    // ---- field sistem: bentuk dasar ----
    const name = text(f('name'), system.name, 150);
    if (!name) throw new Error(`${f('name').label} is required`);
    const phone = system.phone !== undefined ? text(f('phone'), system.phone, 30) : null;
    if (phone && !PHONE.test(phone)) throw new Error(`${f('phone').label} must be a valid phone number`);
    const email = system.email !== undefined ? text(f('email'), system.email, MAX_TEXT) : null;
    if (email && !EMAIL.test(email)) throw new Error(`${f('email').label} must be a valid email address`);
    const sourceId = id(f('lead_source'), system.lead_source);
    // Non-owner hanya dapat membuat Lead untuk dirinya sendiri (sama seperti form Lead lama).
    const isOwner = actor.role === 'owner';
    const salesId =
      isOwner && system.assigned_sales !== undefined ? id(f('assigned_sales'), system.assigned_sales) : actor.userId;
    let gender: 'male' | 'female' | null = null;
    if (system.customer_gender !== undefined) {
      gender = GENDER_VALUES[text(f('customer_gender'), system.customer_gender, 20)] ?? null;
      if (!gender) throw new Error(`${f('customer_gender').label} must be one of the available options`);
    }
    let age: number | null = null;
    if (system.customer_age !== undefined) {
      const raw = system.customer_age;
      if (typeof raw !== 'number' || !Number.isInteger(raw)) throw new Error(`${f('customer_age').label} must be a whole number`);
      if (raw < 0 || raw > MAX_AGE) {
        throw new Error(`${f('customer_age').label} must be a whole number between 0 and ${MAX_AGE}`);
      }
      age = raw;
    }
    const address = system.customer_address !== undefined ? text(f('customer_address'), system.customer_address, 500) : null;
    // Satu Lead memiliki satu project dan (opsional) satu tipe rumah dari project itu.
    const projectId = system.interest_projects !== undefined ? id(f('interest_projects'), system.interest_projects) : null;
    const typeId = system.interest_types !== undefined ? id(f('interest_types'), system.interest_types) : null;
    if (typeId && !projectId) {
      throw new Error(`${f('interest_types').label} is invalid without ${f('interest_projects').label}`);
    }
    const budget = system.lead_budget !== undefined ? amount(f('lead_budget'), system.lead_budget) : null;
    const needsNotes = system.lead_notes !== undefined ? text(f('lead_notes'), system.lead_notes, MAX_LONG_TEXT) || null : null;
    const campaignId = system.lead_campaign !== undefined ? id(f('lead_campaign'), system.lead_campaign) : null;
    const stageId = system.lead_stage !== undefined ? id(f('lead_stage'), system.lead_stage) : null;
    const labelIds = system.lead_temperature !== undefined ? ids(f('lead_temperature'), system.lead_temperature) : [];

    // ---- relasi: harus milik company yang sama dan masih dapat dipilih ----
    const tenantId = actor.tenantId;
    const day = today();
    const [source, sales, campaign, labels, project, type, stage] = await Promise.all([
      this.prisma.source.findFirst({ where: { id: sourceId, tenantId, type: 'lead', isActive: true }, select: { id: true } }),
      this.prisma.user.findFirst({ where: { id: salesId, tenantId }, select: { id: true } }),
      campaignId
        ? this.prisma.leadCampaign.findFirst({
            where: {
              id: campaignId,
              tenantId,
              sourceId,
              isActive: true,
              AND: [
                { OR: [{ startDate: null }, { startDate: { lte: day } }] },
                { OR: [{ endDate: null }, { endDate: { gte: day } }] },
              ],
            },
            select: { id: true },
          })
        : null,
      labelIds.length
        ? this.prisma.leadLabel.findMany({
            where: { id: { in: labelIds }, tenantId, isActive: true },
            select: { id: true, type: true },
          })
        : [],
      projectId
        ? this.prisma.product.findFirst({ where: { id: projectId, tenantId, isActive: true }, select: { id: true } })
        : null,
      typeId && projectId
        ? this.prisma.productVariant.findFirst({
            where: { id: typeId, tenantId, productId: projectId },
            select: { id: true, productId: true },
          })
        : null,
      // Tahapan yang dipilih, atau tahapan default bila kosong (sama seperti form Lead lama).
      stageId
        ? this.prisma.stage.findFirst({ where: { id: stageId, tenantId, entityType: 'lead', isActive: true }, select: { id: true } })
        : this.prisma.stage.findFirst({
            where: { tenantId, entityType: 'lead', isDefaultStage: true, isActive: true },
            select: { id: true },
          }),
    ]);
    if (!source) throw new Error(`${f('lead_source').label} not found`);
    if (!sales) throw new Error(`${f('assigned_sales').label} not found`);
    if (campaignId && !campaign) throw new Error(`${f('lead_campaign').label} is invalid for the selected lead source`);
    if (labels.length !== labelIds.length) throw new Error(`${f('lead_temperature').label} not found`);
    if (labels.filter((label) => label.type === 'TEMPERATURE').length > 1) {
      throw new Error(`${f('lead_temperature').label} must be limited to one Temperature label`);
    }
    if (projectId && !project) throw new Error(`${f('interest_projects').label} not found`);
    if (typeId && !type) throw new Error(`${f('interest_types').label} must belong to the selected project`);
    if (stageId && !stage) throw new Error(`${f('lead_stage').label} not found`);

    const lead = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: { tenantId, firstName: name, phoneNumber: phone, email, gender, age, location: address },
        select: { id: true },
      });
      const created = await tx.lead.create({
        data: {
          tenantId,
          customerId: customer.id,
          assignedUserId: sales.id,
          sourceUserId: actor.userId,
          sourceId: source.id,
          stageId: stage?.id ?? null,
          campaignId: campaign?.id ?? null,
          // Kolom yang dibaca list, filter, pipeline, detail, dan pembuatan Deal.
          projectId: project?.id ?? null,
          productVariantId: type?.id ?? null,
          ...(labelIds.length
            ? { labelAssignments: { create: labelIds.map((labelId) => ({ tenantId, labelId })) } }
            : {}),
          budget: budget === null ? null : BigInt(budget),
          needsNotes,
          formTemplateVersionId: form.versionId,
          customValues: customValues as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      if (project) {
        // Menjaga penanda "project/tipe dipakai Lead" yang dicek saat menghapus project atau tipe.
        await tx.leadInterest.createMany({
          data: [{ productId: project.id, variantId: type?.id ?? null, tenantId, leadId: created.id }],
        });
      }
      // Catatan disimpan seperti form Lead lama: tampil di kartu "Catatan Terakhir" detail Lead.
      await tx.leadActivity.create({
        data: {
          tenantId,
          leadId: created.id,
          customerId: customer.id,
          actorId: actor.userId,
          activityType: 'registration',
          ...(needsNotes ? { notes: { create: { tenantId, content: needsNotes } } } : {}),
        },
      });
      // Versi sudah dipakai Lead: perubahan field berikutnya membuat versi baru.
      await tx.leadFormTemplateVersion.updateMany({
        where: { id: form.versionId, tenantId, isLocked: false },
        data: { isLocked: true },
      });
      return created;
    });
    return { id: lead.id };
  }
}
