import api from "@/lib/api";
import { LeadFormData } from "@/schemas/lead.schema";
import { Lead } from "@/types/lead";
import { useAuth } from "@/components/auth/auth-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PaginatedResponse } from "@/types/api";

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

type UseLeadsOptions = {
  page?: number;
  limit?: number;
  useServerPagination?: boolean;
  additionalParams?: Record<string, unknown>;
  getAll?: boolean;
};

export function useLeads(options: UseLeadsOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = user?.tenantId;
  const {
    page,
    limit,
    useServerPagination = false,
    additionalParams,
    getAll = false,
  } = options;

  const queryParams = {
    ...(additionalParams ?? {}),
    ...(useServerPagination &&
    typeof page === "number" &&
    typeof limit === "number"
      ? { page, limit }
      : {}),
  };

  const leadsQuery = useQuery<PaginatedResponse<Lead[]>>({
    queryKey: [
      "leads",
      {
        page,
        limit,
        useServerPagination,
        additionalParams: additionalParams ?? {},
      },
    ],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Lead[]>>(`/api/lead`, {
        params: queryParams,
      });
      const totalPages = response.data.meta?.totalPages;
      if (
        useServerPagination &&
        typeof page === "number" &&
        typeof limit === "number" &&
        typeof totalPages === "number" &&
        page > Math.max(totalPages, 1)
      ) {
        const correctedPage = Math.max(totalPages, 1);
        const correctedResponse = await api.get<PaginatedResponse<Lead[]>>(
          "/api/lead",
          { params: { ...queryParams, page: correctedPage } },
        );
        return correctedResponse.data;
      }
      return response.data;
    },
    enabled: getAll,
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      if (!tenantId) {
        throw new Error("Not authenticated - no tenant ID");
      }
      const payload = {
        ...data,
        tenantId,
      };

      const response = await api.post<Lead>("/api/lead", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead created successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to create lead");
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<LeadFormData> & {
        stageId?: string;
        statusId?: string;
        assignedUserId?: string;
      };
    }) => {
      const response = await api.put<Lead>(`/api/lead/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", variables.id] });
      toast.success("Lead updated successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to update lead");
    },
  });

  const setLeadStageMutation = useMutation({
    mutationFn: async ({
      id,
      stageName,
    }: {
      id: string;
      stageName: string;
    }) => {
      const response = await api.post<Lead>(`/api/lead/${id}/set-stage`, {
        stageName,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to update lead stage");
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/lead/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead deleted successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to delete lead");
    },
  });

  const convertToDealMutation = useMutation({
    mutationFn: async ({ id, dealData }: { id: string; dealData: unknown }) => {
      const response = await api.post(`/api/lead/${id}/convert`, dealData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Lead converted to deal successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to convert lead");
    },
  });

  return {
    leads: normalizeCollection<Lead>(leadsQuery.data),
    pagination: leadsQuery.data?.meta ?? null,
    isLoading: leadsQuery.isLoading,
    isFetching: leadsQuery.isFetching,
    isSuccess: leadsQuery.isSuccess,
    isError: leadsQuery.isError,
    error: leadsQuery.error,
    createLead: createLeadMutation.mutateAsync,
    updateLead: updateLeadMutation.mutateAsync,
    setLeadStage: setLeadStageMutation.mutateAsync,
    deleteLead: deleteLeadMutation.mutateAsync,
    convertToDeal: convertToDealMutation.mutateAsync,
    isCreating: createLeadMutation.isPending,
    isUpdating: updateLeadMutation.isPending,
    isDeleting: deleteLeadMutation.isPending,
    isConverting: convertToDealMutation.isPending,
  };
}

export function useLeadDetail(id: string) {
  return useQuery<Lead>({
    queryKey: ["lead", id],
    queryFn: async () => {
      const response = await api.get(`/api/lead/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}
