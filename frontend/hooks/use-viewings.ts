import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { normalizeCollection } from "@/lib/api-response";
import { useAuth } from "@/components/auth/auth-provider";
import type { Pagination } from "@/types/api";
import { Viewing } from "@/types/viewing";

type UpsertViewingPayload = {
  customerId: string;
  actorId?: string;
  statusId?: string;
  sourceId?: string;
  unitId?: string;
  locationId?: string;
  scheduledAt: string;
  durationMinutes?: number;
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
      const response = await api.post<Viewing>("/api/viewing", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["viewings"] });
      toast.success("Visit schedule created");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal membuat jadwal visit."));
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
      const response = await api.put<Viewing>(`/api/viewing/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["viewings"] });
      toast.success("Visit schedule updated");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal memperbarui jadwal visit."));
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
      toast.error(apiErrorMessage(error, "Gagal menghapus jadwal visit."));
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
      toast.error(apiErrorMessage(error, "Gagal mengunggah bukti visit."));
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
      toast.error(
        apiErrorMessage(error, "Gagal menandai visit sebagai gagal."),
      );
    },
  });

  return {
    viewings: normalizeCollection<Viewing>(viewingsQuery.data),
    meta: (viewingsQuery.data as { meta?: Pagination } | undefined)?.meta,
    isLoading: viewingsQuery.isLoading || viewingsQuery.isFetching,
    isError: viewingsQuery.isError,
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
