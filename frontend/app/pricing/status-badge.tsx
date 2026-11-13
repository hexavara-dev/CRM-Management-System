import { cn } from "@/lib/utils";
import type { AdjustmentStatus, UnitStatus } from "@/hooks/use-unit-prices";

const UNIT_STYLE: Record<UnitStatus, string> = {
  AVAILABLE: "border-[#D9822B] text-[#D9822B] bg-[#FFF1E0]",
  RESERVED: "border-[#1980C0] text-[#1980C0] bg-[#E5F1FA]",
  BOOKED: "border-[#7C5CD6] text-[#7C5CD6] bg-[#F1ECFF]",
  SOLD: "border-[#1E9E55] text-[#1E9E55] bg-[#E6F6EC]",
  BLOCKED: "border-[#6b6b6b] text-[#6b6b6b] bg-[#F3F3F3]",
};

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  BOOKED: "Booked",
  SOLD: "Sold",
  BLOCKED: "Blocked",
};

const ADJUSTMENT_STYLE: Record<AdjustmentStatus, string> = {
  PENDING: "border-[#D9822B] text-[#D9822B] bg-[#FFF1E0]",
  APPROVED: "border-[#1E9E55] text-[#1E9E55] bg-[#E6F6EC]",
  REJECTED: "border-[#D64545] text-[#D64545] bg-[#FDECEC]",
};

const ADJUSTMENT_LABEL: Record<AdjustmentStatus, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

const base = "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium";

export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  return <span className={cn(base, UNIT_STYLE[status])}>{UNIT_STATUS_LABEL[status]}</span>;
}

export function AdjustmentStatusBadge({ status }: { status: AdjustmentStatus }) {
  return <span className={cn(base, ADJUSTMENT_STYLE[status])}>{ADJUSTMENT_LABEL[status]}</span>;
}
