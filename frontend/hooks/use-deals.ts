import api from "@/lib/api";
import type { Deal, DealPaymentMethod, DealSummary } from "@/types/deal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type DealFilters = { page?: number; limit?: number; search?: string; stageId?: string; projectId?: string; paymentMethod?: DealPaymentMethod; bankName?: string; assignedUserId?: string; startDate?: string; endDate?: string };
type DealResponse = { data: Deal[]; meta: { total: number; page: number; limit: number; totalPages: number }; summary: DealSummary };
export type DealPayload = { leadId?: string; assignedUserId?: string; stageId?: string; statusId?: string; unitId?: string; expectedAmount?: number; amount?: number; currency?: string; expectedClosingDate?: string | null; paymentMethod: DealPaymentMethod; bankName?: string | null };
const errorMessage = (error: unknown, fallback: string) => {
  const response = error as { response?: { data?: { error?: unknown } } };
  return typeof response.response?.data?.error === "string" ? response.response.data.error : fallback;
};

export function useDeals(filters: DealFilters = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["deals", filters], queryFn: async () => (await api.get<DealResponse>("/api/deal", { params: filters })).data });
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["deals"] }); queryClient.invalidateQueries({ queryKey: ["pipeline-stages"] }); };
  const create = useMutation({ mutationFn: async (data: DealPayload) => (await api.post<Deal>("/api/deal", data)).data, onSuccess: () => { invalidate(); toast.success("Deal berhasil dibuat."); }, onError: (error) => toast.error(errorMessage(error, "Gagal membuat Deal.")) });
  const update = useMutation({ mutationFn: async ({ id, data }: { id: string; data: Partial<DealPayload> }) => (await api.put<Deal>(`/api/deal/${id}`, data)).data, onSuccess: () => { invalidate(); toast.success("Deal berhasil diperbarui."); }, onError: (error) => toast.error(errorMessage(error, "Gagal memperbarui Deal.")) });
  const remove = useMutation({ mutationFn: async (id: string) => { await api.delete(`/api/deal/${id}`); }, onSuccess: () => { invalidate(); toast.success("Deal dihapus permanen."); }, onError: (error) => toast.error(errorMessage(error, "Gagal menghapus Deal.")) });
  return { deals: query.data?.data ?? [], pagination: query.data?.meta, summary: query.data?.summary, isLoading: query.isLoading, isFetching: query.isFetching, createDeal: create.mutateAsync, updateDeal: update.mutateAsync, deleteDeal: remove.mutateAsync, isCreating: create.isPending, isUpdating: update.isPending, isDeleting: remove.isPending };
}
export function useDealDetail(id: string) { return useQuery({ queryKey: ["deal", id], queryFn: async () => (await api.get<Deal>(`/api/deal/${id}`)).data, enabled: !!id }); }
