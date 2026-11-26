"use client";

import { Ban, CalendarDays, House, Layers, Tag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeading } from "@/components/PageHeading";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { AvailabilityEmptyState } from "@/components/availability/availability-empty-state";
import { AvailabilityState } from "@/components/availability/availability-state";
import { AvailabilityTable } from "@/components/availability/availability-table";
import { SalesProgress } from "@/components/availability/sales-progress";
import { SummaryCard } from "@/components/availability/summary-card";
import { UnitDistribution } from "@/components/availability/unit-distribution";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAvailabilityOverview } from "@/hooks/use-availability";
import { errorMessage, useProjects } from "@/hooks/use-projects";
import { SearchableSelect } from "@/components/ui/searchable-select";

const EMPTY_SUMMARY = {
  total: 0,
  available: 0,
  processing: 0,
  reserved: 0,
  sold: 0,
  blocked: 0,
};

export default function AvailabilityPage() {
  const [projectId, setProjectId] = useState("all");

  const { data, isLoading, isError, error } = useProjects({
    page: 1,
    limit: 100,
    isActive: true,
  });

  const projects = data?.data ?? [];
  const availability = useAvailabilityOverview(
    projectId === "all" ? undefined : projectId,
  );

  let placeholder = "Select a project";
  if (isLoading) placeholder = "Memuat proyek...";
  else if (isError) placeholder = errorMessage(error, "Gagal memuat proyek.");
  else if (projects.length === 0) placeholder = "Belum ada proyek";

  const summary = availability.data?.summary ?? EMPTY_SUMMARY;
  const getPercentage = (value: number) =>
    summary.total > 0 ? (value / summary.total) * 100 : 0;

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />

      <SidebarInset className="min-w-0">
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3 empty:hidden">
          <SidebarOpenTrigger />
        </header>

        <main className="space-y-5 p-4 md:p-6">
          <PageHeading
            actions={
              <div className="w-full sm:w-64">
                <SearchableSelect
                  value={projectId === "all" ? undefined : projectId}
                  onChange={(value) => setProjectId(value ?? "all")}
                  placeholder="Semua proyek"
                  options={projects.map((project) => ({
                    value: String(project.id),
                    label: project.name,
                  }))}
                  loading={isLoading}
                  disabled={isLoading || isError || projects.length === 0}
                  disabledHint={placeholder}
                />
              </div>
            }
          />

          {availability.isLoading || isLoading ? (
            <AvailabilityState loading message="Memuat data availability..." />
          ) : availability.isError || isError ? (
            <AvailabilityState
              message={errorMessage(
                availability.error ?? error,
                "Gagal memuat data availability.",
              )}
            />
          ) : summary.total === 0 ? (
            <AvailabilityEmptyState
              title={
                projects.length === 0
                  ? "Belum ada proyek"
                  : projectId === "all"
                    ? "Belum ada unit yang dapat ditampilkan"
                    : "Proyek ini belum memiliki unit"
              }
              description={
                projects.length === 0
                  ? "Buat proyek terlebih dahulu, lalu tambahkan hierarchy dan unit agar data availability dapat ditampilkan."
                  : "Tambahkan unit melalui pengaturan proyek. Setelah unit tersedia, ringkasan status dan distribusi unit akan muncul di halaman ini."
              }
              action={
                <Button asChild size="sm">
                  <Link
                    href={
                      projects.length === 0
                        ? "/projects/create"
                        : projectId === "all"
                          ? "/projects"
                          : `/projects/${encodeURIComponent(projectId)}/edit`
                    }
                  >
                    {projects.length === 0
                      ? "Buat Proyek"
                      : projectId === "all"
                        ? "Buka Project Management"
                        : "Atur Proyek"}
                  </Link>
                </Button>
              }
            />
          ) : (
            <>
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <SummaryCard
                  title="Total Units"
                  value={summary.total}
                  icon={Layers}
                  color="text-blue-500"
                  bg="bg-blue-50"
                />
                <SummaryCard
                  title="Available"
                  value={summary.available}
                  percentage={getPercentage(summary.available)}
                  icon={House}
                  color="text-green-500"
                  bg="bg-green-50"
                />
                <SummaryCard
                  title="Reservation / Processing"
                  value={summary.processing}
                  percentage={getPercentage(summary.processing)}
                  icon={CalendarDays}
                  color="text-blue-500"
                  bg="bg-blue-50"
                />
                <SummaryCard
                  title="Reserved"
                  value={summary.reserved}
                  percentage={getPercentage(summary.reserved)}
                  icon={CalendarDays}
                  color="text-orange-500"
                  bg="bg-orange-50"
                />
                <SummaryCard
                  title="Sold"
                  value={summary.sold}
                  percentage={getPercentage(summary.sold)}
                  icon={Tag}
                  color="text-red-500"
                  bg="bg-red-50"
                />
                <SummaryCard
                  title="Blocked"
                  value={summary.blocked}
                  percentage={getPercentage(summary.blocked)}
                  icon={Ban}
                  color="text-slate-500"
                  bg="bg-slate-100"
                />
              </section>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <UnitDistribution
                  available={summary.available}
                  processing={summary.processing}
                  reserved={summary.reserved}
                  sold={summary.sold}
                  blocked={summary.blocked}
                  total={summary.total}
                />
                <SalesProgress sold={summary.sold} total={summary.total} />
              </section>

              <section>
                <AvailabilityTable
                  projects={availability.data?.projects ?? []}
                />
              </section>
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
