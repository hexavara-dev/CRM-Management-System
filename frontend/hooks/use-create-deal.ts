import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";
import type { Deal, DealPaymentMethod } from "@/types/deal";
import type { LeadFormSubmission } from "@/hooks/use-lead-form";

export interface DealLeadOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  project: { id: string; name: string } | null;
  labels: { id: string; type: "TEMPERATURE" | "TAG"; name: string; color: string; icon: string }[];
}

export type CreateDealPayload = {
  leadId: string;
  unitId: string;
  amount: number;
  paymentMethod: DealPaymentMethod;
  financingBankId: string | null;
  expectedClosingDate: string;
  notes: string | null;
};

type LeadOptionPage = { data: DealLeadOption[]; meta: { totalPages: number } };

/** Lead yang dapat dibuatkan Deal. */
export function useDealLeadOptions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["deal-lead-options", user?.tenantId],
    queryFn: async () => {
      const load = async (page: number) =>
        (await api.get<LeadOptionPage>("/api/lead/deal-options", { params: { page, limit: 100 } })).data;
      const first = await load(1);
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, first.meta.totalPages - 1) }, (_, index) => load(index + 2)),
      );
      return [...first.data, ...rest.flatMap((page) => page.data)];
    },
    enabled: !!user,
  });
}

/** Data yang berubah bersama Deal: Lead, pipeline, dan status unit. */
const AFFECTED = [
  "deals",
  "deal-units",
  "deal-lead-options",
  "leads",
  "lead",
  "pipeline-stages",
  "statistics",
  "projects",
  "project",
  "reservation-available-units",
  "availability-overview",
  "availability-project",
  "availability-cluster",
  "availability-unit",
  "unit-price-projects",
  "unit-price-project",
];

export function invalidateDealData(queryClient: QueryClient) {
  for (const key of AFFECTED) queryClient.invalidateQueries({ queryKey: [key] });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, documents }: { payload: CreateDealPayload; documents: { name: string; file: File }[] }) => {
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({ ...payload, documents: documents.map(({ name }, fileIndex) => ({ name, fileIndex })) }),
      );
      for (const { file } of documents) form.append("documents", file);
      return (await api.post<Deal>("/api/deal", form)).data;
    },
    onSuccess: () => {
      invalidateDealData(queryClient);
      toast.success("Deal berhasil dibuat.");
    },
    onError: (error) => {
      // Lead atau unit bisa sudah diambil orang lain; muat ulang pilihannya.
      for (const key of ["deal-lead-options", "reservation-available-units"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.error(errorMessage(error, "Gagal membuat Deal."));
    },
  });
}

/** Menyimpan Lead dan Deal dalam satu request; kegagalan salah satunya membatalkan keduanya. */
export function useCreateLeadAndDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ lead, payload, documents }: { lead: LeadFormSubmission; payload: Omit<CreateDealPayload, "leadId">; documents: { name: string; file: File }[] }) => {
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          lead,
          deal: { ...payload, documents: documents.map(({ name }, fileIndex) => ({ name, fileIndex })) },
        }),
      );
      for (const { file } of documents) form.append("documents", file);
      return (await api.post<Deal>("/api/deal/from-lead-form", form)).data;
    },
    onSuccess: () => {
      invalidateDealData(queryClient);
      queryClient.invalidateQueries({ queryKey: ["form-templates"] });
      toast.success("Lead dan Deal berhasil dibuat.");
    },
    onError: (error) => {
      for (const key of ["deal-lead-options", "reservation-available-units"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.error(errorMessage(error, "Gagal membuat Lead dan Deal."));
    },
  });
}
