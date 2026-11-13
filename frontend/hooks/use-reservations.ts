import { useAuth } from "@/components/auth/auth-provider";
import type {
  ReservationListResponse,
  ReservationStatusCode,
} from "@/components/reservation/reservation-types";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

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
