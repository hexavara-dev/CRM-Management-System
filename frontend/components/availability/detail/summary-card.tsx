import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

type SummaryCardProps = {
  icon: ReactNode;
  title: string;
  value: number;
  percentageText?: string;
  iconClassName?: string;
  iconContainerClassName?: string;
  percentageClassName?: string;
};

export function AvailabilitySummaryCard({
  icon,
  title,
  value,
  percentageText,
  iconClassName,
  iconContainerClassName,
  percentageClassName,
}: SummaryCardProps) {
  return (
    <Card className="rounded-xl border-[#edf0f4] shadow-none">
      <CardContent className="flex items-center gap-3 px-3.5 py-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconContainerClassName}`}
        >
          <div className={iconClassName}>{icon}</div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-[#1e3a8a]">{title}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <h3 className="text-2xl font-bold leading-none text-[#1e1b8a]">
              {value.toLocaleString("id-ID")}
            </h3>

            {percentageText && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${percentageClassName}`}
              >
                {percentageText}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
