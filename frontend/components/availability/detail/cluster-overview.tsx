"use client";

import { ChevronRight, Grid2X2, Layers3, List } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AvailabilityEmptyState } from "@/components/availability/availability-empty-state";
import { formatHierarchyLevel } from "@/components/availability/cluster/format";
import { formatNumber } from "@/components/availability/format";
import { clusterPath } from "@/components/availability/routes";
import { StatusCell } from "@/components/availability/status-cell";

import { ClusterAvailabilityCard } from "./cluster-card";
import { percentage } from "./percentage";
import type { ClusterAvailability } from "./types";

type ClusterOverviewProps = {
  clusters: ClusterAvailability[];
  availabilityId: string;
  level?: string | null;
  /** Foto proyek, dipakai sebagai banner kartu cluster. */
  image?: string | null;
};

type HierarchyView = "grid" | "list";

export function ClusterAvailabilityOverview({
  clusters,
  availabilityId,
  level,
  image,
}: ClusterOverviewProps) {
  const [view, setView] = useState<HierarchyView>("grid");
  const levelLabel = level ? formatHierarchyLevel(level) : "Hierarchy";

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#101828]">
            {levelLabel} Overview
          </h2>
          <p className="mt-1 text-sm text-[#475467]">
            Ringkasan ketersediaan unit berdasarkan hierarchy project
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Tampilan grid"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={`flex size-10 items-center justify-center rounded-xl border transition-colors ${
              view === "grid"
                ? "border-[#258bff] bg-[#eff7ff] text-[#258bff]"
                : "border-[#e3e7ec] bg-white text-[#64748b] hover:bg-muted"
            }`}
          >
            <Grid2X2 className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Tampilan tabel"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`flex size-10 items-center justify-center rounded-xl border transition-colors ${
              view === "list"
                ? "border-[#258bff] bg-[#eff7ff] text-[#258bff]"
                : "border-[#e3e7ec] bg-white text-[#64748b] hover:bg-muted"
            }`}
          >
            <List className="size-5" />
          </button>
        </div>
      </div>

      {clusters.length > 0 && view === "grid" && (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clusters.map((cluster) => (
            <ClusterAvailabilityCard
              key={cluster.id}
              cluster={cluster}
              availabilityId={availabilityId}
              image={image}
            />
          ))}
        </div>
      )}

      {clusters.length > 0 && view === "list" && (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#e5e9ef] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-surface text-[#475467]">
                <tr className="border-b border-[#e5e9ef]">
                  <th className="px-4 py-3 font-semibold">Hierarchy</th>
                  <th className="px-3 py-3 font-semibold">Level</th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Total Unit
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">Child</th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Available
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Processing
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Reserved
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">Sold</th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Blocked
                  </th>
                  <th className="px-3 py-3 font-semibold">Availability</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((cluster) => {
                  const availabilityPercentage = percentage(
                    cluster.available,
                    cluster.units,
                  );

                  return (
                    <tr
                      key={cluster.id}
                      className="border-b border-[#edf0f3] transition-colors last:border-b-0 hover:bg-[#fbfdff]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={clusterPath(availabilityId, cluster.code)}
                          className="group flex w-fit items-center gap-2.5 font-semibold text-[#101828]"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eef7ff]">
                            <Layers3 className="size-4 text-[#2695ff]" />
                          </span>
                          <span className="group-hover:text-[#1684ff] group-hover:underline">
                            {cluster.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[#475467]">
                        {formatHierarchyLevel(cluster.level)}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-[#344054]">
                        {formatNumber(cluster.units)}
                      </td>
                      <td className="px-3 py-3 text-center text-[#667085]">
                        {formatNumber(cluster.children)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusCell
                          value={cluster.available}
                          type="available"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <StatusCell
                          value={cluster.processing}
                          type="processing"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <StatusCell value={cluster.reserved} type="reserved" />
                      </td>
                      <td className="px-3 py-3">
                        <StatusCell value={cluster.sold} type="sold" />
                      </td>
                      <td className="px-3 py-3">
                        <StatusCell value={cluster.blocked} type="blocked" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#edf0f3]">
                            <div
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${availabilityPercentage}%` }}
                            />
                          </div>
                          <span className="font-semibold text-[#344054]">
                            {availabilityPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={clusterPath(availabilityId, cluster.code)}
                          aria-label={`Buka ${cluster.name}`}
                          className="inline-flex rounded-md border border-[#dfe4ea] p-1.5 text-[#344054] hover:bg-muted"
                        >
                          <ChevronRight className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {clusters.length === 0 && (
        <AvailabilityEmptyState
          compact
          className="mt-4"
          title="Belum ada sublokasi"
          description="Belum ada hierarchy turunan pada lokasi ini. Tambahkan sublokasi melalui pengaturan proyek bila struktur tambahan diperlukan."
        />
      )}
    </section>
  );
}
