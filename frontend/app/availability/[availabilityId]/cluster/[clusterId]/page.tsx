"use client";

import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  House,
  Layers3,
  MapPin,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AppSidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { AvailabilityEmptyState } from "@/components/availability/availability-empty-state";
import { AvailabilityIntegrityWarning } from "@/components/availability/availability-integrity-warning";
import { AvailabilityState } from "@/components/availability/availability-state";
import { ClusterToolbar } from "@/components/availability/cluster/cluster-toolbar";
import { ClusterSummaryCard } from "@/components/availability/cluster/summary-card";
import type {
  BlockFilter,
  ClusterView,
} from "@/components/availability/cluster/types";
import { ClusterUnitList } from "@/components/availability/cluster/unit-list";
import { ClusterAvailabilityOverview } from "@/components/availability/detail/cluster-overview";
import { availabilityPath, clusterPath } from "@/components/availability/routes";
import { SimplePagination } from "@/components/availability/simple-pagination";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useClusterAvailability } from "@/hooks/use-availability";
import { errorMessage } from "@/hooks/use-projects";

const UNIT_PAGE_SIZE = 12;

export default function ClusterDetailPage() {
  const params = useParams<{
    availabilityId: string;
    clusterId: string;
  }>();
  const [block, setBlock] = useState<BlockFilter>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ClusterView>("grid");
  const [page, setPage] = useState(1);
  const router = useRouter();
  const availability = useClusterAvailability(
    params.availabilityId,
    params.clusterId,
  );
  const units = availability.data?.units ?? [];
  // Di lokasi paling bawah (mis. blok), tab berisi blok setingkat dan memindahkan halaman.
  const isLeaf = (availability.data?.children.length ?? 0) === 0;
  const siblings = availability.data?.siblings ?? [];
  const navigateBlocks = isLeaf && siblings.length > 1;

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
  // Halaman dijaga tetap valid saat filter mengurangi jumlah unit.
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredUnits.length / UNIT_PAGE_SIZE)));
  const pagedUnits = filteredUnits.slice((currentPage - 1) * UNIT_PAGE_SIZE, currentPage * UNIT_PAGE_SIZE);

  return (
    <SidebarProvider className="overflow-hidden bg-[#f8fafc]">
      <AppSidebar />

      <SidebarInset className="min-w-0 bg-white">
        <PageHeader title="Cluster" breadcrumbs={["Availability & Reservation", "Availability", "Cluster"]} />

        <main className="min-h-screen px-4 pb-8 pt-4 lg:px-5">
          {availability.isLoading ? (
            <AvailabilityState loading message="Memuat detail hierarchy..." />
          ) : availability.isError ? (
            <AvailabilityState
              message={errorMessage(
                availability.error,
                "Gagal memuat detail hierarchy.",
              )}
            />
          ) : availability.data ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  <span className="text-[#3664ff]">
                    Availability & Reservation
                  </span>
                  <ChevronRight className="size-4 text-[#98a2b3]" />
                  <Link
                    href={availabilityPath(availability.data.project.code)}
                    className="text-[#3664ff] hover:underline"
                  >
                    Availability Overview
                  </Link>
                  <ChevronRight className="size-4 text-[#98a2b3]" />
                  {availability.data.parent && (
                    <>
                      <Link
                        href={clusterPath(
                          availability.data.project.code,
                          availability.data.parent.code,
                        )}
                        className="text-[#3664ff] hover:underline"
                      >
                        {availability.data.parent.name}
                      </Link>
                      <ChevronRight className="size-4 text-[#98a2b3]" />
                    </>
                  )}
                  <span className="text-[#344054]">
                    {availability.data.cluster.name}
                  </span>
                </div>

                <Button
                  asChild
                  variant="outline"
                  className="h-10 rounded-xl px-4 text-sm font-medium shadow-none"
                >
                  <Link href={availabilityPath(availability.data.project.code)}>
                    <ArrowLeft className="mr-1 size-4" />
                    Kembali ke Project
                  </Link>
                </Button>
              </div>

              <section className="mt-4 grid gap-4 rounded-2xl border border-[#edf0f3] bg-white p-4 shadow-sm lg:grid-cols-[1fr_2.4fr]">
                <div className="flex items-center lg:border-r lg:border-[#edf0f3] lg:pr-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#101828]">
                      {availability.data.cluster.name}
                    </h1>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#1e3a8a]">
                          {availability.data.project.name}
                        </span>
                      </div>
                      {availability.data.project.location && (
                        <p className="flex items-start gap-1.5 text-xs leading-5 text-[#475467]">
                          <MapPin className="mt-0.5 size-3.5 shrink-0" />
                          <span className="line-clamp-2" title={availability.data.project.location}>{availability.data.project.location}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 content-center gap-3 lg:grid-cols-4">
                  <ClusterSummaryCard
                    title="Unit Terdaftar"
                    value={availability.data.summary.total}
                    variant="total"
                    icon={<Layers3 className="size-4" />}
                  />
                  <ClusterSummaryCard
                    title="Available"
                    value={availability.data.summary.available}
                    variant="available"
                    icon={<House className="size-4" />}
                  />
                  <ClusterSummaryCard
                    title="Reserved / Processing"
                    value={
                      availability.data.summary.reserved +
                      availability.data.summary.processing
                    }
                    variant="reserved"
                    icon={<CalendarDays className="size-4" />}
                  />
                  <ClusterSummaryCard
                    title="Sold"
                    value={availability.data.summary.sold}
                    variant="sold"
                    icon={<Tag className="size-4" />}
                  />
                </div>
              </section>

              <div className="mt-4">
                <AvailabilityIntegrityWarning
                  integrity={availability.data.integrity}
                />
              </div>

              <div className="my-4 border-t border-[#edf0f3]" />

              {availability.data.children.length === 0 &&
                availability.data.units.length === 0 && (
                  <AvailabilityEmptyState
                    title={`Belum ada unit di ${availability.data.cluster.name}`}
                    description={`Lokasi ${availability.data.cluster.name} belum memiliki sublokasi maupun unit. Tambahkan hierarchy atau unit melalui pengaturan proyek agar data availability dapat ditampilkan.`}
                  />
                )}

              {availability.data.children.length > 0 && (
                <ClusterAvailabilityOverview
                  clusters={availability.data.children}
                  availabilityId={availability.data.project.code}
                  level={availability.data.children[0]?.level}
                />
              )}

              {availability.data.units.length > 0 && (
                <section
                  className={
                    availability.data.children.length > 0
                      ? "mt-8 border-t border-[#edf0f3] pt-6"
                      : undefined
                  }
                >
                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-[#101828]">
                      Daftar Unit
                    </h2>
                    <p className="mt-1 text-sm text-[#475467]">
                      Semua unit di {availability.data.cluster.name}. Pilih blok untuk menyaring daftar.
                    </p>
                  </div>
                  <ClusterToolbar
                    block={navigateBlocks ? availability.data.cluster.name : block}
                    blocks={
                      navigateBlocks
                        ? siblings.map((item) => item.name)
                        : availability.data.blocks
                    }
                    showAll={!navigateBlocks || !!availability.data.parent}
                    search={search}
                    view={view}
                    onBlockChange={(value) => {
                      if (navigateBlocks && availability.data) {
                        const project = availability.data.project.code;
                        const target =
                          value === "all"
                            ? availability.data.parent
                            : siblings.find((item) => item.name === value);
                        if (target && target.code !== availability.data.cluster.code) {
                          router.push(clusterPath(project, target.code));
                        }
                        return;
                      }
                      setBlock(value);
                      setPage(1);
                    }}
                    onSearchChange={(value) => {
                      setSearch(value);
                      setPage(1);
                    }}
                    onViewChange={setView}
                  />

                  <ClusterUnitList
                    units={pagedUnits}
                    view={view}
                    availabilityId={availability.data.project.code}
                    clusterId={availability.data.cluster.code}
                  />
                  {filteredUnits.length > 0 && (
                    <SimplePagination
                      page={currentPage}
                      pageSize={UNIT_PAGE_SIZE}
                      total={filteredUnits.length}
                      itemLabel="unit"
                      onPageChange={setPage}
                    />
                  )}
                </section>
              )}
            </>
          ) : (
            <AvailabilityEmptyState
              title="Lokasi tidak ditemukan"
              description="Hierarchy yang Anda buka tidak tersedia atau sudah tidak menjadi bagian dari proyek ini. Kembali ke halaman proyek untuk memilih lokasi lain."
            />
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
