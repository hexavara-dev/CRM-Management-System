"use client";

import { useParams } from "next/navigation";

import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { AvailabilityState } from "@/components/availability/availability-state";
import { ClusterAvailabilityOverview } from "@/components/availability/detail/cluster-overview";
import { ProjectAvailabilityHeader } from "@/components/availability/detail/project-header";
import { ProjectAvailabilitySummary } from "@/components/availability/detail/project-summary";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useProjectAvailability } from "@/hooks/use-availability";
import { errorMessage } from "@/hooks/use-projects";

export default function AvailabilityDetailPage() {
  const params = useParams<{ availabilityId: string }>();
  const availability = useProjectAvailability(params.availabilityId);

  return (
    <SidebarProvider className="overflow-hidden bg-[#f8fafc]">
      <AppSidebar />

      <SidebarInset className="min-w-0 bg-white">
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3 lg:hidden">
          <SidebarOpenTrigger />
        </header>

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
              <section>
                <ProjectAvailabilityHeader
                  project={availability.data.project}
                />
                <ProjectAvailabilitySummary
                  project={availability.data.project}
                />
              </section>

              <div className="my-4 border-t border-[#edf0f2]" />

              <ClusterAvailabilityOverview
                clusters={availability.data.clusters}
                availabilityId={params.availabilityId}
              />
            </>
          ) : (
            <AvailabilityState message="Project tidak ditemukan." />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
