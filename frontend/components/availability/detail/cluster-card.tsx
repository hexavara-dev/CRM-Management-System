import { CalendarDays, ChevronRight, House, Layers3, Tag } from "lucide-react";
import Link from "next/link";

import { clusterPath } from "@/components/availability/routes";
import { Card, CardContent } from "@/components/ui/card";

import { ClusterAvailabilityMetric } from "./cluster-metric";
import { percentage } from "./percentage";
import type { ClusterAvailability } from "./types";

type ClusterCardProps = {
  cluster: ClusterAvailability;
  availabilityId: string;
};

export function ClusterAvailabilityCard({
  cluster,
  availabilityId,
}: ClusterCardProps) {
  return (
    <Link
      href={clusterPath(availabilityId, cluster.id)}
      className="block rounded-xl"
      aria-label={`View ${cluster.name}`}
    >
      <Card className="overflow-hidden rounded-xl border-[#e9edf2] p-0 shadow-none transition-colors hover:border-[#cdd8e5] hover:bg-[#fbfdff]">
        <div className="border-b border-[#eef0f3] px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eef7ff]">
                <Layers3 className="size-4 text-[#2695ff]" />
              </div>

              <div className="min-w-0">
                <h3 className="truncate text-[13px] font-bold text-[#111827]">
                  {cluster.name}
                </h3>
                <p className="mt-0.5 text-[9px] text-[#667085]">
                  {cluster.units} Unit
                  <span className="mx-1">|</span>
                  {cluster.blocks} Blok
                </p>
              </div>
            </div>

            <ChevronRight className="size-4 shrink-0 text-[#111827]" />
          </div>
        </div>

        <CardContent className="grid grid-cols-3 gap-1.5 p-2">
          <ClusterAvailabilityMetric
            title="Available"
            value={cluster.available}
            percentageText={percentage(cluster.available, cluster.units)}
            variant="available"
            icon={<House className="size-3.5" />}
          />
          <ClusterAvailabilityMetric
            title="Reserved / Processing"
            value={cluster.reserved + cluster.processing}
            percentageText={percentage(
              cluster.reserved + cluster.processing,
              cluster.units,
            )}
            variant="reserved"
            icon={<CalendarDays className="size-3.5" />}
          />
          <ClusterAvailabilityMetric
            title="Sold"
            value={cluster.sold}
            percentageText={percentage(cluster.sold, cluster.units)}
            variant="sold"
            icon={<Tag className="size-3.5" />}
          />
        </CardContent>
      </Card>
    </Link>
  );
}
