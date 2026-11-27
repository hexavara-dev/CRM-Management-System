"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AppSidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { AvailabilityEmptyState } from "@/components/availability/availability-empty-state";
import { AvailabilityIntegrityWarning } from "@/components/availability/availability-integrity-warning";
import { AvailabilityState } from "@/components/availability/availability-state";
import { ClusterToolbar } from "@/components/availability/cluster/cluster-toolbar";
import type {
  BlockFilter,
  ClusterView,
} from "@/components/availability/cluster/types";
import { ClusterUnitList } from "@/components/availability/cluster/unit-list";
import { ClusterAvailabilityOverview } from "@/components/availability/detail/cluster-overview";
import { ProjectAvailabilityHeader } from "@/components/availability/detail/project-header";
import { ProjectAvailabilitySummary } from "@/components/availability/detail/project-summary";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useProjectAvailability } from "@/hooks/use-availability";
import { errorMessage } from "@/hooks/use-projects";

export default function AvailabilityDetailPage() {
  const params = useParams<{ availabilityId: string }>();
  const [block, setBlock] = useState<BlockFilter>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ClusterView>("grid");
  const availability = useProjectAvailability(params.availabilityId);
  const units = availability.data?.units ?? [];
  const blocks = useMemo(
    () => [...new Set(units.map((unit) => unit.block))],
    [units],
  );
  const filteredUnits = useMemo(
    () =>
      units.filter((unit) => {
        const matchesBlock = block === "all" || unit.block === block;
        const matchesSearch = unit.code
          .toLocaleLowerCase("id-ID")
          .includes(search.trim().toLocaleLowerCase("id-ID"));

        return matchesBlock && matchesSearch;
      }),
    [block, search, units],
  );

  return (
    <SidebarProvider className="overflow-hidden bg-[#f8fafc]">
      <AppSidebar />

      <SidebarInset className="min-w-0 bg-white">
        <PageHeader title="Availability" breadcrumbs={["Availability & Reservation", "Availability"]} />

        <main className="min-h-screen px-4 pb-8 pt-4 lg:px-5">
          {availability.isLoading ? (
            <AvailabilityState loading message="Memuat detail project..." />
          ) : availability.isError ? (
            <AvailabilityState
              message={errorMessage(
                availability.error,
                "Gagal memuat detail project.",
              )}
            />
          ) : availability.data ? (
            <>
              <section className="rounded-2xl border border-[#edf0f3] bg-white p-5 shadow-sm">
                <ProjectAvailabilityHeader
                  project={availability.data.project}
                />
                <ProjectAvailabilitySummary
                  project={availability.data.project}
                />
              </section>

              <div className="mt-4">
                <AvailabilityIntegrityWarning
                  integrity={availability.data.integrity}
                />
              </div>

              <div className="my-5" />

              {availability.data.groups.length > 0 && (
                <ClusterAvailabilityOverview
                  clusters={availability.data.groups}
                  availabilityId={availability.data.project.code}
                  level={availability.data.hierarchyLevel}
                  image={availability.data.project.image}
                />
              )}

              {availability.data.groups.length === 0 &&
                availability.data.units.length === 0 && (
                  <AvailabilityEmptyState
                    title="Belum ada hierarchy atau unit"
                    description={`Proyek ${availability.data.project.name} belum memiliki lokasi turunan maupun unit. Lengkapi hierarchy dan tambahkan unit melalui halaman pengaturan proyek.`}
                  />
                )}

              {availability.data.units.length > 0 && availability.data.root && (
                <div className="mt-5">
                  <h2 className="text-[15px] font-bold text-[#101828]">
                    Unit pada {availability.data.root.name}
                  </h2>
                  <div className="mt-3">
                    <ClusterToolbar
                      block={block}
                      blocks={blocks}
                      search={search}
                      view={view}
                      onBlockChange={setBlock}
                      onSearchChange={setSearch}
                      onViewChange={setView}
                    />
                  </div>
                  <ClusterUnitList
                    units={filteredUnits}
                    view={view}
                    availabilityId={availability.data.project.code}
                    clusterId={availability.data.root.code}
                  />
                </div>
              )}
            </>
          ) : (
            <AvailabilityEmptyState
              title="Proyek tidak ditemukan"
              description="Proyek yang Anda buka tidak tersedia atau Anda tidak memiliki akses ke proyek tersebut. Kembali ke daftar Availability untuk memilih proyek lain."
            />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
