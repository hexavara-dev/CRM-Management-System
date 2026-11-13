import type { UnitStatus } from "./types";

export const statusConfig: Record<
  UnitStatus,
  { label: string; color: string; bg: string }
> = {
  available: {
    label: "Available",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  processing: {
    label: "Reservation/Processing",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  reserved: {
    label: "Reserved",
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  sold: {
    label: "Sold",
    color: "text-red-500",
    bg: "bg-red-50",
  },
};
