import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { normalizeCollection } from "@/lib/api-response";
import { LeadFormData } from "@/schemas/lead.schema";
import { Lead } from "@/types/lead";
import { useAuth } from "@/components/auth/auth-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PaginatedResponse } from "@/types/api";

type UseLeadsOptions = {
  page?: number;
  limit?: number;
  useServerPagination?: boolean;
  additionalParams?: Record<string, unknown>;
  getAll?: boolean;
  fetchAllPages?: boolean;
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
    fetchAllPages = false,
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
        fetchAllPages,
      },
    ],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Lead[]>>(`/api/lead`, {
        params: queryParams,
      });
      if (fetchAllPages && (response.data.meta?.totalPages ?? 1) > 1) {
        const remaining = await Promise.all(
          Array.from(
            { length: (response.data.meta?.totalPages ?? 1) - 1 },
            (_, index) =>
              api.get<PaginatedResponse<Lead[]>>("/api/lead", {
                params: { ...queryParams, page: index + 2, limit: 100 },
              }),
          ),
        );
        return {
          ...response.data,
          data: [
            ...normalizeCollection<Lead>(response.data),
            ...remaining.flatMap((pageResponse) =>
              normalizeCollection<Lead>(pageResponse.data),
            ),
          ],
        };
      }
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
      const response = await api.post<Lead>("/api/lead", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead created successfully");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal membuat Lead."));
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
      toast.error(apiErrorMessage(error, "Gagal memperbarui Lead."));
    },
  });

  const setLeadStageMutation = useMutation({
    mutationFn: async ({
      id,
      stageName,
      evidenceAttachmentIds,
    }: {
      id: string;
      stageName: string;
      evidenceAttachmentIds?: string[];
    }) => {
      const response = await api.post<Lead>(`/api/lead/${id}/set-stage`, {
        stageName,
        evidenceAttachmentIds,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal memperbarui fase Lead."));
    },
  });

  const transitionLeadStageMutation = useMutation({
    mutationFn: async ({ id, targetStageId, expectedSourceStageId, documents = [] }: { id: string; targetStageId: string; expectedSourceStageId: string; documents?: { name: string; file: File }[] }) => {
      const form = new FormData();
      form.append("payload", JSON.stringify({ targetStageId, expectedSourceStageId, documents: documents.map(({ name }, fileIndex) => ({ name, fileIndex })) }));
      for (const { file } of documents) form.append("documents", file);
      return (await api.post<{ id: string; stageId: string }>(`/api/lead/${id}/transition-stage`, form)).data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", variables.id] });
      toast.success("Fase Lead berhasil diperbarui.");
    },
    onError: (error: unknown) => toast.error(apiErrorMessage(error, "Gagal memindahkan fase Lead.")),
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
      toast.error(
        apiErrorMessage(error, "Gagal mengonversi Lead menjadi Deal."),
      );
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
    transitionLeadStage: transitionLeadStageMutation.mutateAsync,
    convertToDeal: convertToDealMutation.mutateAsync,
    isCreating: createLeadMutation.isPending,
    isUpdating: updateLeadMutation.isPending,
    isConverting: convertToDealMutation.isPending,
    isTransitioningStage: transitionLeadStageMutation.isPending,
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
