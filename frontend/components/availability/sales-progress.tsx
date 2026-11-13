import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { formatNumber } from "./format";

export function SalesProgress({
  sold,
  total,
}: {
  sold: number;
  total: number;
}) {
  const percentage = total > 0 ? (sold / total) * 100 : 0;
  const remaining = total - sold;

  return (
    <Card className="h-full shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          Sales Progress
          <Info className="size-3.5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="text-right">
          <h2 className="text-3xl font-bold tracking-tight">
            {percentage.toFixed(1)}%
          </h2>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="grid grid-cols-2 divide-x">
          <div className="pr-4">
            <p className="text-xs text-muted-foreground">Sold Units</p>
            <h3 className="mt-1 text-xl font-bold">{formatNumber(sold)}</h3>
          </div>

          <div className="pl-4">
            <p className="text-xs text-muted-foreground">Remaining Units</p>
            <h3 className="mt-1 text-xl font-bold">
              {formatNumber(remaining)}
            </h3>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
