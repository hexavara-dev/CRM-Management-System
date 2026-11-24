"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "./format";

type Part = "sold" | "remaining";

export function SalesProgress({
  sold,
  total,
}: {
  sold: number;
  total: number;
}) {
  const [hovered, setHovered] = useState<Part | null>(null);
  const percentage = total > 0 ? (sold / total) * 100 : 0;
  const remaining = total - sold;
  const parts: Record<Part, { label: string; value: number; percentage: number }> = {
    sold: { label: "Sold Units", value: sold, percentage },
    remaining: { label: "Remaining Units", value: remaining, percentage: total > 0 ? 100 - percentage : 0 },
  };
  const active = hovered ? parts[hovered] : null;
  const hoverProps = (part: Part) => ({
    onMouseEnter: () => setHovered(part),
    onMouseLeave: () => setHovered(null),
  });
  const dimmed = (part: Part) => hovered !== null && hovered !== part && "opacity-40";

  return (
    <Card className="h-full shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          Sales Progress
          <span title="Persentase unit terjual (Sold) dari total unit.">
            <Info className="size-3.5 text-muted-foreground" />
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="text-right">
          <h2 className="text-3xl font-bold tracking-tight">
            {(active?.percentage ?? percentage).toFixed(1)}%
          </h2>
          <p className="h-4 text-xs text-muted-foreground">{active?.label ?? ""}</p>
        </div>

        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            {...hoverProps("sold")}
            title={`Sold: ${formatNumber(sold)} unit (${percentage.toFixed(1)}%)`}
            className={cn("h-full cursor-pointer rounded-full bg-blue-500 transition-all", dimmed("sold"))}
            style={{ width: `${percentage}%` }}
          />
          <div
            {...hoverProps("remaining")}
            title={`Remaining: ${formatNumber(remaining)} unit (${parts.remaining.percentage.toFixed(1)}%)`}
            className={cn(
              "h-full flex-1 cursor-pointer transition-all",
              hovered === "remaining" && "bg-slate-300",
            )}
          />
        </div>

        <div className="grid grid-cols-2 divide-x">
          <div {...hoverProps("sold")} className={cn("cursor-default pr-4 transition", dimmed("sold"))}>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-blue-500" />
              Sold Units
            </p>
            <h3 className="mt-1 text-xl font-bold">{formatNumber(sold)}</h3>
          </div>

          <div {...hoverProps("remaining")} className={cn("cursor-default pl-4 transition", dimmed("remaining"))}>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-slate-300" />
              Remaining Units
            </p>
            <h3 className="mt-1 text-xl font-bold">
              {formatNumber(remaining)}
            </h3>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
