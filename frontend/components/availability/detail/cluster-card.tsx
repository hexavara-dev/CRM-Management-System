import { Building2, CalendarDays, ChevronRight, House, Layers3, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { clusterPath } from "@/components/availability/routes";
import { Card, CardContent } from "@/components/ui/card";

import { ClusterAvailabilityMetric } from "./cluster-metric";
import { percentage } from "./percentage";
import type { ClusterAvailability } from "./types";

type ClusterCardProps = {
  cluster: ClusterAvailability;
  availabilityId: string;
  image?: string | null;
};

export function ClusterAvailabilityCard({
  cluster,
  availabilityId,
  image,
}: ClusterCardProps) {
  return (
    <Link
      href={clusterPath(availabilityId, cluster.code)}
      className="block rounded-2xl"
      aria-label={`View ${cluster.name}`}
    >
      <Card className="gap-0 overflow-hidden rounded-2xl border-[#e9edf2] p-0 shadow-none transition hover:-translate-y-0.5 hover:border-[#cdd8e5] hover:shadow-sm">
        {image ? (
          <Image
            src={image}
            alt={cluster.name}
            width={480}
            height={112}
            unoptimized
            className="h-28 w-full object-cover"
          />
        ) : (
          <div className="flex h-28 items-center justify-center bg-gradient-to-br from-[#e8f4ff] to-[#eef2f6]">
            <Building2 className="size-9 text-[#2695ff]/45" />
          </div>
        )}
        <div className="border-b border-[#eef0f3] px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eef7ff]">
                <Layers3 className="size-[18px] text-[#2695ff]" />
              </div>

              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-[#111827]">
                  {cluster.name}
                </h3>
                <p className="text-xs text-[#475467]">
                  {cluster.units} Unit
                  {cluster.children > 0 && (
                    <>
                      <span className="mx-1.5 text-[#d0d5dd]">|</span>
                      {cluster.children} Sublokasi
                    </>
                  )}
                </p>
              </div>
            </div>

            <ChevronRight className="size-5 shrink-0 text-[#111827]" />
          </div>
        </div>

        <CardContent className="grid grid-cols-3 gap-2 p-2.5">
          <ClusterAvailabilityMetric
            title="Available"
            value={cluster.available}
            percentageText={percentage(cluster.available, cluster.units)}
            variant="available"
            icon={<House className="size-4" />}
          />
          <ClusterAvailabilityMetric
            title="Reserved"
            value={cluster.reserved + cluster.processing}
            percentageText={percentage(
              cluster.reserved + cluster.processing,
              cluster.units,
            )}
            variant="reserved"
            icon={<CalendarDays className="size-4" />}
          />
          <ClusterAvailabilityMetric
            title="Sold"
            value={cluster.sold}
            percentageText={percentage(cluster.sold, cluster.units)}
            variant="sold"
            icon={<Tag className="size-4" />}
          />
        </CardContent>
      </Card>
    </Link>
  );
}
