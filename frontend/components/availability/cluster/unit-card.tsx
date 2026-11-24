import Link from "next/link";
import { unitPath } from "../routes";
import { formatRupiah, formatUnitType } from "./format";
import type { ClusterUnit } from "./types";
import { UnitBlockBadge, UnitStatusBadge } from "./unit-badges";

export function ClusterUnitCard({
  unit,
  availabilityId,
  clusterId,
}: {
  unit: ClusterUnit;
  availabilityId: string;
  clusterId: string;
}) {
  const sold = unit.status === "sold";
  return (
    <Link
      href={unitPath(availabilityId, clusterId, unit.code)}
      className={`relative overflow-hidden rounded-2xl border border-[#e6eaf0] text-left transition hover:-translate-y-0.5 hover:shadow-sm ${sold ? "unit-sold-pattern" : "bg-white"}`}
    >
      <div className="relative z-10 p-4">
        <div className="flex items-center justify-between gap-2">
          <UnitStatusBadge status={unit.status} />
          <UnitBlockBadge block={unit.location} level={unit.locationLevel} />
        </div>
        <h3 className="mt-3 text-xl font-bold leading-none text-[#111827]">
          {unit.code}
        </h3>
        <p className="mt-1.5 text-sm font-medium text-[#475467]">
          {formatUnitType(unit.type)}
        </p>
        <div className="mt-3 border-t border-[#e9edf1] pt-3">
          <div className="flex items-center gap-1.5">
            <p
              className={`text-base font-semibold ${sold ? "text-[#667085] line-through" : "text-[#111827]"}`}
            >
              {formatRupiah(unit.price)}
            </p>
            {unit.discount && !sold && (
              <span className="flex size-5 items-center justify-center rounded bg-[#20be43] text-[10px] font-bold text-white">
                %
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
