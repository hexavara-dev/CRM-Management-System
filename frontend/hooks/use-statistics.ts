import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Task } from "@/types/activity";
import type { Deal } from "@/types/deal";
import type { Lead } from "@/types/lead";

export interface Statistics {
  totalLeads: number;
  ongoingDeals: number;
  wonDeals: number;
  lostDeals: number;
  avgTimeLeadClose: number;
  avgTimeDealClose: number;
  avgDealValue: number;
  avgWonValue: number;
  salesTrend: { month: string; count: number; value: number }[];
  recentLeads: Lead[];
  recentDeals: Deal[];
  pendingTasks: Task[];
}

export function useStatistics() {
  const statsQuery = useQuery({
    queryKey: ["statistics"],
    queryFn: async () => {
      const response = await api.get<Statistics>("/api/statistics");
      return response.data;
    },
  });

  return {
    statistics: statsQuery.data,
    isLoading: statsQuery.isLoading,
    isError: statsQuery.isError,
    error: statsQuery.error,
    refetch: statsQuery.refetch,
  };
}
