import { Card, CardContent } from "@/components/ui/card";
import type { ElementType } from "react";
import { formatNumber } from "./format";

export function SummaryCard({
  title,
  value,
  percentage,
  icon: Icon,
  color,
  bg,
}: {
  title: string;
  value: number;
  percentage?: number;
  icon: ElementType;
  color: string;
  bg: string;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex items-center gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${bg}`}
        >
          <Icon className={`size-5 ${color}`} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold tracking-tight">
              {formatNumber(value)}
            </h3>
            {percentage !== undefined && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                  percentage >= 50
                    ? "bg-green-50 text-green-600"
                    : "bg-orange-50 text-orange-600"
                }`}
              >
                {percentage.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
