"use client";

import { AppSidebar } from "@/components/Sidebar";
import { ReservationFilters } from "@/components/reservation/reservation-filters";
import { ReservationSummary } from "@/components/reservation/reservation-summary";
import { ReservationTable } from "@/components/reservation/reservation-table";
import { CreateReservationDialog } from "./create-reservation-dialog";
import { ReservationDetailDialog } from "./reservation-detail-dialog";
import type { Reservation } from "@/components/reservation/reservation-types";
import type {
  ReservationFilterStatus,
  ReservationFiltersState,
  ReservationPeriod,
  ReservationStatusCode,
} from "@/components/reservation/reservation-types";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/PageHeader";
import {
  reservationErrorMessage,
  useReservations,
} from "@/hooks/use-reservations";
import { Plus } from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 10;

const initialFilters: ReservationFiltersState = {
  search: "",
  project: "all",
  cluster: "all",
  block: "all",
  status: "all",
  period: "all",
};

const statusMap: Record<ReservationFilterStatus, ReservationStatusCode> = {
  Aktif: "ACTIVE",
  "Menunggu Pembayaran": "PAYMENT_PENDING",
  Kedaluwarsa: "EXPIRED",
};

const periodMap: Record<ReservationPeriod, "today" | "week" | "month"> = {
  "Hari ini": "today",
  "Minggu ini": "week",
  "Bulan ini": "month",
};

const emptySummary = { total: 0, active: 0, paymentPending: 0, expired: 0 };
const emptyFilterOptions = { projects: [], clusters: [], blocks: [] };

export default function ReservationPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<{ id: string; mode: "detail" | "edit" } | null>(null);
  const [filters, setFilters] =
    useState<ReservationFiltersState>(initialFilters);
  const [page, setPage] = useState(1);
  const query = useReservations({
    page,
    limit: PAGE_SIZE,
    search: filters.search || undefined,
    project: filters.project === "all" ? undefined : filters.project,
    cluster: filters.cluster === "all" ? undefined : filters.cluster,
    block: filters.block === "all" ? undefined : filters.block,
    status: filters.status === "all" ? undefined : statusMap[filters.status],
    period: filters.period === "all" ? undefined : periodMap[filters.period],
  });
  const data = query.data;
  const currentPage = data?.meta.page ?? page;
  const totalPages = Math.max(1, data?.meta.totalPages ?? 1);

  const updateFilters = (next: Partial<ReservationFiltersState>) => {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  };

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <PageHeader
          title="Reservation"
          breadcrumbs={["Availability & Reservation", "Reservation"]}
          actions={
            <Button
              type="button"
              size="lg"
              className="px-4 shadow-[0_5px_14px_rgba(11,127,232,0.22)]"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus data-icon="inline-start" />
              Buat Reservasi
            </Button>
          }
        />

        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
            <ReservationSummary summary={data?.summary ?? emptySummary} />

            <section
              aria-label="Daftar reservasi"
              className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-card"
            >
              <ReservationFilters
                filters={filters}
                options={data?.filters ?? emptyFilterOptions}
                onChange={updateFilters}
              />
              {query.isError ? (
                <div className="grid min-h-64 place-items-center px-6 text-center">
                  <div>
                    <p className="font-semibold text-navy-900">
                      Data reservasi belum tersedia
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {reservationErrorMessage(query.error)}
                    </p>
                  </div>
                </div>
              ) : (
                <ReservationTable
                  reservations={data?.data ?? []}
                  total={data?.meta.total ?? 0}
                  page={currentPage}
                  pageSize={PAGE_SIZE}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onDetail={(reservation: Reservation) => setSelectedReservation({ id: reservation.id, mode: "detail" })}
                  onEdit={(reservation: Reservation) => setSelectedReservation({ id: reservation.id, mode: "edit" })}
                  isLoading={query.isLoading}
                />
              )}
            </section>
          </div>
        </main>
      </SidebarInset>
      <CreateReservationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={() => {
          setFilters(initialFilters);
          setPage(1);
        }}
      />
      <ReservationDetailDialog
        key={selectedReservation?.id ?? "closed"}
        id={selectedReservation?.id ?? null}
        mode={selectedReservation?.mode ?? "detail"}
        onClose={() => setSelectedReservation(null)}
        onModeChange={(mode) => setSelectedReservation((current) => current && { ...current, mode })}
      />
    </SidebarProvider>
  );
}
