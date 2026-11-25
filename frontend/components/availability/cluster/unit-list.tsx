import { Building2, SearchX } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AvailabilityEmptyState } from "../availability-empty-state";
import { unitPath } from "../routes";
import { formatRupiah, formatUnitType } from "./format";
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
  if (units.length === 0) {
    return (
      <AvailabilityEmptyState
        compact
        className="mt-4"
        icon={<SearchX className="size-5" />}
        title="Unit tidak ditemukan"
        description="Tidak ada unit yang sesuai dengan pencarian atau filter saat ini. Ubah kata pencarian atau pilih filter lain."
      />
    );
  }

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
    <section className="mt-4 overflow-hidden rounded-xl border border-[#e5e9ef] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-[11px]">
          <thead className="bg-[#f7f9fb] text-[#475467]">
            <tr className="border-b border-[#e5e9ef]">
              <th className="px-4 py-3 font-semibold">Unit</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Tipe</th>
              <th className="px-3 py-3 font-semibold">Varian</th>
              <th className="px-3 py-3 font-semibold">Lokasi</th>
              <th className="px-3 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 text-right font-semibold">Harga</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr
                key={unit.id}
                className="border-b border-[#edf0f3] transition-colors last:border-b-0 hover:bg-[#fbfdff]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={unitPath(availabilityId, clusterId, unit.id)}
                    className="flex w-fit items-center gap-3 font-semibold text-[#101828] hover:text-[#1684ff]"
                  >
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
                      <span className="flex h-11 w-14 items-center justify-center rounded-md bg-[#eef4f8]">
                        <Building2 className="size-4 text-[#2695ff]/45" />
                      </span>
                    )}
                    {unit.code}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <UnitStatusBadge status={unit.status} />
                </td>
                <td className="px-3 py-3 font-medium text-[#344054]">
                  {formatUnitType(unit.type)}
                </td>
                <td className="px-3 py-3 text-[#667085]">{unit.variant}</td>
                <td className="px-3 py-3">
                  <UnitBlockBadge
                    block={unit.location}
                    level={unit.locationLevel}
                  />
                </td>
                <td className="px-3 py-3 text-[#667085]">
                  {unit.customer ?? "—"}
                </td>
                <td
                  className={`px-4 py-3 text-right text-[12px] font-semibold ${
                    unit.status === "sold"
                      ? "text-[#667085] line-through"
                      : "text-[#101828]"
                  }`}
                >
                  {formatRupiah(unit.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
