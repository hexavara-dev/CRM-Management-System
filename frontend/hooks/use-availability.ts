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

/**
 * Sementara: backend belum punya endpoint availability, jadi hook ini
 * mengembalikan data kosong agar halaman menampilkan empty state.
 * Ganti queryFn dengan pemanggilan API begitu endpoint tersedia.
 */

export interface AvailabilityOverview {
  summary: AvailabilitySummary;
  projects: ProjectAvailability[];
}

export interface ProjectAvailabilityResponse {
  project: ProjectAvailabilityDetail;
  clusters: ClusterAvailability[];
}

export interface ClusterAvailabilityResponse {
  project: { id: string; name: string; location: string };
  cluster: { id: string; name: string };
  summary: Omit<AvailabilitySummary, "blocked">;
  blocks: string[];
  units: ClusterUnit[];
}

const EMPTY_OVERVIEW: AvailabilityOverview = {
  summary: { total: 0, available: 0, processing: 0, reserved: 0, sold: 0, blocked: 0 },
  projects: [],
};

export function useAvailabilityOverview(projectId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["availability-overview", user?.tenantId, projectId],
    queryFn: async (): Promise<AvailabilityOverview> => EMPTY_OVERVIEW,
    enabled: !!user,
  });
}

export function useProjectAvailability(projectId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["availability-project", user?.tenantId, projectId],
    queryFn: async (): Promise<ProjectAvailabilityResponse | null> => null,
    enabled: !!user && !!projectId,
  });
}

export function useClusterAvailability(projectId: string | undefined, clusterId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["availability-cluster", user?.tenantId, projectId, clusterId],
    queryFn: async (): Promise<ClusterAvailabilityResponse | null> => null,
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
    queryFn: async (): Promise<UnitDetail | null> => null,
    enabled: !!user && !!projectId && !!clusterId && !!unitId,
  });
}
