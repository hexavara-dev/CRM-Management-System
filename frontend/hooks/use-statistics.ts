import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Task } from "@/types/activity";
import type { Deal } from "@/types/deal";
import type { Lead } from "@/types/lead";

export interface Statistics {
  totalProjectActive: number;
  totalTypes: number;
  totalUnits: number;
  summaryChanges: {
    projects: number | null;
    types: number | null;
    units: number | null;
    ongoingDeals: number | null;
    wonDeals: number | null;
    lostDeals: number | null;
  };
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
  leadPipeline: { id: string; name: string; color: string | null; count: number }[];
  dealPipeline: { id: string; name: string; color: string | null; count: number }[];
  upcomingVisits: {
    id: string;
    scheduledAt: string;
    durationMinutes: number;
    name: string | null;
    customer: { firstName: string; lastName: string | null };
    location: { name: string } | null;
  }[];
  availability: {
    available: number;
    processing: number;
    reserved: number;
    sold: number;
    blocked: number;
    notYetCreated: number;
    total: number;
  };
}

export function useStatistics(year?: number) {
  const statsQuery = useQuery({
    queryKey: ["statistics", year],
    queryFn: async () => {
      const response = await api.get<Statistics>("/api/statistics", {
        params: year
          ? { startDate: `${year}-01-01`, endDate: `${year}-12-31T23:59:59.999Z` }
          : undefined,
      });
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
