import Link from "next/link";
import { unitPath } from "../routes";
import { formatRupiah } from "./format";
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
      href={unitPath(availabilityId, clusterId, unit.id)}
      className={`relative min-h-[118px] overflow-hidden rounded-xl border border-[#e6eaf0] p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${sold ? "unit-sold-pattern" : "bg-white"}`}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2">
          <UnitStatusBadge status={unit.status} />
          <UnitBlockBadge block={unit.block} />
        </div>
        <h3 className="mt-2 text-[15px] font-bold leading-none text-[#111827]">
          {unit.code}
        </h3>
        <p className="mt-1 text-[10px] font-medium text-[#667085]">
          Type {unit.type}
        </p>
        <div className="mt-2 border-t border-[#e9edf1] pt-2">
          <div className="flex items-center gap-1.5">
            <p
              className={`text-[12px] font-semibold ${sold ? "text-[#667085] line-through" : "text-[#111827]"}`}
            >
              {formatRupiah(unit.price)}
            </p>
            {unit.discount && !sold && (
              <span className="flex size-4 items-center justify-center rounded bg-[#20be43] text-[8px] font-bold text-white">
                %
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
