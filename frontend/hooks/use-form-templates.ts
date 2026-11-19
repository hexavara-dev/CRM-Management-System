import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";

export type FormFieldType =
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

export const FORM_FIELD_TYPES: { value: FormFieldType; label: string }[] = [
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
  /** Field standar (Nama, Nomor HP, Email): tipe tetap, posisi dan pengaturan lain dapat diubah. */
  standard?: boolean;
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
