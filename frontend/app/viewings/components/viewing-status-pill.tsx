import type { Status } from "@/types/status";
import { CalendarCheck2, CheckCircle2, XCircle } from "lucide-react";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FALLBACK_COLOR = "#64748B";

export function resolveStatusColor(
  status?: Pick<Status, "color"> | null,
): string {
  return status?.color && HEX_COLOR.test(status.color)
    ? status.color
    : FALLBACK_COLOR;
}

/** Soft pill: tinted background with the status color as text, icon chosen by status role. */
export function ViewingStatusPill({ status }: { status?: Status | null }) {
  if (!status?.name) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const color = resolveStatusColor(status);
  const Icon = status.isFailedStatus
    ? XCircle
    : status.isClosingStatus
      ? CheckCircle2
      : CalendarCheck2;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap capitalize"
      style={{ backgroundColor: `${color}1F`, color }}
    >
      <Icon className="h-3.5 w-3.5" />
      {status.name}
    </span>
  );
}
