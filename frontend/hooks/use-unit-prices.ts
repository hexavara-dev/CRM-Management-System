import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";

export type UnitStatus = "AVAILABLE" | "RESERVED" | "BOOKED" | "SOLD" | "BLOCKED";
export type AdjustmentStatus = "PENDING" | "APPROVED" | "REJECTED";

type Ref = { id: string; name: string };
type UserRef = { id: string; name: string | null } | null;
type Meta = { total: number; page: number; limit: number; totalPages: number };

export interface UnitPriceRow {
  unitId: string;
  code: string;
  name: string | null;
  status: UnitStatus;
  product: Ref;
  variant: Ref & { minPrice: number | null };
  location: Ref & { type: string };
  basePrice: number;
  priceLogTotal: number;
  adjustment: number;
  sellingPrice: number;
  hasPendingAdjustment: boolean;
}

export interface UnitPriceList {
  data: UnitPriceRow[];
  meta: Meta;
  summary: { totalUnits: number; pendingAdjustments: number; date: string };
}

export interface PriceAdjustment {
  id: string;
  unitId: string;
  amount: number;
  priceBefore: number;
  priceAfter: number;
  minPrice: number | null;
  reason: string;
  effectiveDate: string;
  status: AdjustmentStatus;
  requestedBy: UserRef;
  approvedBy: UserRef;
  approvedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  unit?: { id: string; code: string; variant: Ref & { product: Ref } };
}

export interface UnitPriceDetail {
  unitId: string;
  code: string;
  status: UnitStatus;
  product: Ref;
  variant: Ref & { minPrice: number | null };
  location: Ref & { type: string };
  date: string;
  basePrice: number;
  priceLogs: { id: string; categoryId: string | null; adjustmentPrice: number; effectiveStart: string; endDate: string | null; reason: string }[];
  priceLogTotal: number;
  activeAdjustment: PriceAdjustment | null;
  adjustment: number;
  sellingPrice: number;
  pendingAdjustment: PriceAdjustment | null;
}

export type UnitPriceFilters = {
  page: number;
  limit: number;
  search?: string;
  productId?: string;
  variantId?: string;
  categoryId?: string;
  status?: UnitStatus;
};

const KEYS = {
  list: "unit-prices",
  detail: "unit-price",
  history: "unit-price-history",
  adjustments: "unit-price-adjustments",
};

export function useUnitPrices(filters: UnitPriceFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEYS.list, user?.tenantId, filters],
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""));
      return (await api.get<UnitPriceList>("/api/unit-prices", { params })).data;
    },
    enabled: !!user,
    placeholderData: (previous) => previous,
  });
}

export function useUnitPrice(unitId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEYS.detail, user?.tenantId, unitId],
    queryFn: async () => (await api.get<UnitPriceDetail>(`/api/unit-prices/${unitId}`)).data,
    enabled: !!user && !!unitId,
  });
}

export function useUnitPriceHistory(unitId: string | undefined, page: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEYS.history, user?.tenantId, unitId, page],
    queryFn: async () =>
      (
        await api.get<{ data: PriceAdjustment[]; meta: Meta }>(`/api/unit-prices/${unitId}/history`, {
          params: { page, limit: 5 },
        })
      ).data,
    enabled: !!user && !!unitId,
    placeholderData: (previous) => previous,
  });
}

export function usePendingAdjustments(page: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEYS.adjustments, user?.tenantId, "PENDING", page],
    queryFn: async () =>
      (
        await api.get<{ data: PriceAdjustment[]; meta: Meta }>("/api/unit-price-adjustments", {
          params: { status: "PENDING", page, limit: 10 },
        })
      ).data,
    enabled: !!user,
    placeholderData: (previous) => previous,
  });
}

function useInvalidatePrices() {
  const queryClient = useQueryClient();
  return () => Object.values(KEYS).forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
}

export function useCreateAdjustment(unitId: string) {
  const invalidate = useInvalidatePrices();
  return useMutation({
    mutationFn: async (data: { amount: number; reason: string; effectiveDate: string }) =>
      (await api.post<PriceAdjustment>(`/api/unit-prices/${unitId}/adjustments`, data)).data,
    onSuccess: (row) => {
      invalidate();
      toast.success(row.status === "PENDING" ? "Di bawah harga minimum, menunggu approval" : "Harga unit diperbarui");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan penyesuaian harga.")),
  });
}

export function useReviewAdjustment() {
  const invalidate = useInvalidatePrices();
  return useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: "approve" | "reject"; note?: string }) =>
      (await api.post<PriceAdjustment>(`/api/unit-price-adjustments/${id}/${decision}`, note ? { note } : {})).data,
    onSuccess: (row) => {
      invalidate();
      toast.success(row.status === "APPROVED" ? "Penyesuaian disetujui" : "Penyesuaian ditolak");
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal memproses approval.")),
  });
}

// ---------- opsi filter ----------

export function usePriceFilterOptions(productId: string | undefined) {
  const { user } = useAuth();
  const projects = useQuery({
    queryKey: ["unit-price-projects", user?.tenantId],
    queryFn: async () =>
      (await api.get<{ data: Ref[] }>("/api/products", { params: { page: 1, limit: 100 } })).data.data,
    enabled: !!user,
  });
  const project = useQuery({
    queryKey: ["unit-price-project", user?.tenantId, productId],
    queryFn: async () =>
      (
        await api.get<{ variants: Ref[]; categoryId: string }>(`/api/products/${productId}`)
      ).data,
    enabled: !!user && !!productId,
  });
  const locations = useQuery({
    queryKey: ["unit-price-locations", user?.tenantId],
    queryFn: async () =>
      (await api.get<{ data: (Ref & { type: string; parentId: string | null })[] }>("/api/categories")).data.data,
    enabled: !!user,
  });
  return { projects, project, locations };
}

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export const formatSigned = (value: number) => (value > 0 ? `+${formatPrice(value)}` : formatPrice(value));
