import { useAuth } from "@/components/auth/auth-provider";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { normalizeCollection } from "@/lib/api-response";
import { Source } from "@/types/source";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface CreateSourceData {
  name: string;
  type?: string;
}

type AdditionalParams = {
  additionalParams?: {
    [key: string]: string;
  };
};

export function useSources({ additionalParams }: AdditionalParams = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = user?.tenantId;

  const sourcesQuery = useQuery({
    queryKey: ["sources", tenantId, additionalParams],
    queryFn: async () => {
      const response = await api.get<Source[]>("/api/source", {
        params: additionalParams,
      });
      return response.data;
    },
  });

  const createSourceMutation = useMutation({
    mutationFn: async (data: CreateSourceData) => {
      const response = await api.post<Source>("/api/source", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success("Source created successfully");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal membuat source."));
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/source/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success("Source deleted");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal menghapus source."));
    },
  });

  return {
    sources: normalizeCollection<Source>(sourcesQuery.data),
    isLoading: sourcesQuery.isLoading,
    createSource: createSourceMutation.mutateAsync,
    deleteSource: deleteSourceMutation.mutateAsync,
    isCreating: createSourceMutation.isPending,
    isDeleting: deleteSourceMutation.isPending,
  };
}
