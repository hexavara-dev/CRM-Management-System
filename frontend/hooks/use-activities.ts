import api from "@/lib/api";
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
      callLogs?: { create: Record<string, unknown> };
      tasks?: { create: Record<string, unknown> };
      notes?: { create: Record<string, unknown> };
    }) => {
      const isDealActivity = !!data.dealId;
      const endpoint = isDealActivity
        ? "/api/dealactivity"
        : "/api/leadactivity";

      // Send relation IDs as scalars. The backend supplies the authoritative
      // tenantId from the JWT, avoiding a Prisma checked/unchecked input mix.
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
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to add activity");
    },
  });

  return {
    leadActivities: leadActivitiesQuery.data ?? [],
    isLoading: leadActivitiesQuery.isLoading,
    createLeadActivity: createLeadActivityMutation.mutateAsync,
    isCreatingActivity: createLeadActivityMutation.isPending,
  };
}
