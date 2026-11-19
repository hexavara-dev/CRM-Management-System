import { useQuery } from "@tanstack/react-query";
import type { ClusterUnit } from "@/components/availability/cluster/types";
import type {
  ClusterAvailability,
  ProjectAvailabilityDetail,
} from "@/components/availability/detail/types";
import type {
  AvailabilitySummary,
  ProjectAvailability,
} from "@/components/availability/types";
import type { UnitDetail } from "@/components/availability/unit/types";
import { useAuth } from "@/components/auth/auth-provider";
import api from "@/lib/api";

export interface AvailabilityOverview {
  summary: AvailabilitySummary;
  projects: ProjectAvailability[];
}

export interface ProjectAvailabilityResponse {
  project: ProjectAvailabilityDetail;
  hasCluster?: boolean;
  clusters: ClusterAvailability[];
}

export interface ClusterAvailabilityResponse {
  project: { id: string; code: string; name: string; location: string };
  cluster: { id: string; code: string; name: string };
  summary: Omit<AvailabilitySummary, "blocked">;
  blocks: string[];
  units: ClusterUnit[];
}

function apiPath(...segments: string[]) {
  return `/api/availability/${segments.map(encodeURIComponent).join("/")}`;
}

export function useAvailabilityOverview(projectId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["availability-overview", user?.tenantId, projectId],
    queryFn: async () => {
      const response = await api.get<AvailabilityOverview>("/api/availability", {
        params: projectId ? { projectId } : undefined,
      });
      return response.data;
    },
    enabled: !!user,
  });
}

export function useProjectAvailability(projectId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["availability-project", user?.tenantId, projectId],
    queryFn: async () =>
      (await api.get<ProjectAvailabilityResponse>(apiPath(projectId as string))).data,
    enabled: !!user && !!projectId,
  });
}

export function useClusterAvailability(
  projectId: string | undefined,
  clusterId: string | undefined,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["availability-cluster", user?.tenantId, projectId, clusterId],
    queryFn: async () =>
      (
        await api.get<ClusterAvailabilityResponse>(
          apiPath(projectId as string, "clusters", clusterId as string),
        )
      ).data,
    enabled: !!user && !!projectId && !!clusterId,
  });
}

export function useAvailabilityUnit(
  projectId: string | undefined,
  clusterId: string | undefined,
  unitId: string | undefined,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["availability-unit", user?.tenantId, projectId, clusterId, unitId],
    queryFn: async () =>
      (
        await api.get<UnitDetail>(
          apiPath(projectId as string, "clusters", clusterId as string, "units", unitId as string),
        )
      ).data,
    enabled: !!user && !!projectId && !!clusterId && !!unitId,
  });
}
