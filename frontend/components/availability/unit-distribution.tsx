"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatNumber } from "./format";
import { statusConfig } from "./status-config";
import type { UnitStatus } from "./types";

export function UnitDistribution({
  available,
  processing,
  reserved,
  sold,
  blocked,
  total,
}: {
  available: number;
  processing: number;
  reserved: number;
  sold: number;
  blocked: number;
  total: number;
}) {
  const segments = [
    { key: "available", value: available, color: "#22c55e" },
    { key: "processing", value: processing, color: "#3b82f6" },
    { key: "reserved", value: reserved, color: "#f59e0b" },
    { key: "sold", value: sold, color: "#f87171" },
    { key: "blocked", value: blocked, color: "#94a3b8" },
    { key: "uncreated", value: Math.max(0, total - available - processing - reserved - sold - blocked), color: "#e4e4e7" },
  ];

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const labelOf = (key: string) =>
    key === "uncreated" ? "Belum Dibuat" : statusConfig[key as UnitStatus].label;

  let current = 0;
  const arcs = segments.map((segment) => {
    const start = current;
    const percentage = total > 0 ? (segment.value / total) * 100 : 0;
    current += percentage;
    return { ...segment, start, percentage };
  });
  const hovered = arcs.find((arc) => arc.key === hoveredKey && arc.value > 0) ?? null;

  return (
    <Card className="h-full shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          Unit Distribution
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col items-center justify-around gap-6 sm:flex-row">
          {/* Donut */}
          <div className="relative size-36 shrink-0">
            <svg viewBox="0 0 36 36" className="size-full -rotate-90" role="img" aria-label="Distribusi unit">
              {total === 0 ? (
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e4e4e7" strokeWidth={4} />
              ) : (
                arcs
                  .filter((arc) => arc.value > 0)
                  .map((arc) => (
                    <circle
                      key={arc.key}
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={hoveredKey === arc.key ? 5 : 4}
                      pathLength={100}
                      strokeDasharray={`${arc.percentage} ${100 - arc.percentage}`}
                      strokeDashoffset={-arc.start}
                      className={cn(
                        "cursor-pointer transition-all",
                        hoveredKey && hoveredKey !== arc.key && "opacity-40",
                      )}
                      onMouseEnter={() => setHoveredKey(arc.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                    >
                      <title>{`${labelOf(arc.key)}: ${formatNumber(arc.value)} (${arc.percentage.toFixed(1)}%)`}</title>
                    </circle>
                  ))
              )}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <span className="text-xl font-bold">{formatNumber(hovered ? hovered.value : total)}</span>
              <span className="w-full truncate text-xs text-muted-foreground">
                {hovered ? labelOf(hovered.key) : "Units"}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="w-full space-y-3">
            {segments.map((segment) => {
              const label = labelOf(segment.key);

              const percentage = total > 0 ? (segment.value / total) * 100 : 0;

              return (
                <div
                  key={segment.key}
                  onMouseEnter={() => setHoveredKey(segment.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={cn(
                    "-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-0.5 transition",
                    hoveredKey === segment.key && "bg-muted",
                    hoveredKey && hoveredKey !== segment.key && "opacity-50",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{
                        backgroundColor: segment.color,
                      }}
                    />

                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">
                      {formatNumber(segment.value)}
                    </span>
                    <span className="w-10 text-right text-xs text-muted-foreground">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
