import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";

export interface LeadCampaign {
  id: string;
  sourceId: string;
  name: string;
  description: string | null;
  /** `YYYY-MM-DD` atau null bila periode belum ditentukan. */
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LeadCampaignPayload = {
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
};

const KEY = "lead-campaigns";

/** Campaign milik satu source (halaman konfigurasi). */
export function useLeadCampaigns(sourceId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.tenantId, sourceId],
    queryFn: async () => (await api.get<LeadCampaign[]>("/api/lead-campaigns", { params: { sourceId } })).data,
    enabled: !!user && !!sourceId,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [KEY] });
    // Jumlah campaign tampil di daftar Leads Source.
    queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
  };
}

export function useSaveLeadCampaign() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, sourceId, data }: { id?: string; sourceId: string; data: LeadCampaignPayload }) =>
      id
        ? (await api.put<LeadCampaign>(`/api/lead-campaigns/${id}`, data)).data
        : (await api.post<LeadCampaign>("/api/lead-campaigns", { ...data, sourceId })).data,
    onSuccess: (_campaign, { id }) => {
      invalidate();
      toast.success(id ? "Campaign diperbarui" : "Campaign ditambahkan");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan campaign.")),
  });
}

export function useDeleteLeadCampaign() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/lead-campaigns/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Campaign dihapus");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menghapus campaign.")),
  });
}

/** Status tampilan berdasarkan aktif dan periode (tanggal lokal browser). */
export function campaignPhase(campaign: LeadCampaign, today = new Date()) {
  if (!campaign.isActive) return "inactive" as const;
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (campaign.startDate && campaign.startDate > day) return "upcoming" as const;
  if (campaign.endDate && campaign.endDate < day) return "ended" as const;
  return "running" as const;
}
