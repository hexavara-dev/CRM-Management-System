import api from "@/lib/api";
import type { ArchivedLead } from "@/types/lead";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type ArchiveCategory = "NOT_RESPOND" | "INVALID" | "NOT_QUALIFIED";
export type ArchiveListParams = {
  page: number; limit: number; search?: string; category?: ArchiveCategory;
  projectId?: string; sourceId?: string; assignedUserId?: string; from?: string; to?: string; direction?: "asc" | "desc";
};
export type ArchiveResponse = {
  data: ArchivedLead[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  summary: { total: number; notRespond: number; invalid: number; notQualified: number };
};

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

export function useLeadArchive(params: ArchiveListParams) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["lead-archive"] });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["lead"] });
  };
  const query = useQuery({
    queryKey: ["lead-archive", params],
    queryFn: async () => (await api.get<ArchiveResponse>("/api/leads/archive", { params })).data,
  });
  const archive = useMutation({
    mutationFn: async ({ id, category, reason }: { id: string; category: ArchiveCategory; reason?: string }) =>
      (await api.post(`/api/leads/${id}/archive`, { category, reason: reason?.trim() || null })).data,
    onSuccess: () => { invalidate(); toast.success("Lead berhasil diarsipkan"); },
    onError: (error) => toast.error(errorMessage(error, "Gagal mengarsipkan Lead")),
  });
  const reactivate = useMutation({
    mutationFn: async (id: string) => (await api.post(`/api/leads/${id}/reactivate`)).data,
    onSuccess: () => { invalidate(); toast.success("Lead berhasil diaktifkan kembali"); },
    onError: (error) => toast.error(errorMessage(error, "Gagal mengaktifkan Lead")),
  });
  const category = useMutation({
    mutationFn: async ({ id, category, reason }: { id: string; category: ArchiveCategory; reason?: string }) =>
      (await api.patch(`/api/leads/${id}/archive-category`, { category, reason: reason?.trim() || null })).data,
    onSuccess: () => { invalidate(); toast.success("Kategori arsip diperbarui"); },
    onError: (error) => toast.error(errorMessage(error, "Gagal mengubah kategori")),
  });
  const permanentDelete = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/leads/${id}/permanent`)).data,
    onSuccess: () => { invalidate(); toast.success("Lead dihapus permanen"); },
    onError: (error) => toast.error(errorMessage(error, "Gagal menghapus Lead")),
  });
  const bulkReactivate = useMutation({
    mutationFn: async (ids: string[]) => (await api.post("/api/leads/archive/bulk-reactivate", { ids })).data,
    onSuccess: () => { invalidate(); toast.success("Lead terpilih diaktifkan kembali"); },
    onError: (error) => toast.error(errorMessage(error, "Bulk aktivasi gagal; tidak ada data yang diubah")),
  });
  const bulkCategory = useMutation({
    mutationFn: async ({ ids, category, reason }: { ids: string[]; category: ArchiveCategory; reason?: string }) =>
      (await api.patch("/api/leads/archive/bulk-category", { ids, category, reason: reason?.trim() || null })).data,
    onSuccess: () => { invalidate(); toast.success("Kategori Lead terpilih diperbarui"); },
    onError: (error) => toast.error(errorMessage(error, "Bulk ubah kategori gagal; tidak ada data yang diubah")),
  });
  const bulkPermanentDelete = useMutation({
    mutationFn: async (ids: string[]) => (await api.post("/api/leads/archive/bulk-permanent-delete", { ids })).data,
    onSuccess: () => { invalidate(); toast.success("Lead terpilih dihapus permanen"); },
    onError: (error) => toast.error(errorMessage(error, "Bulk hapus gagal; tidak ada data yang diubah")),
  });
  return { ...query, archiveLead: archive.mutateAsync, reactivate: reactivate.mutateAsync, changeCategory: category.mutateAsync, permanentDelete: permanentDelete.mutateAsync, bulkReactivate: bulkReactivate.mutateAsync, bulkChangeCategory: bulkCategory.mutateAsync, bulkPermanentDelete: bulkPermanentDelete.mutateAsync, isMutating: archive.isPending || reactivate.isPending || category.isPending || permanentDelete.isPending || bulkReactivate.isPending || bulkCategory.isPending || bulkPermanentDelete.isPending };
}
