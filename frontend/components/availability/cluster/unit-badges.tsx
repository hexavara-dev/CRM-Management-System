import { Ban, CalendarClock, CalendarDays, House, Tag } from "lucide-react";
import type { Block, UnitStatus } from "./types";

export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  const config = {
    available: {
      label: "Available",
      className: "bg-[#ebffed] text-[#26a940]",
      icon: <House className="size-3" />,
    },
    reserved: {
      label: "Reserved",
      className: "bg-[#fff3e3] text-[#ef7d00]",
      icon: <CalendarDays className="size-3" />,
    },
    processing: {
      label: "Processing",
      className: "bg-[#e8f2ff] text-[#2378df]",
      icon: <CalendarClock className="size-3" />,
    },
    sold: {
      label: "Sold",
      className: "bg-[#eeeeee] text-[#333333]",
      icon: <Tag className="size-3" />,
    },
    blocked: {
      label: "Blocked",
      className: "bg-[#f2f4f7] text-[#667085]",
      icon: <Ban className="size-3" />,
    },
  };
  const item = config[status];

  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-[9px] font-semibold ${item.className}`}
    >
      {item.icon}
      {item.label}
    </span>
  );
}

export function UnitBlockBadge({ block }: { block: Block }) {
  const className =
    block === "A1"
      ? "bg-[#e8eeff] text-[#315cff]"
      : block === "A2"
        ? "bg-[#fff0df] text-[#f27d00]"
        : "bg-[#efe9ff] text-[#6449f5]";
  return (
    <span
      className={`rounded-full px-2 py-1 text-[9px] font-semibold ${className}`}
    >
      Blok {block}
    </span>
  );
}
