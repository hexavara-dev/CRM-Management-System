import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import { LEAD_LABEL_ICONS } from '../../../usecases/crm/leadLabelIcons.js';
import {
  FORM_FIELD_TYPES,
  type FormFieldInput,
  type FormTemplateInput,
} from '../../../usecases/crm/LeadFormTemplateUseCase.js';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const KEY = /^[a-z0-9_]{1,50}$/;
const MAX_FIELDS = 50;
const MAX_OPTIONS = 50;
const CHOICE_TYPES = new Set(['SELECT', 'MULTISELECT', 'RADIO']);

const templateRules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 150 },
  description: { type: 'string', nullable: true, allowEmpty: true, max: 500 },
  icon: { type: 'string', required: true, values: LEAD_LABEL_ICONS },
  color: { type: 'string', required: true, max: 7 },
  isActive: { type: 'boolean' },
  isDefault: { type: 'boolean' },
  fields: { type: 'array' },
};

const fieldRules: Record<string, FieldRule> = {
  key: { type: 'string', allowEmpty: true, max: 50 },
  label: { type: 'string', required: true, max: 100 },
  type: { type: 'string', required: true, values: FORM_FIELD_TYPES },
  required: { type: 'boolean' },
  placeholder: { type: 'string', nullable: true, allowEmpty: true, max: 200 },
  helpText: { type: 'string', nullable: true, allowEmpty: true, max: 200 },
  options: { type: 'array', nullable: true },
};

const optional = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function validateField(item: unknown, index: number): FormFieldInput {
  const data = validateBody(item, fieldRules) as Record<string, unknown>;
  const label = (data.label as string).trim();
  if (!label) throw new Error(`fields[${index}].label is required`);
  const key = typeof data.key === 'string' && data.key.trim() ? data.key.trim() : undefined;
  if (key !== undefined && !KEY.test(key)) {
    throw new Error(`fields[${index}].key must contain only lowercase letters, numbers, and underscores`);
  }
  const type = data.type as FormFieldInput['type'];

  let options: string[] | null = null;
  if (CHOICE_TYPES.has(type)) {
    const raw = Array.isArray(data.options) ? data.options : [];
    if (raw.length === 0 || raw.length > MAX_OPTIONS) {
      throw new Error(`fields[${index}].options must contain 1 to ${MAX_OPTIONS} items`);
    }
    options = raw.map((option) => {
      if (typeof option !== 'string' || !option.trim() || option.trim().length > 100) {
        throw new Error(`fields[${index}].options must be text of 1 to 100 characters`);
      }
      return option.trim();
    });
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
      throw new Error(`fields[${index}].options must be unique`);
    }
  }

  return {
    ...(key ? { key } : {}),
    label,
    type,
    required: (data.required as boolean | undefined) ?? false,
    placeholder: optional(data.placeholder),
    helpText: optional(data.helpText),
    options,
  };
}

function validateFields(value: unknown[]): FormFieldInput[] {
  if (value.length > MAX_FIELDS) throw new Error(`fields must contain at most ${MAX_FIELDS} items`);
  const fields = value.map(validateField);
  const labels = fields.map((f) => f.label.toLowerCase());
  if (new Set(labels).size !== labels.length) throw new Error('field labels must be unique within a template');
  return fields;
}

function finish(data: FormTemplateInput & { fields?: unknown }): FormTemplateInput {
  if (data.color !== undefined && !HEX_COLOR.test(data.color)) {
    throw new Error('color must be a hex color such as #3B82F6');
  }
  if (typeof data.name === 'string') data.name = data.name.trim();
  if (typeof data.description === 'string') data.description = data.description.trim() || null;
  if (data.fields !== undefined) data.fields = validateFields(data.fields as unknown[]);
  return data as FormTemplateInput;
}

export function validateFormTemplateCreate(body: unknown): FormTemplateInput {
  const data = finish(validateBody(body, templateRules) as FormTemplateInput);
  return { ...data, fields: data.fields ?? [] };
}

export function validateFormTemplateUpdate(body: unknown): FormTemplateInput {
  return finish(validateBody(body, templateRules, { partial: true }) as FormTemplateInput);
}

export function parseFormTemplateFilters(query: Record<string, unknown>) {
  const filters: { search?: string; isActive?: boolean } = {};
  if (typeof query.search === 'string' && query.search.trim()) filters.search = query.search.trim().slice(0, 150);
  if (query.status !== undefined && query.status !== '') {
    if (query.status !== 'active' && query.status !== 'inactive') {
      throw new Error('status must be active or inactive');
    }
    filters.isActive = query.status === 'active';
  }
  return filters;
}
