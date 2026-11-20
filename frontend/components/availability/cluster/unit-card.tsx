import { Building2 } from "lucide-react";
import Image from "next/image";
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
      className={`relative overflow-hidden rounded-xl border border-[#e6eaf0] text-left transition hover:-translate-y-0.5 hover:shadow-sm ${sold ? "unit-sold-pattern" : "bg-white"}`}
    >
      {unit.image ? (
        <Image
          src={unit.image}
          alt={`Unit ${unit.code}`}
          width={480}
          height={240}
          unoptimized
          className="h-28 w-full object-cover"
        />
      ) : (
        <div className="flex h-28 items-center justify-center bg-gradient-to-br from-[#e8f4ff] to-[#eef2f6]">
          <Building2 className="size-8 text-[#2695ff]/45" />
        </div>
      )}
      <div className="relative z-10 p-3">
        <div className="flex items-center justify-between gap-2">
          <UnitStatusBadge status={unit.status} />
          <UnitBlockBadge block={unit.location} level={unit.locationLevel} />
        </div>
        <h3 className="mt-2 text-[15px] font-bold leading-none text-[#111827]">
          {unit.code}
        </h3>
        <p className="mt-1 text-[10px] font-medium text-[#667085]">
          {formatUnitType(unit.type)}
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
