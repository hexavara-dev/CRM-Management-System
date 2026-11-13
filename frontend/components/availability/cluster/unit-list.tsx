import Link from "next/link";
import { unitPath } from "../routes";
import { formatRupiah } from "./format";
import type { ClusterUnit, ClusterView } from "./types";
import { UnitBlockBadge, UnitStatusBadge } from "./unit-badges";
import { ClusterUnitCard } from "./unit-card";

type UnitListProps = {
  units: ClusterUnit[];
  view: ClusterView;
  availabilityId: string;
  clusterId: string;
};

export function ClusterUnitList({
  units,
  view,
  availabilityId,
  clusterId,
}: UnitListProps) {
  if (view === "grid") {
    return (
      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {units.map((unit) => (
          <ClusterUnitCard
            key={unit.id}
            unit={unit}
            availabilityId={availabilityId}
            clusterId={clusterId}
          />
        ))}
      </section>
    );
  }

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-[#e5e9ef]">
      {units.map((unit) => (
        <Link
          href={unitPath(availabilityId, clusterId, unit.id)}
          key={unit.id}
          className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[#edf0f3] bg-white px-4 py-3 last:border-b-0"
        >
          <div className="flex items-center gap-4">
            <UnitStatusBadge status={unit.status} />
            <div>
              <p className="text-[13px] font-bold">{unit.code}</p>
              <p className="text-[10px] text-[#667085]">Type {unit.type}</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <UnitBlockBadge block={unit.block} />
            <span
              className={`text-[12px] font-semibold ${
                unit.status === "sold" ? "text-[#667085] line-through" : ""
              }`}
            >
              {formatRupiah(unit.price)}
            </span>
          </div>
        </Link>
      ))}
    </section>
  );
}
