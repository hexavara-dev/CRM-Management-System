import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

export function TreeRow({ label, depth, open, hasKids, active, onToggle, onSelect, actions }: { label: string; depth: number; open: boolean; hasKids: boolean; active: boolean; onToggle: () => void; onSelect: () => void; actions?: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-1 rounded-md py-1.5 pr-2 text-xs", active && "bg-[#F1F5F9] font-medium")} style={{ paddingLeft: 8 + depth * 20 }}>
      <button type="button" aria-label="Toggle" onClick={onToggle} className={cn("grid size-4 place-items-center text-[#6b6b6b]", !hasKids && "invisible")}>
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 items-center gap-1.5 text-left">
        <Folder className="size-3.5 shrink-0 text-[#1980C0]" />
        <span className="truncate">{label}</span>
      </button>
      {actions}
    </div>
  );
}
