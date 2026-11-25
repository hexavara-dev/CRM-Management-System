import { useAuth } from "@/components/auth/auth-provider";

export const formatDateTime = (date: Date) => {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const formatRupiah = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const COMPACT_RUPIAH_UNITS = [
  { divisor: 1e3, suffix: "Rb" },
  { divisor: 1e6, suffix: "Jt" },
  { divisor: 1e9, suffix: "M" },
  { divisor: 1e12, suffix: "T" },
] as const;

/** Singkatan rupiah ala Indonesia: 900.000.000 → "Rp 900 Jt", 1.500.000.000 → "Rp 1,5 M". Di bawah 1.000 tetap utuh. */
export const formatRupiahCompact = (value: number) => {
  const absolute = Math.abs(value);
  let index = -1;
  COMPACT_RUPIAH_UNITS.forEach((unit, position) => {
    if (absolute >= unit.divisor) index = position;
  });
  if (index === -1) return formatRupiah(value);
  const round = (n: number) => Math.round(n * 100) / 100;
  // Hindari "1000 Jt": jika pembulatan menyentuh 1000, naik satu satuan.
  if (round(absolute / COMPACT_RUPIAH_UNITS[index].divisor) >= 1000 && index < COMPACT_RUPIAH_UNITS.length - 1) index += 1;
  const unit = COMPACT_RUPIAH_UNITS[index];
  const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(round(absolute / unit.divisor));
  return `${value < 0 ? "-" : ""}Rp ${number} ${unit.suffix}`;
};

export function formatMillisecondsToDays(ms: number): string {
  if (!ms || ms === 0) return "0";
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  return days.toString();
}

export const isAdmin = () => {
  const { user } = useAuth();
  return user?.role === "owner";
};
