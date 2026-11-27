import type { Prisma, PrismaClient } from '@prisma/client';

/** Tipe yang boleh dipakai custom field. */
export const FORM_FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'CURRENCY',
  'DATE',
  'SELECT',
  'MULTISELECT',
  'RADIO',
  'BOOLEAN',
  'PHONE',
  'EMAIL',
] as const;

/** Tipe data CRM; hanya untuk field sistem dengan kunci tetap. */
export const RELATION_FIELD_TYPES = [
  'PROJECT',
  'PROJECT_TYPE',
  'LEAD_SOURCE',
  'CAMPAIGN',
  'USER',
  'LEAD_LABEL',
  'GENDER',
  'STAGE',
] as const;

/** Pengelompok field; tidak menyimpan data. */
export const SECTION_TYPE = 'SECTION' as const;

export const ALL_FIELD_TYPES = [...FORM_FIELD_TYPES, ...RELATION_FIELD_TYPES, SECTION_TYPE] as const;
export type FormFieldType = (typeof ALL_FIELD_TYPES)[number];

export type FormField = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: string[] | null;
  /** Field standar/sistem: tipe tetap; posisi, label, dan pengaturan lain dapat diatur. */
  standard?: boolean;
  /** Khusus SECTION. */
  icon?: string | null;
};

type SystemDefinition = {
  label: string;
  type: FormFieldType;
  /** Selalu ada di setiap template dan tidak dapat dihapus. */
  always?: boolean;
  /** Selalu wajib diisi. */
  forceRequired?: boolean;
  /** Bawaan saat ditambahkan. */
  required?: boolean;
  options?: readonly string[];
  /** Hanya boleh ada bila field sistem ini juga ada. */
  requires?: string;
};

/**
 * Katalog field standar/sistem. Tiga kunci pertama tetap tanpa awalan (sudah dipakai template lama);
 * kunci baru memakai awalan agar tidak bentrok dengan kunci custom field yang sudah tersimpan.
 */
export const SYSTEM_FIELDS = {
  name: { label: 'Nama Lengkap', type: 'TEXT', always: true, forceRequired: true },
  phone: { label: 'Nomor HP', type: 'PHONE', always: true, required: true },
  email: { label: 'Email', type: 'EMAIL', always: true },
  lead_source: { label: 'Sumber Lead', type: 'LEAD_SOURCE', always: true, forceRequired: true },
  assigned_sales: { label: 'Assigned Sales', type: 'USER', always: true },
  customer_gender: { label: 'Jenis Kelamin', type: 'GENDER', options: ['Laki-laki', 'Perempuan'] },
  customer_address: { label: 'Alamat', type: 'TEXTAREA' },
  interest_projects: { label: 'Project Diminati', type: 'PROJECT' },
  interest_types: { label: 'Tipe Rumah', type: 'PROJECT_TYPE', requires: 'interest_projects' },
  lead_budget: { label: 'Budget Pembelian', type: 'CURRENCY' },
  lead_notes: { label: 'Catatan Kebutuhan / Preferensi', type: 'TEXTAREA' },
  lead_campaign: { label: 'Campaign', type: 'CAMPAIGN', requires: 'lead_source' },
  /** Beberapa label aktif; maksimal satu Temperature. */
  lead_temperature: { label: 'Status Qualified', type: 'LEAD_LABEL' },
  customer_age: { label: 'Umur', type: 'NUMBER' },
  /** Kosong = tahapan default Lead. */
  lead_stage: { label: 'Tahapan Pipeline', type: 'STAGE' },
} as const satisfies Record<string, SystemDefinition>;

export type SystemFieldKey = keyof typeof SYSTEM_FIELDS;
export const SYSTEM_FIELD_KEYS = Object.keys(SYSTEM_FIELDS) as SystemFieldKey[];

/** Kunci field yang tidak boleh dipakai custom field. */
export const RESERVED_FIELD_KEYS = SYSTEM_FIELD_KEYS;

const definitionOf = (key: SystemFieldKey): SystemDefinition => SYSTEM_FIELDS[key];

/** Bentuk field sistem dengan pengaturan bawaan. */
export function systemField(key: SystemFieldKey): FormField {
  const def = definitionOf(key);
  return {
    key,
    label: def.label,
    type: def.type,
    required: !!(def.forceRequired || def.required),
    placeholder: null,
    helpText: null,
    options: def.options ? [...def.options] : null,
    standard: true,
  };
}

/** Field standar lama (dipertahankan untuk konsumen yang sudah ada). */
export const STANDARD_FIELDS = {
  name: systemField('name'),
  phone: systemField('phone'),
  email: systemField('email'),
};

const LEADING_KEYS: SystemFieldKey[] = ['name', 'phone', 'email'];
const TRAILING_KEYS: SystemFieldKey[] = SYSTEM_FIELD_KEYS.filter(
  (key) => definitionOf(key).always && !LEADING_KEYS.includes(key)
);

const isSystemKey = (key: string | null | undefined): key is SystemFieldKey =>
  !!key && Object.prototype.hasOwnProperty.call(SYSTEM_FIELDS, key);

const isRelationType = (type: string) => (RELATION_FIELD_TYPES as readonly string[]).includes(type);

/** Field selain section (yang menyimpan data). */
export const isDataField = (field: Pick<FormField, 'type'>) => field.type !== SECTION_TYPE;

/** Field dari klien; `key` boleh kosong untuk field baru. */
export type FormFieldInput = Omit<FormField, 'key'> & { key?: string };

export type FormTemplateInput = {
  name?: string;
  description?: string | null;
  icon?: string;
  color?: string;
  isActive?: boolean;
  isDefault?: boolean;
  showDealCreationOption?: boolean;
  fields?: FormFieldInput[];
};

export type FormTemplateFilters = { search?: string; isActive?: boolean; page: number; limit: number };

export type Actor = { tenantId: string; userId: string };

const DEFAULT_GUARD = 'default';
const userSelect = { select: { id: true, name: true } } as const;

/** "Rencana Pembayaran" -> "rencana_pembayaran". */
export function fieldKeyOf(label: string) {
  const key = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  return key || 'field';
}

/**
 * Menyusun daftar field yang disimpan:
 * - Field berkunci sistem: posisi, label, placeholder, teks bantuan, dan wajib mengikuti klien;
 *   tipe dan pilihan tetap dari server. Field yang selalu ada tetapi tidak dikirim ditambahkan
 *   (Nama/HP/Email di awal, Sumber dan Sales di akhir).
 * - Tipe relasi hanya untuk kunci sistemnya.
 * - Section mendapat kunci `section_*`.
 * - Kunci custom field dari klien dipertahankan (agar field yang sama tetap terhubung
 *   antar-versi); kunci baru dibuat dari label dan dibuat unik.
 */
export function assignFieldKeys(fields: FormFieldInput[]): FormField[] {
  const used = new Set<string>(RESERVED_FIELD_KEYS);
  const kept = fields.map((field) => field.key?.trim() || null);
  const systemSeen = new Set<SystemFieldKey>();
  for (const [index, key] of kept.entries()) {
    if (!key) continue;
    if (isSystemKey(key)) {
      if (systemSeen.has(key)) throw new Error(`Invalid field key "${key}": it is duplicated`);
      systemSeen.add(key);
      continue;
    }
    if (used.has(key)) throw new Error(`Invalid field key "${key}": it is reserved or duplicated`);
    if (fields[index]?.type === SECTION_TYPE && !key.startsWith('section_')) {
      throw new Error(`Invalid field key "${key}": section keys must start with section_`);
    }
    used.add(key);
  }
  for (const key of systemSeen) {
    const requires = definitionOf(key).requires as SystemFieldKey | undefined;
    if (requires && !systemSeen.has(requires) && !definitionOf(requires).always) {
      throw new Error(`Invalid fields: ${key} requires ${requires}`);
    }
  }

  const result = fields.map((field, index): FormField => {
    let key = kept[index];
    if (isSystemKey(key)) {
      const base = systemField(key);
      return {
        ...base,
        label: field.label || base.label,
        placeholder: field.placeholder,
        helpText: field.helpText,
        required: definitionOf(key).forceRequired ? true : field.required,
      };
    }
    if (isRelationType(field.type)) {
      throw new Error(`Invalid field type ${field.type}: it is only available for system fields`);
    }
    const isSection = field.type === SECTION_TYPE;
    if (!key) {
      const base = isSection ? `section_${fieldKeyOf(field.label)}`.slice(0, 50) : fieldKeyOf(field.label);
      key = base;
      for (let n = 2; used.has(key); n += 1) key = `${base}_${n}`;
      used.add(key);
    }
    if (isSection) {
      return {
        key,
        label: field.label,
        type: SECTION_TYPE,
        required: false,
        placeholder: null,
        helpText: field.helpText,
        options: null,
        icon: field.icon ?? null,
      };
    }
    return {
      key,
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder,
      helpText: field.helpText,
      options: field.options,
    };
  });
  const leading = LEADING_KEYS.filter((key) => !systemSeen.has(key)).map(systemField);
  const trailing = TRAILING_KEYS.filter((key) => !systemSeen.has(key)).map(systemField);
  return [...leading, ...result, ...trailing];
}

const fieldsOf = (value: Prisma.JsonValue | undefined): FormField[] =>
  Array.isArray(value) ? (value as unknown as FormField[]) : [];

/** Versi lama tanpa field yang selalu ada: ditambahkan di awal (standar) atau akhir (sistem). */
const withStandardFields = (fields: FormField[]): FormField[] => [
  ...LEADING_KEYS.filter((key) => !fields.some((f) => f.key === key)).map(systemField),
  ...fields,
  ...TRAILING_KEYS.filter((key) => !fields.some((f) => f.key === key)).map(systemField),
];

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';

/** Template form Lead milik satu company, dengan field yang disimpan per versi. */
export class LeadFormTemplateUseCase {
  constructor(private prisma: PrismaClient) {}

  private async currentVersions(ids: (string | null)[]) {
    const versionIds = ids.filter((id): id is string => !!id);
    if (versionIds.length === 0) return new Map<string, { version: number; isLocked: boolean; fields: FormField[] }>();
    const versions = await this.prisma.leadFormTemplateVersion.findMany({
      where: { id: { in: versionIds } },
      select: { id: true, version: true, isLocked: true, fields: true },
    });
    return new Map(versions.map((v) => [v.id, { version: v.version, isLocked: v.isLocked, fields: withStandardFields(fieldsOf(v.fields)) }]));
  }

  async list(tenantId: string, filters: FormTemplateFilters) {
    const where: Prisma.LeadFormTemplateWhereInput = { tenantId };
    if (filters.search) where.name = { contains: filters.search };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    const [rows, total] = await Promise.all([
      this.prisma.leadFormTemplate.findMany({
        where,
        include: { updatedBy: userSelect },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.leadFormTemplate.count({ where }),
    ]);
    const versions = await this.currentVersions(rows.map((r) => r.currentVersionId));
    const data = rows.map((row) => {
      const current = row.currentVersionId ? versions.get(row.currentVersionId) : undefined;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        icon: row.icon,
        color: row.color,
        isDefault: row.isDefault,
        isActive: row.isActive,
        showDealCreationOption: row.showDealCreationOption,
        version: current?.version ?? 1,
        // Termasuk field standar/sistem; section tidak dihitung.
        fieldCount: (current?.fields ?? withStandardFields([])).filter(isDataField).length,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      };
    });
    return {
      data,
      meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  private async find(id: string, tenantId: string) {
    const template = await this.prisma.leadFormTemplate.findFirst({
      where: { id, tenantId },
      include: { updatedBy: userSelect },
    });
    if (!template) throw new Error('Form template not found');
    return template;
  }

  async get(id: string, tenantId: string) {
    const template = await this.find(id, tenantId);
    const current = (await this.currentVersions([template.currentVersionId])).get(template.currentVersionId ?? '');
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      icon: template.icon,
      color: template.color,
      isDefault: template.isDefault,
      isActive: template.isActive,
      showDealCreationOption: template.showDealCreationOption,
      version: current?.version ?? 1,
      versionLocked: current?.isLocked ?? false,
      fields: current?.fields ?? [],
      updatedAt: template.updatedAt,
      updatedBy: template.updatedBy,
    };
  }

  /** Nama unik per company; kolasi database tidak membedakan huruf besar/kecil. */
  private async assertUniqueName(tenantId: string, name: string, exceptId?: string) {
    const existing = await this.prisma.leadFormTemplate.findFirst({
      where: { tenantId, name, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new Error(`Form template "${name}" already exists`);
  }

  /** Melepas tanda default dari template lain milik company. */
  private clearDefault(tx: Prisma.TransactionClient, tenantId: string, exceptId?: string) {
    return tx.leadFormTemplate.updateMany({
      where: { tenantId, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isDefault: false, defaultGuard: null },
    });
  }

  async create(actor: Actor, input: FormTemplateInput) {
    const name = input.name as string;
    await this.assertUniqueName(actor.tenantId, name);
    const fields = assignFieldKeys(input.fields ?? []);
    const isDefault = input.isDefault ?? false;
    if (isDefault && input.isActive === false) throw new Error('Default form template must be active (conflict)');

    const created = await this.prisma.$transaction(async (tx) => {
      if (isDefault) await this.clearDefault(tx, actor.tenantId);
      const template = await tx.leadFormTemplate.create({
        data: {
          tenantId: actor.tenantId,
          name,
          description: input.description ?? null,
          icon: input.icon as string,
          color: (input.color as string).toUpperCase(),
          isActive: isDefault ? true : (input.isActive ?? true),
          isDefault,
          showDealCreationOption: input.showDealCreationOption ?? false,
          defaultGuard: isDefault ? DEFAULT_GUARD : null,
          updatedById: actor.userId,
        },
      });
      const version = await tx.leadFormTemplateVersion.create({
        data: {
          tenantId: actor.tenantId,
          templateId: template.id,
          version: 1,
          fields: fields as unknown as Prisma.InputJsonValue,
          createdById: actor.userId,
        },
      });
      await tx.leadFormTemplate.update({ where: { id: template.id }, data: { currentVersionId: version.id } });
      return template;
    });
    return this.get(created.id, actor.tenantId);
  }

  async update(id: string, actor: Actor, input: FormTemplateInput) {
    const template = await this.find(id, actor.tenantId);
    if (input.name !== undefined) await this.assertUniqueName(actor.tenantId, input.name, id);
    if (input.isDefault === false && template.isDefault) {
      throw new Error('Choose another default form template instead of unsetting it (conflict)');
    }
    const willBeDefault = input.isDefault ?? template.isDefault;
    if (willBeDefault && input.isActive === false) {
      throw new Error('Default form template cannot be deactivated (conflict)');
    }
    const fields = input.fields !== undefined ? assignFieldKeys(input.fields) : undefined;

    const data: Prisma.LeadFormTemplateUncheckedUpdateInput = { updatedById: actor.userId };
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.color !== undefined) data.color = input.color.toUpperCase();
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.showDealCreationOption !== undefined) data.showDealCreationOption = input.showDealCreationOption;
    if (input.isDefault && !template.isDefault) {
      data.isDefault = true;
      data.defaultGuard = DEFAULT_GUARD;
      data.isActive = true;
    }

    await this.prisma.$transaction(async (tx) => {
      if (data.isDefault) await this.clearDefault(tx, actor.tenantId, id);
      if (fields) {
        const current = template.currentVersionId
          ? await tx.leadFormTemplateVersion.findFirst({ where: { id: template.currentVersionId } })
          : null;
        if (current && !current.isLocked) {
          // Belum dipakai Lead: snapshot yang sama diperbarui.
          await tx.leadFormTemplateVersion.update({
            where: { id: current.id },
            data: { fields: fields as unknown as Prisma.InputJsonValue },
          });
        } else {
          // Sudah dipakai Lead: versi lama dipertahankan, perubahan menjadi versi baru.
          const last = await tx.leadFormTemplateVersion.findFirst({
            where: { templateId: id },
            orderBy: { version: 'desc' },
            select: { version: true },
          });
          const version = await tx.leadFormTemplateVersion.create({
            data: {
              tenantId: actor.tenantId,
              templateId: id,
              version: (last?.version ?? 0) + 1,
              fields: fields as unknown as Prisma.InputJsonValue,
              createdById: actor.userId,
            },
          });
          data.currentVersionId = version.id;
        }
      }
      await tx.leadFormTemplate.update({ where: { id }, data });
    });
    return this.get(id, actor.tenantId);
  }

  /** Nama salinan yang belum dipakai: "X (Salinan)", "X (Salinan 2)", ... */
  private async copyName(tenantId: string, name: string) {
    const base = `${name} (Salinan`.slice(0, 135);
    const taken = new Set(
      (
        await this.prisma.leadFormTemplate.findMany({
          where: { tenantId, name: { startsWith: base } },
          select: { name: true },
        })
      ).map((t) => t.name.toLowerCase()),
    );
    for (let n = 1; ; n += 1) {
      const candidate = n === 1 ? `${base})` : `${base} ${n})`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  async duplicate(id: string, actor: Actor) {
    const source = await this.get(id, actor.tenantId);
    return this.create(actor, {
      name: await this.copyName(actor.tenantId, source.name),
      description: source.description,
      icon: source.icon,
      color: source.color,
      isActive: true,
      isDefault: false,
      fields: source.fields,
    }).catch((error) => {
      if (isUniqueViolation(error)) throw new Error('Form template copy already exists (conflict)');
      throw error;
    });
  }

  async remove(id: string, tenantId: string) {
    const template = await this.find(id, tenantId);
    if (template.isDefault) throw new Error('The default form template cannot be deleted (conflict)');
    const locked = await this.prisma.leadFormTemplateVersion.count({ where: { templateId: id, isLocked: true } });
    if (locked > 0) {
      throw new Error('Form template is already used by leads and cannot be deleted; deactivate it instead (conflict)');
    }
    await this.prisma.leadFormTemplate.delete({ where: { id } });
  }
}
