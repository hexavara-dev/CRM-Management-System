import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";

/** Tipe yang boleh dipakai custom field. */
export type CustomFieldType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "CURRENCY"
  | "DATE"
  | "SELECT"
  | "MULTISELECT"
  | "RADIO"
  | "BOOLEAN"
  | "PHONE"
  | "EMAIL";

/** Tipe data CRM; hanya untuk field sistem. */
export type RelationFieldType =
  | "PROJECT"
  | "PROJECT_TYPE"
  | "LEAD_SOURCE"
  | "CAMPAIGN"
  | "USER"
  | "LEAD_LABEL"
  | "GENDER"
  | "STAGE";

export type FormFieldType = CustomFieldType | RelationFieldType | "SECTION";

export const FORM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "TEXT", label: "Teks singkat" },
  { value: "TEXTAREA", label: "Teks panjang" },
  { value: "NUMBER", label: "Angka" },
  { value: "CURRENCY", label: "Rupiah" },
  { value: "DATE", label: "Tanggal" },
  { value: "SELECT", label: "Dropdown" },
  { value: "RADIO", label: "Pilihan ganda" },
  { value: "MULTISELECT", label: "Checkbox" },
  { value: "BOOLEAN", label: "Ya / Tidak" },
  { value: "PHONE", label: "Nomor telepon" },
  { value: "EMAIL", label: "Email" },
];

export const CHOICE_TYPES: FormFieldType[] = ["SELECT", "MULTISELECT", "RADIO"];

export interface FormField {
  key?: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: string[] | null;
  /** Field standar/sistem: tipe tetap, posisi dan pengaturan lain dapat diubah. */
  standard?: boolean;
  /** Khusus SECTION. */
  icon?: string | null;
}

export type SystemFieldDefinition = {
  label: string;
  type: FormFieldType;
  /** Selalu ada dan tidak dapat dihapus. */
  always?: boolean;
  /** Selalu wajib diisi. */
  forceRequired?: boolean;
  /** Bawaan saat ditambahkan. */
  required?: boolean;
  options?: string[];
  /** Hanya dapat ditambahkan bila field sistem ini ada. */
  requires?: string;
  /** Asal datanya, untuk keterangan di editor. */
  source: string;
};

/** Sama dengan SYSTEM_FIELDS di backend. */
export const SYSTEM_FIELDS = {
  name: { label: "Nama Lengkap", type: "TEXT", always: true, forceRequired: true, source: "Data customer" },
  phone: { label: "Nomor HP", type: "PHONE", always: true, required: true, source: "Data customer" },
  email: { label: "Email", type: "EMAIL", always: true, source: "Data customer" },
  lead_source: { label: "Sumber Lead", type: "LEAD_SOURCE", always: true, forceRequired: true, source: "Konfigurasi Leads Source" },
  assigned_sales: { label: "Assigned Sales", type: "USER", always: true, source: "Daftar tim (kosong = pembuat Lead)" },
  customer_gender: { label: "Jenis Kelamin", type: "GENDER", options: ["Laki-laki", "Perempuan"], source: "Data customer" },
  customer_address: { label: "Alamat", type: "TEXTAREA", source: "Data customer" },
  interest_projects: { label: "Project Diminati", type: "PROJECT", source: "Product Management (satu project per Lead)" },
  interest_types: { label: "Tipe Rumah", type: "PROJECT_TYPE", requires: "interest_projects", source: "Tipe dari project yang dipilih" },
  lead_budget: { label: "Budget Pembelian", type: "CURRENCY", source: "Data Lead" },
  lead_notes: { label: "Catatan Kebutuhan / Preferensi", type: "TEXTAREA", source: "Data Lead" },
  lead_campaign: { label: "Campaign", type: "CAMPAIGN", requires: "lead_source", source: "Campaign dari sumber lead yang dipilih" },
  lead_temperature: {
    label: "Status Qualified",
    type: "LEAD_LABEL",
    source: "Leads Label (bisa lebih dari satu; maksimal satu Temperature)",
  },
  customer_age: { label: "Umur", type: "NUMBER", source: "Data customer" },
  lead_stage: { label: "Tahapan Pipeline", type: "STAGE", source: "Pipeline Leads (kosong = tahapan default)" },
} satisfies Record<string, SystemFieldDefinition>;

export type SystemFieldKey = keyof typeof SYSTEM_FIELDS;
export const SYSTEM_FIELD_KEYS = Object.keys(SYSTEM_FIELDS) as SystemFieldKey[];

export const isSystemKey = (key: string | undefined | null): key is SystemFieldKey =>
  !!key && Object.prototype.hasOwnProperty.call(SYSTEM_FIELDS, key);

export const systemDefinition = (key: SystemFieldKey): SystemFieldDefinition => SYSTEM_FIELDS[key];

/** Field sistem dengan pengaturan bawaan. */
export function systemField(key: SystemFieldKey): FormField {
  const def = systemDefinition(key);
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

type UserRef = { id: string; name: string | null } | null;

export interface FormTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  showDealCreationOption: boolean;
  version: number;
  fieldCount: number;
  updatedAt: string;
  updatedBy: UserRef;
}

export interface FormTemplate extends Omit<FormTemplateSummary, "fieldCount"> {
  versionLocked: boolean;
  fields: FormField[];
}

export interface FormTemplateList {
  data: FormTemplateSummary[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type FormTemplateStatus = "active" | "inactive";
export type FormTemplateFilters = { search?: string; status?: FormTemplateStatus; page: number; limit: number };

export type FormTemplatePayload = {
  name: string;
  description: string | null;
  icon: string;
  color: string;
  isActive: boolean;
  isDefault: boolean;
  showDealCreationOption: boolean;
  fields: FormField[];
};

const KEY = "form-templates";

export function useFormTemplates(filters: FormTemplateFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.tenantId, "list", filters],
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""));
      return (await api.get<FormTemplateList>("/api/lead-form-templates", { params })).data;
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
}

export function useFormTemplate(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.tenantId, "detail", id],
    queryFn: async () => (await api.get<FormTemplate>(`/api/lead-form-templates/${id}`)).data,
    enabled: !!user && !!id,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

export function useSaveFormTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: FormTemplatePayload }) =>
      id
        ? (await api.put<FormTemplate>(`/api/lead-form-templates/${id}`, data)).data
        : (await api.post<FormTemplate>("/api/lead-form-templates", data)).data,
    onSuccess: (_template, { id }) => {
      invalidate();
      toast.success(id ? "Template diperbarui" : "Template ditambahkan");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan template.")),
  });
}

export function useDuplicateFormTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<FormTemplate>(`/api/lead-form-templates/${id}/duplicate`)).data,
    onSuccess: (template) => {
      invalidate();
      toast.success(`Template disalin sebagai "${template.name}"`);
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyalin template.")),
  });
}

export function useDeleteFormTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/lead-form-templates/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Template dihapus");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menghapus template.")),
  });
}
