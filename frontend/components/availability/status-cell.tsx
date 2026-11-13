import { formatNumber } from "./format";
import { statusConfig } from "./status-config";
import type { UnitStatus } from "./types";

export function StatusCell({
  value,
  type,
}: {
  value: number;
  type: UnitStatus;
}) {
  const config = statusConfig[type];

  return (
    <div
      className={`rounded-md px-2 py-2 text-center font-medium ${config.bg} ${config.color}`}
    >
      {formatNumber(value)}
    </div>
  );
}
