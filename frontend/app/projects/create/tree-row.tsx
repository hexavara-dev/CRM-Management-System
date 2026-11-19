import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

export function TreeRow({ label, depth, open, hasKids, active, onToggle, onSelect, onEdit, actions }: { label: string; depth: number; open: boolean; hasKids: boolean; active: boolean; onToggle: () => void; onSelect: () => void; onEdit?: () => void; actions?: React.ReactNode }) {
  return (
    <div className="flex w-full items-center gap-1 pr-2 text-xs" style={{ paddingLeft: 8 + depth * 20 }}>
      <button type="button" aria-label="Toggle" onClick={onToggle} className={cn("grid size-4 cursor-pointer place-items-center text-[#6b6b6b]", !hasKids && "invisible")}>
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      </button>
      <button type="button" onClick={onSelect} onDoubleClick={onEdit} className={cn("flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-left", active && "bg-[#F1F5F9] font-medium hover:bg-[#F1F5F9]", !active && "hover:bg-[#F8FAFC]")}>
        <Folder className="size-3.5 shrink-0 text-[#1980C0]" />
        <span className="truncate">{label}</span>
      </button>
      {actions}
    </div>
  );
}
