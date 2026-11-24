import api from "@/lib/api";
import type { Deal, DealPaymentMethod, DealSummary } from "@/types/deal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type DealFilters = {
  page?: number;
  limit?: number;
  search?: string;
  stageId?: string;
  projectId?: string;
  paymentMethod?: DealPaymentMethod;
  bankName?: string;
  assignedUserId?: string;
  startDate?: string;
  endDate?: string;
};
type DealResponse = {
  data: Deal[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  summary: DealSummary;
};
export type DealPayload = {
  leadId?: string;
  assignedUserId?: string;
  stageId?: string;
  statusId?: string;
  unitId?: string;
  expectedAmount?: number;
  amount?: number;
  currency?: string;
  expectedClosingDate?: string | null;
  paymentMethod?: DealPaymentMethod;
  bankName?: string | null;
  notes?: string | null;
  financingBankId?: string | null;
};
export type DealUnitOption = {
  id: string;
  code: string;
  status: string;
  variant: { id: string; name: string; currentPrice: number };
  typeVariant: { id: string; name: string; currentPrice: number };
};
const errorMessage = (error: unknown, fallback: string) => {
  const response = error as { response?: { data?: { error?: unknown } } };
  return typeof response.response?.data?.error === "string"
    ? response.response.data.error
    : fallback;
};

export function useDeals(filters: DealFilters = {}, enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["deals", filters],
    queryFn: async () =>
      (await api.get<DealResponse>("/api/deal", { params: filters })).data,
    enabled,
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["deals"] });
    queryClient.invalidateQueries({ queryKey: ["pipeline-stages"] });
  };
  const update = useMutation({
    mutationFn: async ({
      id,
      data,
    }: { id: string; data: Partial<DealPayload> }) =>
      (await api.put<Deal>(`/api/deal/${id}`, data)).data,
    onSuccess: (_, variables) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["deal", variables.id] });
      toast.success("Deal berhasil diperbarui.");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Gagal memperbarui Deal.")),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/deal/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Deal dihapus permanen.");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Gagal menghapus Deal.")),
  });
  return {
    deals: query.data?.data ?? [],
    pagination: query.data?.meta,
    summary: query.data?.summary,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    isError: query.isError,
    updateDeal: update.mutateAsync,
    deleteDeal: remove.mutateAsync,
    isUpdating: update.isPending,
    isDeleting: remove.isPending,
  };
}
export function useDealDetail(id: string) {
  return useQuery({
    queryKey: ["deal", id],
    queryFn: async () => (await api.get<Deal>(`/api/deal/${id}`)).data,
    enabled: !!id,
  });
}

export function useDealUnits(projectId?: string | null) {
  return useQuery({
    queryKey: ["deal-units", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const params = { page: 1, limit: 100, productId: projectId };
      const first = (
        await api.get<{ data: DealUnitOption[]; meta: { totalPages: number } }>(
          "/api/units",
          { params },
        )
      ).data;
      if (first.meta.totalPages <= 1) return first.data;
      const rest = await Promise.all(
        Array.from({ length: first.meta.totalPages - 1 }, (_, index) =>
          api.get<{ data: DealUnitOption[] }>("/api/units", {
            params: { ...params, page: index + 2 },
          }),
        ),
      );
      return [...first.data, ...rest.flatMap((response) => response.data.data)];
    },
    enabled: !!projectId,
  });
}
