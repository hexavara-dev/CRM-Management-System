"use client";

import { cn } from "@/lib/utils";

export const STEPS = ["Information", "Unit Type", "Loc Hierarchy", "Preview"];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 text-[11px]">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full border text-[10px] font-semibold",
              i === current ? "border-[#1980C0] bg-[#1980C0] text-white" : i < current ? "border-[#1980C0] text-[#1980C0]" : "border-[#D9D9DE] text-[#9CA3AF]",
            )}
          >
            {i + 1}
          </span>
          <span className={i === current ? "font-medium text-[#1f1f1f]" : "text-[#9CA3AF]"}>{s}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-[#D9D9DE]" />}
        </li>
      ))}
    </ol>
  );
}
