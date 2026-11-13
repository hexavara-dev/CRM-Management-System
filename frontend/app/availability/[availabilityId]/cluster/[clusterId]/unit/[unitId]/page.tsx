"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { AvailabilityState } from "@/components/availability/availability-state";
import { clusterPath } from "@/components/availability/routes";
import { UnitNotesCard } from "@/components/availability/unit/notes-card";
import { PricingCard } from "@/components/availability/unit/pricing-card";
import { SpecificationCard } from "@/components/availability/unit/specification-card";
import { UnitGallery } from "@/components/availability/unit/unit-gallery";
import { UnitInfoCard } from "@/components/availability/unit/unit-info-card";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAvailabilityUnit } from "@/hooks/use-availability";
import { errorMessage } from "@/hooks/use-projects";

export default function UnitDetailPage() {
  const params = useParams<{
    availabilityId: string;
    clusterId: string;
    unitId: string;
  }>();
  const unit = useAvailabilityUnit(
    params.availabilityId,
    params.clusterId,
    params.unitId,
  );

  return (
    <SidebarProvider className="overflow-hidden bg-[#f8fafc]">
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-white">
        <header className="flex shrink-0 items-center px-4 pt-3 lg:hidden">
          <SidebarOpenTrigger />
        </header>
        <main className="min-h-screen px-4 pb-8 pt-4 lg:px-5">
          {unit.isLoading ? (
            <AvailabilityState loading message="Memuat detail unit..." />
          ) : unit.isError ? (
            <AvailabilityState
              message={errorMessage(unit.error, "Gagal memuat detail unit.")}
            />
          ) : unit.data ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1 text-[9px] font-semibold">
                  <span className="text-[#3967fb]">
                    Availability & Reservation
                  </span>
                  <span className="text-[#98a2b3]">›</span>
                  <span className="text-[#3967fb]">Availability Overview</span>
                  <span className="text-[#98a2b3]">›</span>
                  <span className="text-[#3967fb]">{unit.data.cluster}</span>
                  <span className="text-[#98a2b3]">›</span>
                  <span className="text-[#344054]">
                    Unit {unit.data.number}
                  </span>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="h-8 rounded-lg px-3 text-[10px] font-semibold shadow-none"
                >
                  <Link
                    href={clusterPath(params.availabilityId, params.clusterId)}
                  >
                    <ArrowLeft className="mr-1.5 size-3" />
                    Back to Cluster
                  </Link>
                </Button>
              </div>
              <h1 className="mt-4 text-[22px] font-bold tracking-tight text-[#101828]">
                Detail Unit
              </h1>
              <section className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_1fr]">
                <div className="space-y-3">
                  <UnitGallery unit={unit.data} />
                  <SpecificationCard unit={unit.data} />
                </div>
                <div className="space-y-3">
                  <UnitInfoCard unit={unit.data} />
                  <PricingCard unit={unit.data} />
                  <UnitNotesCard />
                </div>
              </section>
            </>
          ) : (
            <AvailabilityState message="Unit tidak ditemukan." />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
