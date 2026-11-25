import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { LeadActivity } from "@/types/activity";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useActivities() {
  const queryClient = useQueryClient();

  const leadActivitiesQuery = useQuery({
    queryKey: ["leadActivities"],
    queryFn: async () => {
      const response = await api.get<LeadActivity[]>("/api/leadactivity");
      return response.data;
    },
  });

  const createLeadActivityMutation = useMutation({
    mutationFn: async (data: {
      leadId?: string;
      dealId?: string;
      activityType: string;
      activityDate?: string;
      callLogs?: { create: Record<string, unknown> };
      tasks?: { create: Record<string, unknown> };
      notes?: { create: Record<string, unknown> };
    }) => {
      const isDealActivity = !!data.dealId;
      const endpoint = isDealActivity
        ? "/api/dealactivity"
        : "/api/leadactivity";

      const response = await api.post<LeadActivity>(endpoint, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities"] });

      if (variables.leadId) {
        queryClient.invalidateQueries({ queryKey: ["lead", variables.leadId] });
      }

      if (variables.dealId) {
        queryClient.invalidateQueries({ queryKey: ["deal", variables.dealId] });
      }

      const type =
        variables.activityType === "call"
          ? "Call log"
          : variables.activityType === "task"
            ? "Task"
            : variables.activityType === "note"
              ? "Note"
              : "Activity";
      toast.success(`${type} added successfully`);
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal menambahkan aktivitas."));
    },
  });

  return {
    leadActivities: leadActivitiesQuery.data ?? [],
    isLoading: leadActivitiesQuery.isLoading,
    createLeadActivity: createLeadActivityMutation.mutateAsync,
    isCreatingActivity: createLeadActivityMutation.isPending,
  };
}
