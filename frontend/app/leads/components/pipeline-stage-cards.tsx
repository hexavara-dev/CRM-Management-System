"use client";

import type { PipelineStage } from "@/hooks/use-pipeline-stages";
import { cn } from "@/lib/utils";
import { Check, FileCheck2, Flag, LockKeyhole } from "lucide-react";

export function PipelineStageCards({
  stages,
  currentStageId,
  selectedStageId,
  onSelect,
  disabled = false,
  showCounts = false,
}: {
  stages: PipelineStage[];
  currentStageId?: string;
  selectedStageId?: string;
  onSelect?: (stage: PipelineStage) => void;
  disabled?: boolean;
  showCounts?: boolean;
}) {
  const ordered = [...stages]
    .filter((stage) => stage.isActive)
    .sort((a, b) => a.position - b.position);

  if (ordered.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
        Belum ada konfigurasi Pipeline Leads yang aktif.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ordered.map((stage) => {
        const color = stage.color || "#667085";
        const isCurrent = stage.id === currentStageId;
        const isSelected = stage.id === selectedStageId;
        const Tag = onSelect ? "button" : "article";
        return (
          <Tag
            key={stage.id}
            {...(onSelect
              ? {
                  type: "button" as const,
                  disabled,
                  onClick: () => onSelect(stage),
                }
              : {})}
            className={cn(
              "relative min-h-28 overflow-hidden rounded-xl border bg-white p-3 text-left transition",
              onSelect &&
                "hover:-translate-y-0.5 hover:shadow-sm disabled:pointer-events-none disabled:opacity-60",
              (isCurrent || isSelected) && "ring-2 ring-offset-1",
            )}
            style={{
              borderColor: `${color}55`,
              ...(isCurrent || isSelected
                ? { boxShadow: `0 0 0 2px ${color}` }
                : {}),
            }}
          >
            <span
              className="absolute inset-x-0 top-0 h-1"
              style={{ backgroundColor: color }}
            />
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[#101828]">
                  {stage.name}
                </span>
                <span className="mt-1 line-clamp-2 block text-xs text-[#667085]">
                  {stage.description || "Tanpa deskripsi tahapan."}
                </span>
              </span>
              {(isCurrent || isSelected) && (
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: color }}
                >
                  <Check className="size-3.5" />
                </span>
              )}
            </span>
            <span className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-[#475467]">
              <span className="rounded-full bg-[#F2F4F7] px-2 py-1">
                Probabilitas {stage.probability}%
              </span>
              {stage.isDefaultStage && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                  <Flag className="size-3" /> Default
                </span>
              )}
              {stage.isTerminalStage && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                  <LockKeyhole className="size-3" /> Final
                </span>
              )}
              {stage.evidences.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                  <FileCheck2 className="size-3" /> {stage.evidences.length}{" "}
                  evidence
                </span>
              )}
              {showCounts && (
                <span className="rounded-full bg-[#F2F4F7] px-2 py-1">
                  {stage.itemCount} Lead
                </span>
              )}
            </span>
          </Tag>
        );
      })}
    </div>
  );
}
