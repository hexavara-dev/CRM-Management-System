import { Ban, CalendarClock, CalendarDays, House, Tag } from "lucide-react";
import { formatHierarchyLevel } from "./format";
import type { Block, UnitStatus } from "./types";

export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  const config = {
    available: {
      label: "Available",
      className: "bg-[#ebffed] text-[#26a940]",
      icon: <House className="size-4" />,
    },
    reserved: {
      label: "Reserved",
      className: "bg-[#fff3e3] text-[#ef7d00]",
      icon: <CalendarDays className="size-4" />,
    },
    processing: {
      label: "Processing",
      className: "bg-[#e8f2ff] text-[#2378df]",
      icon: <CalendarClock className="size-4" />,
    },
    sold: {
      label: "Sold",
      className: "bg-[#eeeeee] text-[#333333]",
      icon: <Tag className="size-4" />,
    },
    blocked: {
      label: "Blocked",
      className: "bg-[#f2f4f7] text-[#667085]",
      icon: <Ban className="size-4" />,
    },
  };
  const item = config[status];

  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${item.className}`}
    >
      {item.icon}
      {item.label}
    </span>
  );
}

const LOCATION_COLORS = [
  "bg-[#e8eeff] text-[#315cff]",
  "bg-[#fff0df] text-[#b85f00]",
  "bg-[#efe9ff] text-[#6449f5]",
  "bg-[#e8faef] text-[#16803a]",
  "bg-[#e6f8fb] text-[#08788b]",
  "bg-[#ffe9ef] text-[#b4234d]",
  "bg-[#fff7d9] text-[#8a6800]",
  "bg-[#edf1f5] text-[#475467]",
];

export function UnitBlockBadge({
  block,
  level,
}: {
  block: Block;
  level?: string;
}) {
  const hash = [...block].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  const className = LOCATION_COLORS[hash % LOCATION_COLORS.length];
  const levelLabel = level ? formatHierarchyLevel(level) : "Lokasi";
  return (
    <span
      className={`inline-flex h-7 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${className}`}
    >
      {block.toLowerCase().startsWith(`${levelLabel.toLowerCase()} `) ? block : `${levelLabel} ${block}`}
    </span>
  );
}
