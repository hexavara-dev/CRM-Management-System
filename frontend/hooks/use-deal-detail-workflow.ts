import { invalidateDealData } from "@/hooks/use-create-deal";
import api from "@/lib/api";
import type {
  DealHistory,
  DealLostRequest,
  DealPayment,
  DealPaymentStatus,
  DealPaymentType,
} from "@/types/deal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function message(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { error?: string } } }).response?.data
      ?.error || fallback
  );
}

export function useDealDetailWorkflow(dealId: string) {
  const client = useQueryClient();
  const history = useQuery({
    queryKey: ["deal-history", dealId],
    queryFn: async () =>
      (await api.get<DealHistory[]>(`/api/deal/${dealId}/history`)).data,
    enabled: !!dealId,
  });
  const payments = useQuery({
    queryKey: ["deal-payments", dealId],
    queryFn: async () =>
      (await api.get<DealPayment[]>(`/api/deal/${dealId}/payments`)).data,
    enabled: !!dealId,
  });
  const lostRequests = useQuery({
    queryKey: ["deal-lost-requests", dealId],
    queryFn: async () =>
      (await api.get<DealLostRequest[]>(`/api/deal/${dealId}/lost-requests`))
        .data,
    enabled: !!dealId,
  });

  const invalidate = () => {
    client.invalidateQueries({ queryKey: ["deal", dealId] });
    invalidateDealData(client);
    client.invalidateQueries({ queryKey: ["deal-history", dealId] });
    client.invalidateQueries({ queryKey: ["deal-payments", dealId] });
    client.invalidateQueries({ queryKey: ["deal-lost-requests", dealId] });
  };

  const addPayment = useMutation({
    mutationFn: async (data: {
      type: DealPaymentType;
      amount: number;
      status?: DealPaymentStatus;
      dueDate?: string | null;
      paidAt?: string | null;
      notes?: string | null;
    }) => (await api.post(`/api/deal/${dealId}/payments`, data)).data,
    onSuccess: () => {
      invalidate();
      toast.success("Transaksi berhasil ditambahkan.");
    },
    onError: (error) =>
      toast.error(message(error, "Gagal menambahkan transaksi.")),
  });

  const requestLost = useMutation({
    mutationFn: async (data: { reason: string; chronology: string }) =>
      (await api.post(`/api/deal/${dealId}/lost-requests`, data)).data,
    onSuccess: () => {
      invalidate();
      toast.success("Pengajuan Lost dikirim untuk verifikasi.");
    },
    onError: (error) =>
      toast.error(message(error, "Gagal mengajukan Lost Deal.")),
  });

  const reviewLost = useMutation({
    mutationFn: async (data: {
      requestId: string;
      decision: "approve" | "reject";
      reviewNotes?: string;
    }) =>
      (
        await api.post(
          `/api/deal/${dealId}/lost-requests/${data.requestId}/${data.decision}`,
          { reviewNotes: data.reviewNotes || null },
        )
      ).data,
    onSuccess: (_, data) => {
      invalidate();
      toast.success(
        data.decision === "approve"
          ? "Pengajuan Lost disetujui."
          : "Pengajuan Lost ditolak.",
      );
    },
    onError: (error) =>
      toast.error(message(error, "Gagal memverifikasi Lost Deal.")),
  });

  return {
    history: history.data ?? [],
    payments: payments.data ?? [],
    lostRequests: lostRequests.data ?? [],
    isWorkflowLoading:
      history.isLoading || payments.isLoading || lostRequests.isLoading,
    addPayment: addPayment.mutateAsync,
    requestLost: requestLost.mutateAsync,
    reviewLost: reviewLost.mutateAsync,
    isAddingPayment: addPayment.isPending,
    isRequestingLost: requestLost.isPending,
    isReviewingLost: reviewLost.isPending,
  };
}
