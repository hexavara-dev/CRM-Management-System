import { useAuth } from "@/components/auth/auth-provider";
import type {
  ReservationListResponse,
  ReservationStatusCode,
} from "@/components/reservation/reservation-types";
import api from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import type {
  AvailableReservationUnit,
  CreateReservationPayload,
  Reservation,
  UpdateReservationPayload,
} from "@/components/reservation/reservation-types";

export type ReservationQueryFilters = {
  page: number;
  limit: number;
  search?: string;
  project?: string;
  cluster?: string;
  block?: string;
  status?: ReservationStatusCode;
  period?: "today" | "week" | "month";
};

export const reservationErrorMessage = (error: unknown) =>
  (error as AxiosError<{ error?: string }>)?.response?.data?.error ??
  "Gagal memuat data reservasi.";

export function useReservations(filters: ReservationQueryFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["reservations", user?.tenantId, filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(
          ([, value]) => value !== undefined && value !== "",
        ),
      );
      const response = await api.get<ReservationListResponse>(
        "/api/reservations",
        { params },
      );
      return response.data;
    },
    enabled: !!user,
    placeholderData: (previous) => previous,
  });
}

export function useReservationDetail(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["reservation-detail", user?.tenantId, id],
    queryFn: async () => (await api.get<Reservation>(`/api/reservations/${id}`)).data,
    enabled: !!user && !!id,
  });
}

export function useUpdateReservation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateReservationPayload }) =>
      (await api.patch<Reservation>(`/api/reservations/${id}`, payload)).data,
    onSuccess: (reservation) => {
      queryClient.setQueryData(["reservation-detail", user?.tenantId, reservation.id], reservation);
      queryClient.invalidateQueries({ queryKey: ["reservation-detail"] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["reservation-available-units"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["availability-overview"] });
      queryClient.invalidateQueries({ queryKey: ["availability-project"] });
      queryClient.invalidateQueries({ queryKey: ["availability-cluster"] });
      queryClient.invalidateQueries({ queryKey: ["availability-unit"] });
      toast.success("Reservasi berhasil diperbarui.");
    },
    onError: (error) => toast.error(reservationErrorMessage(error)),
  });
}

export function useAvailableReservationUnits(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["reservation-available-units", user?.tenantId, projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const params = { page: 1, limit: 100, productId: projectId, status: "AVAILABLE" };
      const firstPage = (await api.get<{
        data: AvailableReservationUnit[];
        meta: { totalPages: number };
      }>("/api/units", { params })).data;
      if (firstPage.meta.totalPages <= 1) return firstPage.data;

      const remainingPages = await Promise.all(
        Array.from({ length: firstPage.meta.totalPages - 1 }, async (_, index) =>
          api.get<{ data: AvailableReservationUnit[] }>("/api/units", {
            params: { ...params, page: index + 2 },
          }),
        ),
      );
      return [
        ...firstPage.data,
        ...remainingPages.flatMap((response) => response.data.data),
      ];
    },
    enabled: !!user && !!projectId,
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateReservationPayload) =>
      (await api.post<Reservation>("/api/reservations", payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["reservation-available-units"] });
      queryClient.invalidateQueries({ queryKey: ["availability-overview"] });
      queryClient.invalidateQueries({ queryKey: ["availability-project"] });
      queryClient.invalidateQueries({ queryKey: ["availability-cluster"] });
      queryClient.invalidateQueries({ queryKey: ["availability-unit"] });
      toast.success("Reservasi berhasil dibuat.");
    },
    onError: (error) => toast.error(reservationErrorMessage(error)),
  });
}
