import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import api from "@/lib/api";

// Proyek adalah product di backend: `products` (nama, kode, deskripsi, status) + akar `product_categories`.

export interface UnitSummary {
  total: number;
  available: number;
  reserved: number;
  booked: number;
  sold: number;
  blocked: number;
}

export interface ProjectLocation {
  province: string | null;
  city: string | null;
  subdistrict: string | null;
  village: string | null;
  address: string | null;
  postalCode: string | null;
  mapsUrl: string | null;
}

export interface ProjectListItem extends ProjectLocation {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  coverUrl: string | null;
  unitSummary?: UnitSummary;
  variantCount: number;
  minBasePrice: number | null;
}

export interface ProjectList {
  data: ProjectListItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  summary: { total: number; active: number; inactive: number };
}

export interface ProjectDetail extends ProjectLocation {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  category: { id: string; name: string; type: string };
  variants: { id: string; name: string; basePrice: number; currentPrice: number; stock: number }[];
  media: { id: string; fileUrl: string; mediaType: string; isPrimary: boolean; variantId: string | null; unitId: string | null }[];
  unitSummary?: UnitSummary;
  attributes: { id: string; variantId: string | null; value: number; attribute: ProjectAttribute }[];
}

export interface ProjectEditData extends ProjectDetail {
  locations: { id: string; parentId: string | null; name: string; code: string; type: string }[];
  units: { id: string; categoryId: string; variantId: string; code: string; status: string; isHook: boolean }[];
}

export interface ProjectAttribute {
  id: string;
  name: string;
  code: string;
  source: "PROJECT" | "UNIT_TYPE";
  iconKey: string | null;
}

export function useProjectFacilities() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-facilities", user?.tenantId],
    queryFn: async () => {
      const response = await api.get<{ data: ProjectAttribute[] }>("/api/attributes");
      return response.data.data.filter((item) => item.source === "PROJECT");
    },
    enabled: !!user,
  });
}

export interface CreateProjectPayload {
  name: string;
  code: string;
  description?: string;
  province?: string;
  city?: string;
  subdistrict?: string;
  village?: string;
  address?: string;
  postalCode?: string;
  mapsUrl?: string;
  isActive: boolean;
  facilityAttributeIds?: string[];
  variants: {
    id?: string;
    name: string;
    basePrice: number;
    stock: number;
    attributes: { name: string; code: string; dataType: "NUMBER" | "STRING"; value: number; unit?: string }[];
  }[];
  locations: {
    id?: string;
    key: string;
    parentKey: string | null;
    name: string;
    type: "CLUSTER" | "ZONE" | "BLOCK" | "TOWER" | "FLOOR";
  }[];
  units: {
    id?: string;
    code: string;
    variantIndex: number;
    locationKey?: string;
    status?: "AVAILABLE" | "RESERVED" | "BOOKED" | "BLOCKED" | "SOLD";
    isHook?: boolean;
  }[];
}

export type UpdateProjectPayload = Partial<CreateProjectPayload> & {
  removeMediaIds?: string[];
  primaryMediaId?: string;
};

export interface ProjectFilters {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}

export const errorMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ error?: string }>)?.response?.data?.error || (error instanceof Error ? error.message : fallback);

export function useProjects(filters: ProjectFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projects", user?.tenantId, filters],
    queryFn: async () => {
      const { search, isActive, ...rest } = filters;
      const response = await api.get<ProjectList>("/api/products", {
        params: { ...rest, ...(search ? { search } : {}), ...(isActive === undefined ? {} : { isActive }) },
      });
      return response.data;
    },
    enabled: !!user,
    placeholderData: (previous) => previous,
    retry: false,
  });
}

export function useProject(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project", user?.tenantId, id],
    queryFn: async () => (await api.get<ProjectDetail>(`/api/products/${id}`)).data,
    enabled: !!user && !!id,
  });
}

export function useProjectEditData(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-edit", user?.tenantId, id],
    queryFn: async () => (await api.get<ProjectEditData>(`/api/products/${id}/edit-data`)).data,
    enabled: !!user && !!id,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
}

/** Simpan seluruh wizard termasuk record cover dalam satu transaksi backend. */
export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, covers }: { payload: CreateProjectPayload; covers: File[] }) => {
      if (covers.length === 0) return (await api.post<ProjectDetail>("/api/products", payload)).data;
      const form = new FormData();
      form.append("payload", JSON.stringify(payload));
      for (const file of covers) {
        form.append("covers", file);
      }
      return (await api.post<ProjectDetail>("/api/products", form)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Proyek berhasil disimpan.");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan proyek.")),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload, covers }: { id: string; payload: UpdateProjectPayload; covers: File[] }) => {
      if (covers.length === 0) return (await api.put<ProjectDetail>(`/api/products/${id}`, payload)).data;
      const form = new FormData();
      form.append("payload", JSON.stringify(payload));
      for (const file of covers) form.append("covers", file);
      return (await api.put<ProjectDetail>(`/api/products/${id}`, form)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project"] });
      queryClient.invalidateQueries({ queryKey: ["project-edit"] });
      queryClient.invalidateQueries({ queryKey: ["availability-project"] });
      toast.success("Proyek diperbarui.");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal memperbarui proyek.")),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/products/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Proyek dihapus.");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menghapus proyek.")),
  });
}

export function useProjectMediaAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mediaId, action }: { mediaId: string; action: "primary" | "delete" }) => {
      if (action === "primary") await api.patch(`/api/media/${mediaId}`, { isPrimary: true });
      else await api.delete(`/api/media/${mediaId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project"] }),
    onError: (error) => toast.error(errorMessage(error, "Gagal memperbarui gambar.")),
  });
}
