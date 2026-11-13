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
      className={`flex min-w-0 flex-1 items-start gap-2 rounded-lg px-2 py-2 ${style.container}`}
    >
      <div className={`mt-0.5 shrink-0 ${style.icon}`}>{icon}</div>

      <div className="min-w-0">
        <p className="text-[9px] font-semibold text-[#667085]">{title}</p>
        <p
          className={`mt-0.5 text-[14px] font-bold leading-none ${style.value}`}
        >
          {value}
        </p>
        <p className={`mt-1 text-[9px] font-semibold ${style.percentage}`}>
          {percentageText}%
        </p>
      </div>
    </div>
  );
}
