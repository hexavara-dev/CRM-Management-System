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
  media: { id: string; fileUrl: string; mediaType: string; isPrimary: boolean }[];
  unitSummary?: UnitSummary;
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
  isActive: boolean;
  variants: {
    name: string;
    basePrice: number;
    stock: number;
    attributes: { name: string; code: string; dataType: "NUMBER" | "STRING"; value: number; unit?: string }[];
  }[];
  locations: {
    key: string;
    parentKey: string | null;
    name: string;
    type: "CLUSTER" | "ZONE" | "BLOCK" | "TOWER" | "FLOOR";
  }[];
  units: {
    code: string;
    variantIndex: number;
    locationKey?: string;
    status?: "AVAILABLE" | "RESERVED" | "SOLD";
  }[];
}

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

/** Simpan proyek (satu transaksi di backend), lalu unggah cover: yang pertama menjadi primary. */
export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, covers }: { payload: CreateProjectPayload; covers: File[] }) => {
      const project = (await api.post<ProjectDetail>("/api/products", payload)).data;
      let failedCovers = 0;
      for (const [index, file] of covers.entries()) {
        const form = new FormData();
        form.append("file", file);
        form.append("isPrimary", String(index === 0));
        form.append("sortOrder", String(index));
        try {
          await api.post(`/api/products/${project.id}/media`, form);
        } catch {
          failedCovers += 1;
        }
      }
      return { project, failedCovers };
    },
    onSuccess: ({ failedCovers }) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (failedCovers > 0) toast.warning(`Proyek tersimpan, tetapi ${failedCovers} cover gagal diunggah.`);
      else toast.success("Proyek berhasil disimpan.");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan proyek.")),
  });
}
