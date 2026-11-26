import type { UnitSummary } from "@/hooks/use-projects";

// Backend hanya menyimpan aktif/nonaktif (`products.is_active`).
export type Status = "Active" | "Inactive";

export const statusOf = (isActive: boolean): Status => (isActive ? "Active" : "Inactive");

export const STATUS_STYLE: Record<Status, string> = {
  Active: "bg-[#E6F6EC] text-[#1E9E55]",
  Inactive: "bg-[#FDEBEA] text-[#D64545]",
};

const EMPTY_SUMMARY: UnitSummary = { total: 0, available: 0, reserved: 0, booked: 0, sold: 0, blocked: 0 };

/** Total slot berasal dari stock tipe; status hanya menghitung unit yang sudah dibuat. */
export const projectMetrics = (summary: UnitSummary | undefined, totalSlots: number) => {
  const s = summary ?? EMPTY_SUMMARY;
  return {
    units: totalSlots,
    sold: s.sold,
    reserved: s.reserved + s.booked,
    available: s.available,
    soldPct: totalSlots ? Math.round((s.sold / totalSlots) * 100) : 0,
  };
};

type LocationParts = { province?: string | null; city?: string | null; subdistrict?: string | null; village?: string | null; address?: string | null; postalCode?: string | null };
const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ");

export const shortLocation = (p: LocationParts) => join([p.subdistrict, p.city]) || join([p.village, p.province]);

export const fullAddress = (p: LocationParts) => join([p.address, p.village, p.subdistrict, p.city, p.province, p.postalCode]);
