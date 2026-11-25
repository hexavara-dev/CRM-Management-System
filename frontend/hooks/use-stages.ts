import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { normalizeCollection } from "@/lib/api-response";
import { toast } from "sonner";
import { Stage } from "@/types/stage";

export interface CreateStageData {
  name: string;
  position?: number;
  entityType?: string;
  isTerminal?: boolean;
  color: string;
  tenantId?: string;
}

type StageApiResponse = Omit<Stage, "isTerminal"> & {
  isTerminal?: boolean;
  isTerminalStage?: boolean;
};

function normalizeStages(payload: unknown): Stage[] {
  return normalizeCollection<StageApiResponse>(payload).map((stage) => ({
    ...stage,
    isTerminal: stage.isTerminal ?? stage.isTerminalStage ?? false,
  }));
}

export function useStages(entityType: string = "deal") {
  const queryClient = useQueryClient();

  const stagesQuery = useQuery({
    queryKey: ["stages", entityType],
    queryFn: async () => {
      const response = await api.get<Stage[]>("/api/stage", {
        params: { entityType },
      });
      return response.data;
    },
  });

  const createStageMutation = useMutation({
    mutationFn: async (data: CreateStageData) => {
      const { isTerminal, ...stageData } = data;
      const payload = {
        ...stageData,
        ...(isTerminal !== undefined && { isTerminalStage: isTerminal }),
        entityType,
        position: data.position || 0,
      };
      const response = await api.post<Stage>("/api/stage", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
      toast.success("Stage created successfully");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal membuat stage."));
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateStageData>;
    }) => {
      const { isTerminal, ...stageData } = data;
      const payload = {
        ...stageData,
        ...(isTerminal !== undefined && { isTerminalStage: isTerminal }),
      };
      const response = await api.put<Stage>(`/api/stage/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
      toast.success("Stage updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal memperbarui stage."));
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/stage/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
      toast.success("Stage deleted");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal menghapus stage."));
    },
  });

  const updateStagePositionMutation = useMutation({
    mutationFn: async (stages: { id: string; position: number }[]) => {
      const response = await api.put("/api/stage/reorder", { stages });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal mengurutkan stage."));
    },
  });

  return {
    stages: normalizeStages(stagesQuery.data),
    isLoading: stagesQuery.isLoading,
    createStage: createStageMutation.mutateAsync,
    updateStage: updateStageMutation.mutateAsync,
    deleteStage: deleteStageMutation.mutateAsync,
    updateStagePosition: updateStagePositionMutation.mutateAsync,
    isCreating: createStageMutation.isPending,
    isUpdating: updateStageMutation.isPending,
    isDeleting: deleteStageMutation.isPending,
  };
}
