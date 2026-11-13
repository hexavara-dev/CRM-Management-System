import { Grid2X2, List } from "lucide-react";

import { ClusterAvailabilityCard } from "./cluster-card";
import type { ClusterAvailability } from "./types";

type ClusterOverviewProps = {
  clusters: ClusterAvailability[];
  availabilityId: string;
};

export function ClusterAvailabilityOverview({
  clusters,
  availabilityId,
}: ClusterOverviewProps) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-[#101828]">
            Cluster Overview
          </h2>
          <p className="mt-0.5 text-[9px] text-[#667085]">
            Ringkasan ketersediaan unit per cluster pada project ini
          </p>
        </div>

        <div className="flex items-center overflow-hidden rounded-lg border border-[#e3e7ec]">
          <button
            type="button"
            aria-label="Grid view"
            className="flex size-9 items-center justify-center bg-[#eff7ff] text-[#258bff]"
          >
            <Grid2X2 className="size-4" />
          </button>
          <div className="h-6 border-l border-[#e3e7ec]" />
          <button
            type="button"
            aria-label="List view"
            className="flex size-9 items-center justify-center text-[#64748b] hover:bg-muted"
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {clusters.map((cluster) => (
          <ClusterAvailabilityCard
            key={cluster.id}
            cluster={cluster}
            availabilityId={availabilityId}
          />
        ))}
      </div>

      {clusters.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Belum ada cluster pada project ini.
        </div>
      )}
    </section>
  );
}
