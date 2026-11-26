import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import type { FormField } from "@/hooks/use-form-templates";

/** Template default company beserta versi terbarunya (GET /api/lead-form). */
export interface LeadFormDefinition {
  templateId: string;
  name: string;
  versionId: string;
  version: number;
  fields: FormField[];
}

export type LeadFormSubmission = {
  templateVersionId: string;
  values: Record<string, unknown>;
};

const KEY = "lead-form";

/** Form Add Lead; selalu dimuat ulang saat dialog dibuka agar mengikuti template terbaru. */
export function useLeadForm(enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.tenantId],
    queryFn: async () => (await api.get<LeadFormDefinition>("/api/lead-form")).data,
    enabled: !!user && enabled,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useSubmitLeadForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LeadFormSubmission) =>
      (await api.post<{ id: string }>("/api/lead-form/submissions", payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      // Versi template terkunci setelah dipakai Lead.
      queryClient.invalidateQueries({ queryKey: ["form-templates"] });
      toast.success("Lead berhasil ditambahkan");
    },
  });
}
