import { useAuth } from "@/components/auth/auth-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { normalizeCollection } from "@/lib/api-response";
import { toast } from "sonner";

export interface Status {
  id: string;
  tenantId: string;
  name: string;
  priority: number;
  color?: string;
  type?: string;
  isDefaultStatus?: boolean;
  isClosingStatus?: boolean;
  isFailedStatus?: boolean;
  isSystemStatus?: boolean;
}

export interface CreateStatusData {
  name: string;
  priority?: number;
  color?: string;
  type?: string;
}

type AdditionalParams = {
  additionalParams?: {
    [key: string]: string;
  };
};

export function useStatuses({ additionalParams }: AdditionalParams = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = user?.tenantId;

  const statusesQuery = useQuery({
    queryKey: ["statuses", tenantId, additionalParams],
    queryFn: async () => {
      const response = await api.get<Status[]>(`/api/status`, {
        params: additionalParams,
      });
      return response.data;
    },
  });

  const createStatusMutation = useMutation({
    mutationFn: async (data: CreateStatusData) => {
      const response = await api.post<Status>("/api/status", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
      toast.success("Status created successfully");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal membuat status."));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateStatusData>;
    }) => {
      const response = await api.put<Status>(`/api/status/${id}`, {
        ...data,
        type: additionalParams?.type || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
      toast.success("Status updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal memperbarui status."));
    },
  });

  const deleteStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/status/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
      toast.success("Status deleted");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal menghapus status."));
    },
  });

  return {
    statuses: normalizeCollection<Status>(statusesQuery.data),
    isLoading: statusesQuery.isLoading,
    createStatus: createStatusMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    deleteStatus: deleteStatusMutation.mutateAsync,
    isCreating: createStatusMutation.isPending,
    isUpdating: updateStatusMutation.isPending,
    isDeleting: deleteStatusMutation.isPending,
  };
}
