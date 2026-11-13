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
      <CardContent className="flex h-[76px] items-center gap-3 p-3">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${iconContainerClassName}`}
        >
          <div className={iconClassName}>{icon}</div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-[#667085]">{title}</p>

          <div className="mt-0.5 flex items-center justify-between gap-2">
            <h3 className="text-[22px] font-bold leading-none text-[#101828]">
              {value}
            </h3>

            {percentageText && (
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${percentageClassName}`}
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
