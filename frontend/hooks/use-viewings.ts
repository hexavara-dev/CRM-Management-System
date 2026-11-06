import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { Viewing } from "@/types/viewing";

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

type UpsertViewingPayload = {
  leadId: string;
  actorId?: string;
  statusId?: string;
  sourceId?: string;
  locationId?: string;
  scheduledAt: string;
  name?: string;
  email?: string;
  notes?: string;
};

type UseViewingsOptions = {
  page?: number;
  limit?: number;
  additionalParams?: Record<string, unknown>;
  enabled?: boolean;
  fetchAllPages?: boolean;
};

export function useViewings(options: UseViewingsOptions = {}) {
  const {
    page = 1,
    limit = 100,
    additionalParams = {},
    enabled = true,
    fetchAllPages = false,
  } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = user?.tenantId;

  const viewingsQuery = useQuery({
    queryKey: ["viewings", { page, limit, fetchAllPages, ...additionalParams }],
    queryFn: async () => {
      const response = await api.get("/api/viewing", {
        params: { page, limit, ...additionalParams },
      });
      if (!fetchAllPages) return response.data;

      const items = normalizeCollection<Viewing>(response.data);
      const totalPages = response.data?.meta?.totalPages ?? 1;
      for (let next = page + 1; next <= totalPages; next += 1) {
        const nextResponse = await api.get("/api/viewing", {
          params: { page: next, limit, ...additionalParams },
        });
        items.push(...normalizeCollection<Viewing>(nextResponse.data));
      }
      return { data: items };
    },
    enabled,
  });

  const createViewingMutation = useMutation({
    mutationFn: async (data: UpsertViewingPayload) => {
      if (!tenantId) {
        throw new Error("Not authenticated - no tenant ID");
      }
      const payload = {
        ...data,
        tenantId,
      };
      const response = await api.post<Viewing>("/api/viewing", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["viewings"] });
      toast.success("Visit schedule created");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to create visit");
    },
  });

  const updateViewingMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<UpsertViewingPayload>;
    }) => {
      if (!tenantId) {
        throw new Error("Not authenticated - no tenant ID");
      }
      const payload = {
        ...data,
        tenantId,
      };
      const response = await api.put<Viewing>(`/api/viewing/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["viewings"] });
      toast.success("Visit schedule updated");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to update visit");
    },
  });

  const deleteViewingMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/viewing/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["viewings"] });
      toast.success("Visit schedule deleted");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to delete visit");
    },
  });

  const uploadEvidenceMutation = useMutation({
    mutationFn: async ({
      id,
      file,
      notes,
    }: {
      id: string;
      file: File;
      notes?: string;
    }) => {
      const formData = new FormData();
      formData.append("evidence", file);
      if (notes) formData.append("notes", notes);

      const response = await api.post<Viewing>(
        `/api/viewing/${id}/upload-evidence`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["viewings"] });
      queryClient.invalidateQueries({ queryKey: ["lead"] });
      toast.success("Visit evidence uploaded");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to upload evidence");
    },
  });

  const failViewingMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await api.post<Viewing>(`/api/viewing/${id}/fail`, {
        reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["viewings"] });
      queryClient.invalidateQueries({ queryKey: ["lead"] });
      toast.success("Visit marked as failed");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to mark as failed");
    },
  });

  return {
    viewings: normalizeCollection<Viewing>(viewingsQuery.data),
    isLoading: viewingsQuery.isLoading || viewingsQuery.isFetching,
    createViewing: createViewingMutation.mutateAsync,
    updateViewing: updateViewingMutation.mutateAsync,
    deleteViewing: deleteViewingMutation.mutateAsync,
    uploadEvidence: uploadEvidenceMutation.mutateAsync,
    failViewing: failViewingMutation.mutateAsync,
    isCreating: createViewingMutation.isPending,
    isUpdating: updateViewingMutation.isPending,
    isDeleting: deleteViewingMutation.isPending,
    isUploadingEvidence: uploadEvidenceMutation.isPending,
    isFailing: failViewingMutation.isPending,
  };
}
