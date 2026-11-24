import type { ReactNode } from "react";

import type { AvailabilityMetricVariant } from "./types";

type ClusterMetricProps = {
  icon: ReactNode;
  title: string;
  value: number;
  percentageText: string;
  variant: AvailabilityMetricVariant;
};

const variantStyles = {
  available: {
    container: "bg-[#f2fff4]",
    icon: "text-[#28b744]",
    value: "text-[#101828]",
    percentage: "text-[#22a43c]",
  },
  reserved: {
    container: "bg-[#fff9ec]",
    icon: "text-[#ff9f1a]",
    value: "text-[#101828]",
    percentage: "text-[#dc8a00]",
  },
  sold: {
    container: "bg-[#fff3f3]",
    icon: "text-[#ff4d5e]",
    value: "text-[#101828]",
    percentage: "text-[#ff3347]",
  },
} satisfies Record<
  AvailabilityMetricVariant,
  {
    container: string;
    icon: string;
    value: string;
    percentage: string;
  }
>;

export function ClusterAvailabilityMetric({
  icon,
  title,
  value,
  percentageText,
  variant,
}: ClusterMetricProps) {
  const style = variantStyles[variant];

  return (
    <div
      className={`flex min-w-0 flex-col gap-0.5 rounded-lg px-2.5 py-1.5 ${style.container}`}
    >
      <div className={`flex min-w-0 max-w-full items-center gap-1.5 ${style.icon}`}>
        <span className="shrink-0">{icon}</span>
        <p className="truncate text-xs font-semibold">{title}</p>
      </div>
      <div className="flex items-baseline justify-between gap-1.5">
        <p className={`text-base font-bold leading-tight ${style.value}`}>
          {value.toLocaleString("id-ID")}
        </p>
        <p className={`text-[11px] font-semibold ${style.percentage}`}>
          {percentageText}%
        </p>
      </div>
    </div>
  );
}
