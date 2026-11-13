import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "./format";
import { statusConfig } from "./status-config";
import type { UnitStatus } from "./types";

export function UnitDistribution({
  available,
  processing,
  reserved,
  sold,
  total,
}: {
  available: number;
  processing: number;
  reserved: number;
  sold: number;
  total: number;
}) {
  const segments = [
    { key: "available", value: available, color: "#22c55e" },
    { key: "processing", value: processing, color: "#3b82f6" },
    { key: "reserved", value: reserved, color: "#f59e0b" },
    { key: "sold", value: sold, color: "#f87171" },
  ];

  let current = 0;

  const gradient = segments
    .map((segment) => {
      const start = current;
      const percentage = total > 0 ? (segment.value / total) * 100 : 0;
      current += percentage;

      return `${segment.color} ${start}% ${current}%`;
    })
    .join(", ");

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
          <div
            className="relative size-36 shrink-0 rounded-full"
            style={{
              background: `conic-gradient(${gradient})`,
            }}
          >
            <div className="absolute inset-[22px] flex flex-col items-center justify-center rounded-full bg-background">
              <span className="text-xl font-bold">{formatNumber(total)}</span>
              <span className="text-xs text-muted-foreground">Units</span>
            </div>
          </div>

          {/* Legend */}
          <div className="w-full space-y-3">
            {segments.map((segment) => {
              const config = statusConfig[segment.key as UnitStatus];

              const percentage = total > 0 ? (segment.value / total) * 100 : 0;

              return (
                <div
                  key={segment.key}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{
                        backgroundColor: segment.color,
                      }}
                    />

                    <span className="text-xs text-muted-foreground">
                      {config.label}
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
