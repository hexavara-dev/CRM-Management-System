"use client";

import { CalendarDays, House, Layers, Tag } from "lucide-react";
import { useState } from "react";

import { PageHeading } from "@/components/PageHeading";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { AvailabilityState } from "@/components/availability/availability-state";
import { AvailabilityTable } from "@/components/availability/availability-table";
import { SalesProgress } from "@/components/availability/sales-progress";
import { SummaryCard } from "@/components/availability/summary-card";
import { UnitDistribution } from "@/components/availability/unit-distribution";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAvailabilityOverview } from "@/hooks/use-availability";
import { errorMessage, useProjects } from "@/hooks/use-projects";

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
              <Select
                value={projectId}
                onValueChange={setProjectId}
                disabled={isLoading || isError || projects.length === 0}
              >
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">Semua proyek</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />

          {availability.isLoading ? (
            <AvailabilityState loading message="Memuat data availability..." />
          ) : availability.isError ? (
            <AvailabilityState
              message={errorMessage(
                availability.error,
                "Gagal memuat data availability.",
              )}
            />
          ) : (
            <>
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
              </section>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <UnitDistribution
                  available={summary.available}
                  processing={summary.processing}
                  reserved={summary.reserved}
                  sold={summary.sold}
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
