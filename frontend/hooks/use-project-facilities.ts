import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";

export interface ProjectFacility {
  id: string;
  name: string;
  code: string;
  iconKey: string | null;
  description: string | null;
  isActive: boolean;
  /** Jumlah proyek yang memakai fasilitas. */
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFacilityList {
  data: ProjectFacility[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type ProjectFacilityStatus = "active" | "inactive";

export type ProjectFacilityFilters = { search?: string; status?: ProjectFacilityStatus; page: number; limit: number };

export type ProjectFacilityPayload = {
  name: string;
  iconKey: string;
  description: string | null;
  isActive: boolean;
};

const KEY = "project-facilities";

export function useProjectFacilityList(filters: ProjectFacilityFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.tenantId, "list", filters],
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""));
      return (await api.get<ProjectFacilityList>("/api/project-facilities", { params })).data;
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  // Pilihan fasilitas dan detail proyek ikut menampilkan nama dan ikon fasilitas.
  return () => {
    for (const key of [KEY, "project", "project-edit"]) queryClient.invalidateQueries({ queryKey: [key] });
  };
}

export function useSaveProjectFacility() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: ProjectFacilityPayload }) =>
      id
        ? (await api.put<ProjectFacility>(`/api/project-facilities/${id}`, data)).data
        : (await api.post<ProjectFacility>("/api/project-facilities", data)).data,
    onSuccess: (_facility, { id }) => {
      invalidate();
      toast.success(id ? "Fasilitas diperbarui" : "Fasilitas ditambahkan");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan fasilitas.")),
  });
}

export function useDeleteProjectFacility() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/project-facilities/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Fasilitas dihapus");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menghapus fasilitas.")),
  });
}
