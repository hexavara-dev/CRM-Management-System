import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";
import type { DealPaymentMethod } from "@/types/deal";

export type PipelineEntity = "lead" | "deal";
export type EvidenceFileType = "PDF" | "DOC" | "IMAGE" | "SHEET";

export const EVIDENCE_FILE_TYPES: { value: EvidenceFileType; label: string }[] = [
  { value: "PDF", label: "PDF" },
  { value: "DOC", label: "DOC, DOCX" },
  { value: "IMAGE", label: "JPG, PNG" },
  { value: "SHEET", label: "XLS, XLSX" },
];

export interface StageEvidence {
  id?: string;
  name: string;
  fileTypes: EvidenceFileType[];
  isRequired: boolean;
  description: string | null;
  /** Khusus Deal; null berarti semua jenis pembayaran. */
  paymentMethods: DealPaymentMethod[] | null;
}

export interface PipelineStage {
  id: string;
  entityType: PipelineEntity;
  name: string;
  description: string | null;
  probability: number;
  color: string | null;
  position: number;
  isActive: boolean;
  isDefaultStage: boolean;
  isTerminalStage: boolean;
  /** Khusus Deal: tahapan yang dihitung sebagai Won Deals (maks. satu). */
  isWonStage: boolean;
  evidences: StageEvidence[];
  /** Jumlah Lead (atau Deal) di tahapan ini. */
  itemCount: number;
}

export type PipelineStagePayload = {
  name: string;
  description: string | null;
  probability: number;
  color: string;
  isDefaultStage: boolean;
  isTerminalStage: boolean;
  /** Hanya dikirim untuk pipeline Deal. */
  isWonStage?: boolean;
  evidences: StageEvidence[];
};

const KEY = "pipeline-stages";

export function usePipelineStages(entity: PipelineEntity) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.tenantId, entity],
    queryFn: async () =>
      (await api.get<PipelineStage[]>("/api/pipeline-stages", { params: { entity } })).data,
    enabled: !!user,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [KEY] });
    // Kanban Leads/Deals membaca tahapan dari /api/stage.
    queryClient.invalidateQueries({ queryKey: ["stages"] });
  };
}

export function useSavePipelineStage(entity: PipelineEntity) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: PipelineStagePayload }) => {
      const evidences = data.evidences.map(({ name, fileTypes, isRequired, description, paymentMethods }) => ({
        name,
        fileTypes,
        isRequired,
        description,
        paymentMethods,
      }));
      const body = { ...data, evidences };
      return id
        ? (await api.put<PipelineStage>(`/api/pipeline-stages/${id}`, body)).data
        : (await api.post<PipelineStage>("/api/pipeline-stages", { ...body, entity })).data;
    },
    onSuccess: (_stage, { id }) => {
      invalidate();
      toast.success(id ? "Tahapan diperbarui" : "Tahapan ditambahkan");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan tahapan.")),
  });
}

export function useToggleStageActive() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await api.put<PipelineStage>(`/api/pipeline-stages/${id}`, { isActive })).data,
    onSuccess: (stage) => {
      invalidate();
      toast.success(stage.isActive ? "Tahapan diaktifkan" : "Tahapan dinonaktifkan");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal mengubah status tahapan.")),
  });
}

export function useReorderPipelineStages(entity: PipelineEntity) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (ids: string[]) =>
      (await api.put<PipelineStage[]>("/api/pipeline-stages/reorder", { entity, ids })).data,
    onSuccess: () => {
      invalidate();
      toast.success("Urutan tahapan disimpan");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan urutan tahapan.")),
  });
}

export function useDeletePipelineStage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/pipeline-stages/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Tahapan dihapus");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menghapus tahapan.")),
  });
}
