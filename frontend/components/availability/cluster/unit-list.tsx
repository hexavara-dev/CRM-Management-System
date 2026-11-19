import Link from "next/link";
import Image from "next/image";
import { Building2 } from "lucide-react";
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
          href={unitPath(availabilityId, clusterId, unit.code)}
          key={unit.id}
          className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[#edf0f3] bg-white px-4 py-3 last:border-b-0"
        >
          <div className="flex items-center gap-4">
            {unit.image ? (
              <Image
                src={unit.image}
                alt={`Unit ${unit.code}`}
                width={56}
                height={44}
                unoptimized
                className="h-11 w-14 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-11 w-14 items-center justify-center rounded-md bg-[#eef4f8]">
                <Building2 className="size-4 text-[#2695ff]/45" />
              </div>
            )}
            <UnitStatusBadge status={unit.status} />
            <div>
              <p className="text-[13px] font-bold">{unit.code}</p>
              <p className="text-[10px] text-[#667085]">Type {unit.type}</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <UnitBlockBadge block={unit.location} level={unit.locationLevel} />
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
