import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";

export type LeadLabelType = "TEMPERATURE" | "TAG";

export interface LeadLabel {
  id: string;
  type: LeadLabelType;
  name: string;
  color: string;
  icon: string;
  description: string | null;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface LeadLabelList {
  data: LeadLabel[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  counts: Record<LeadLabelType, number>;
}

export type LeadLabelPayload = {
  name: string;
  color: string;
  icon: string;
  description: string | null;
  isActive: boolean;
  isRequired?: boolean;
};

const KEY = "lead-labels";

export function useLeadLabels(type: LeadLabelType, page: number, limit: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.tenantId, type, page, limit],
    queryFn: async () =>
      (await api.get<LeadLabelList>("/api/lead-labels", { params: { type, page, limit } })).data,
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

export function useSaveLeadLabel() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, type, data }: { id?: string; type: LeadLabelType; data: LeadLabelPayload }) =>
      id
        ? (await api.put<LeadLabel>(`/api/lead-labels/${id}`, data)).data
        : (await api.post<LeadLabel>("/api/lead-labels", { ...data, type })).data,
    onSuccess: (_label, { id }) => {
      invalidate();
      toast.success(id ? "Label diperbarui" : "Label ditambahkan");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan label.")),
  });
}

/** Mengubah satu field tanpa membuka modal, mis. toggle Wajib Diisi. */
export function useToggleLeadLabel() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, isRequired }: { id: string; isRequired: boolean }) =>
      (await api.put<LeadLabel>(`/api/lead-labels/${id}`, { isRequired })).data,
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorMessage(error, "Gagal mengubah label.")),
  });
}

export function useDeleteLeadLabel() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/lead-labels/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Label dihapus");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menghapus label.")),
  });
}
