import api from "@/lib/api";
import { DealFormData } from "@/schemas/deal.schema";
import { PaginatedResponse } from "@/types/api";
import { Deal } from "@/types/deal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function normalizeCollection<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  const data = (payload as { data?: unknown } | undefined)?.data;
  if (Array.isArray(data)) return data as T[];

  const nestedData = (data as { data?: unknown } | undefined)?.data;
  if (Array.isArray(nestedData)) return nestedData as T[];

  const dataPerPage = (data as { data_per_page?: unknown } | undefined)
    ?.data_per_page;
  if (Array.isArray(dataPerPage)) return dataPerPage as T[];

  return [];
}

type ConvertDealPayload = {
  tenantId?: string;
  leadId?: string;
  assignedUserId?: string;
  expectedAmount?: number;
  amount?: number;
  currency?: string;
};

type UseDealsOptions = {
  page?: number;
  limit?: number;
  useServerPagination?: boolean;
  additionalParams?: Record<string, unknown>;
  getAll?: boolean;
};

export function useDeals(options: UseDealsOptions = {}) {
  const {
    page,
    limit,
    useServerPagination,
    additionalParams,
    getAll = false,
  } = options;
  const queryClient = useQueryClient();

  const queryParams = {
    ...(additionalParams ?? {}),
    ...(useServerPagination &&
    typeof page === "number" &&
    typeof limit === "number"
      ? { page, limit }
      : {}),
  };

  const dealsQuery = useQuery<PaginatedResponse<Deal[]>>({
    queryKey: ["deals", { page, limit, useServerPagination, additionalParams }],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Deal[]>>("/api/deal", {
        params: queryParams,
      });
      return response.data;
    },
    enabled: getAll || useServerPagination === true,
  });

  const createDealMutation = useMutation<Deal, unknown, ConvertDealPayload>({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        expectedAmount: data.expectedAmount ?? data.amount,
      };

      const response = await api.post<Deal>("/api/deal", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal created successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to create deal");
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<DealFormData>;
    }) => {
      const { expectedClosingDate, ...rest } = data;
      const processedData = {
        ...rest,
        ...(expectedClosingDate !== undefined && {
          expectedClosingDate:
            expectedClosingDate.trim() !== ""
              ? new Date(expectedClosingDate).toISOString()
              : null,
        }),
      };
      const response = await api.put<Deal>(`/api/deal/${id}`, processedData);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deal", variables.id] });
      toast.success("Deal updated successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to update deal");
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/deal/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal deleted successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to delete deal");
    },
  });

  return {
    deals: normalizeCollection<Deal>(dealsQuery.data),
    pagination: dealsQuery.data?.meta ?? null,
    isLoading: dealsQuery.isLoading,
    isFetching: dealsQuery.isFetching,
    isSuccess: dealsQuery.isSuccess,
    isError: dealsQuery.isError,
    createDeal: createDealMutation.mutateAsync,
    updateDeal: updateDealMutation.mutateAsync,
    deleteDeal: deleteDealMutation.mutateAsync,
    isCreating: createDealMutation.isPending,
    isUpdating: updateDealMutation.isPending,
    isDeleting: deleteDealMutation.isPending,
  };
}

export function useDealDetail(id: string) {
  return useQuery({
    queryKey: ["deal", id],
    queryFn: async () => {
      const response = await api.get<Deal>(`/api/deal/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}
