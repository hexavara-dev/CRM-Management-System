"use client";

import { ArrowLeft, CalendarDays, House, Layers3, Tag } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { AvailabilityState } from "@/components/availability/availability-state";
import { ClusterToolbar } from "@/components/availability/cluster/cluster-toolbar";
import { ClusterSummaryCard } from "@/components/availability/cluster/summary-card";
import type {
  BlockFilter,
  ClusterView,
} from "@/components/availability/cluster/types";
import { ClusterUnitList } from "@/components/availability/cluster/unit-list";
import { availabilityPath } from "@/components/availability/routes";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useClusterAvailability } from "@/hooks/use-availability";
import { errorMessage } from "@/hooks/use-projects";

export default function ClusterDetailPage() {
  const params = useParams<{
    availabilityId: string;
    clusterId: string;
  }>();
  const [block, setBlock] = useState<BlockFilter>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ClusterView>("grid");
  const availability = useClusterAvailability(
    params.availabilityId,
    params.clusterId,
  );
  const units = availability.data?.units ?? [];

  const filteredUnits = useMemo(
    () =>
      units.filter((unit) => {
        const matchesBlock = block === "all" || unit.block === block;
        const matchesSearch = unit.code
          .toLowerCase()
          .includes(search.toLowerCase());

        return matchesBlock && matchesSearch;
      }),
    [block, search, units],
  );

  return (
    <SidebarProvider className="overflow-hidden bg-[#f8fafc]">
      <AppSidebar />

      <SidebarInset className="min-w-0 bg-white">
        <header className="flex shrink-0 items-center px-4 pt-3 lg:hidden">
          <SidebarOpenTrigger />
        </header>

        <main className="min-h-screen px-4 pb-8 pt-4 lg:px-5">
          {availability.isLoading ? (
            <AvailabilityState loading message="Memuat detail cluster..." />
          ) : availability.isError ? (
            <AvailabilityState
              message={errorMessage(
                availability.error,
                "Gagal memuat detail cluster.",
              )}
            />
          ) : availability.data ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1 text-[9px] font-semibold">
                  <span className="text-[#3664ff]">
                    Availability & Reservation
                  </span>
                  <span className="text-[#98a2b3]">›</span>
                  <span className="text-[#3664ff]">Availability Overview</span>
                  <span className="text-[#98a2b3]">›</span>
                  <span className="text-[#344054]">
                    {availability.data.cluster.name}
                  </span>
                </div>

                <Button
                  asChild
                  variant="outline"
                  className="h-8 rounded-lg px-3 text-[10px] font-semibold shadow-none"
                >
                  <Link href={availabilityPath(params.availabilityId)}>
                    <ArrowLeft className="mr-1 size-3" />
                    Back to Project
                  </Link>
                </Button>
              </div>

              <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_2.4fr]">
                <div className="flex items-center">
                  <div>
                    <h1 className="text-[26px] font-bold tracking-tight text-[#101828]">
                      {availability.data.cluster.name}
                    </h1>
                    <p className="mt-1 text-[10px] font-medium text-[#475467]">
                      {availability.data.project.name}
                      <span className="mx-1.5">•</span>
                      {availability.data.project.location}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <ClusterSummaryCard
                    title="Total Unit"
                    value={availability.data.summary.total}
                    variant="total"
                    icon={<Layers3 className="size-6" />}
                  />
                  <ClusterSummaryCard
                    title="Available"
                    value={availability.data.summary.available}
                    variant="available"
                    icon={<House className="size-6" />}
                  />
                  <ClusterSummaryCard
                    title="Reserved / Processing"
                    value={
                      availability.data.summary.reserved +
                      availability.data.summary.processing
                    }
                    variant="reserved"
                    icon={<CalendarDays className="size-6" />}
                  />
                  <ClusterSummaryCard
                    title="Sold"
                    value={availability.data.summary.sold}
                    variant="sold"
                    icon={<Tag className="size-6" />}
                  />
                </div>
              </section>

              <div className="my-4 border-t border-[#edf0f3]" />

              <ClusterToolbar
                block={block}
                blocks={availability.data.blocks}
                search={search}
                view={view}
                onBlockChange={setBlock}
                onSearchChange={setSearch}
                onViewChange={setView}
              />

              <ClusterUnitList
                units={filteredUnits}
                view={view}
                availabilityId={params.availabilityId}
                clusterId={params.clusterId}
              />

              {filteredUnits.length === 0 && (
                <div className="mt-10 text-center text-sm text-muted-foreground">
                  Unit tidak ditemukan.
                </div>
              )}
            </>
          ) : (
            <AvailabilityState message="Cluster tidak ditemukan." />
          )}
        </main>

        <style jsx global>{`
                    .unit-sold-pattern {
                        background-color: #fafafa;
                        background-image: repeating-linear-gradient(
                            -45deg,
                            rgba(17, 24, 39, 0.045) 0,
                            rgba(17, 24, 39, 0.045) 4px,
                            transparent 4px,
                            transparent 9px
                        );
                    }
                `}</style>
      </SidebarInset>
    </SidebarProvider>
  );
}
