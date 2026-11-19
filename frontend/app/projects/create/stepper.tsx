"use client";

import { cn } from "@/lib/utils";

export const STEPS = ["Information", "Unit Type", "Loc Hierarchy", "Preview"];

export function Stepper({ current, onStepChange, clickable = false }: { current: number; onStepChange?: (step: number) => void; clickable?: boolean }) {
  return (
    <ol className="flex items-center gap-2 text-[11px]">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <button
            type="button"
            disabled={!clickable}
            onClick={() => onStepChange?.(i)}
            className={cn(
              "grid size-5 place-items-center rounded-full border text-[10px] font-semibold",
              clickable && "cursor-pointer hover:ring-2 hover:ring-[#1980C0]/20",
              !clickable && "cursor-default",
              i === current ? "border-[#1980C0] bg-[#1980C0] text-white" : i < current ? "border-[#1980C0] text-[#1980C0]" : "border-[#D9D9DE] text-[#9CA3AF]",
            )}
          >
            {i + 1}
          </button>
          <button type="button" disabled={!clickable} onClick={() => onStepChange?.(i)} className={cn(i === current ? "font-medium text-[#1f1f1f]" : "text-[#9CA3AF]", clickable && "cursor-pointer")}>{s}</button>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-[#D9D9DE]" />}
        </li>
      ))}
    </ol>
  );
}
