import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";

/** Metode inventory global company: QUANTITY, UNIT, atau BOTH. */
export type TrackingMode = "QUANTITY" | "UNIT" | "BOTH";

export interface InventoryTracking {
  mode: TrackingMode;
  unitTrackingEnabled: boolean;
  quantityTrackingEnabled: boolean;
  unitCount: number;
  projectCount: number;
}

const KEY = "inventory-tracking";

export function useInventoryTracking() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.tenantId],
    queryFn: async () => (await api.get<InventoryTracking>("/api/company/inventory-tracking")).data,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateInventoryTracking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mode: TrackingMode) =>
      (await api.patch<InventoryTracking>("/api/company/inventory-tracking", { mode })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      toast.success("Metode inventory tracking disimpan");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan metode inventory tracking.")),
  });
}
