import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";

export interface LeadSource {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: string;
  /** Jumlah campaign di bawah source ini. */
  campaignCount: number;
}

export interface LeadSourceList {
  data: LeadSource[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type LeadSourceStatus = "active" | "inactive";

export type LeadSourceFilters = { search?: string; status?: LeadSourceStatus; page: number; limit: number };

export type LeadSourcePayload = { name: string; description: string | null; color: string; isActive: boolean };

const KEY = "lead-sources";

export function useLeadSources(filters: LeadSourceFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.tenantId, filters],
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""));
      return (await api.get<LeadSourceList>("/api/lead-sources", { params })).data;
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
}

/** Sumber aktif untuk seluruh pilihan operasional Leads. */
export function useActiveLeadSources() {
  const query = useLeadSources({ status: "active", page: 1, limit: 100 });
  return { ...query, sources: query.data?.data ?? [] };
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

export function useSaveLeadSource() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: LeadSourcePayload }) =>
      id
        ? (await api.put<LeadSource>(`/api/lead-sources/${id}`, data)).data
        : (await api.post<LeadSource>("/api/lead-sources", data)).data,
    onSuccess: (_source, { id }) => {
      invalidate();
      toast.success(id ? "Leads source diperbarui" : "Leads source ditambahkan");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan leads source.")),
  });
}

export function useDeleteLeadSource() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/lead-sources/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Leads source dihapus");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menghapus leads source.")),
  });
}
