import type { Prisma, PrismaClient } from '@prisma/client';

export const FORM_FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'CURRENCY',
  'DATE',
  'SELECT',
  'MULTISELECT',
  'BOOLEAN',
  'PHONE',
  'EMAIL',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Kunci field standar Lead; tidak boleh dipakai custom field. */
export const RESERVED_FIELD_KEYS = ['name', 'phone', 'email'] as const;

export type FormField = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: string[] | null;
};

/** Field dari klien; `key` boleh kosong untuk field baru. */
export type FormFieldInput = Omit<FormField, 'key'> & { key?: string };

export type FormTemplateInput = {
  name?: string;
  description?: string | null;
  icon?: string;
  color?: string;
  isActive?: boolean;
  isDefault?: boolean;
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
 * Melengkapi `key` setiap field: kunci dari klien dipertahankan (agar field yang
 * sama tetap terhubung antar-versi), kunci baru dibuat dari label dan dibuat unik.
 */
export function assignFieldKeys(fields: FormFieldInput[]): FormField[] {
  const used = new Set<string>(RESERVED_FIELD_KEYS);
  const kept = fields.map((field) => field.key?.trim() || null);
  for (const key of kept) {
    if (!key) continue;
    if (used.has(key)) throw new Error(`Invalid field key "${key}": it is reserved or duplicated`);
    used.add(key);
  }
  return fields.map((field, index) => {
    let key = kept[index];
    if (!key) {
      const base = fieldKeyOf(field.label);
      key = base;
      for (let n = 2; used.has(key); n += 1) key = `${base}_${n}`;
      used.add(key);
    }
    return { ...field, key };
  });
}

const fieldsOf = (value: Prisma.JsonValue | undefined): FormField[] =>
  Array.isArray(value) ? (value as unknown as FormField[]) : [];

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
    return new Map(versions.map((v) => [v.id, { version: v.version, isLocked: v.isLocked, fields: fieldsOf(v.fields) }]));
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
        version: current?.version ?? 1,
        fieldCount: current?.fields.length ?? 0,
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
