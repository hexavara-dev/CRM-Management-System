import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";

/** Preset warna; sama dengan ACTIVITY_COLORS di backend. */
export const ACTIVITY_COLORS = {
  blue: { label: "Biru", text: "#1D4ED8", bg: "#DBEAFE" },
  purple: { label: "Ungu", text: "#7E22CE", bg: "#F3E8FF" },
  green: { label: "Hijau", text: "#15803D", bg: "#DCFCE7" },
  orange: { label: "Oranye", text: "#EA580C", bg: "#FFEDD5" },
  gray: { label: "Abu-abu", text: "#475467", bg: "#EEF0F4" },
  red: { label: "Merah", text: "#DC2626", bg: "#FEE2E2" },
  yellow: { label: "Kuning", text: "#A16207", bg: "#FEF9C3" },
  pink: { label: "Pink", text: "#DB2777", bg: "#FCE7F3" },
} as const;

export type ActivityColor = keyof typeof ACTIVITY_COLORS;

export const activityColor = (color: string) => ACTIVITY_COLORS[color as ActivityColor] ?? ACTIVITY_COLORS.gray;

export interface LeadActivityType {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivityTypeList {
  data: LeadActivityType[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type LeadActivityTypeStatus = "active" | "inactive";

export type LeadActivityTypeFilters = { search?: string; status?: LeadActivityTypeStatus; page: number; limit: number };

export type LeadActivityTypePayload = {
  name: string;
  icon: string;
  color: ActivityColor;
  description: string | null;
  isActive: boolean;
};

const KEY = "lead-activity-types";

export function useLeadActivityTypes(filters: LeadActivityTypeFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.tenantId, filters],
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""));
      return (await api.get<LeadActivityTypeList>("/api/lead-activity-types", { params })).data;
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

export function useSaveLeadActivityType() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: LeadActivityTypePayload }) =>
      id
        ? (await api.put<LeadActivityType>(`/api/lead-activity-types/${id}`, data)).data
        : (await api.post<LeadActivityType>("/api/lead-activity-types", data)).data,
    onSuccess: (_type, { id }) => {
      invalidate();
      toast.success(id ? "Jenis aktivitas diperbarui" : "Jenis aktivitas ditambahkan");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan jenis aktivitas.")),
  });
}

export function useDeleteLeadActivityType() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/lead-activity-types/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Jenis aktivitas dihapus");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menghapus jenis aktivitas.")),
  });
}
