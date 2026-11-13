"use client";

import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { ReservationFilters } from "@/components/reservation/reservation-filters";
import { ReservationSummary } from "@/components/reservation/reservation-summary";
import { ReservationTable } from "@/components/reservation/reservation-table";
import type {
  ReservationFilterStatus,
  ReservationFiltersState,
  ReservationPeriod,
  ReservationStatusCode,
} from "@/components/reservation/reservation-types";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  reservationErrorMessage,
  useReservations,
} from "@/hooks/use-reservations";
import { ChevronRight, Plus } from "lucide-react";
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
    <SidebarProvider className="overflow-hidden bg-surface">
      <AppSidebar />
      <SidebarInset className="w-0 bg-surface">
        <header className="flex shrink-0 items-center px-4 pt-3 lg:hidden">
          <SidebarOpenTrigger />
        </header>

        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <nav
                  aria-label="Breadcrumb"
                  className="mb-2 flex items-center gap-1 text-xs font-medium text-gray-500"
                >
                  <span>Availability &amp; Reservation</span>
                  <ChevronRight aria-hidden="true" className="size-3" />
                  <span className="text-primary">Reservation</span>
                </nav>
                <h1 className="text-2xl font-bold tracking-[-0.025em] text-navy-900">
                  Reservation
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                  Daftar unit yang telah direservasi beserta detail pemesan,
                  harga, dan sales terkait.
                </p>
              </div>

              <Button
                type="button"
                size="lg"
                className="self-start px-4 shadow-[0_5px_14px_rgba(11,127,232,0.22)] sm:self-auto"
              >
                <Plus data-icon="inline-start" />
                Buat Reservasi
              </Button>
            </div>

            <ReservationSummary summary={data?.summary ?? emptySummary} />

            <section
              aria-label="Daftar reservasi"
              className="overflow-hidden rounded-xl bg-card shadow-[0_8px_28px_rgba(16,45,85,0.08)]"
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
                  isLoading={query.isLoading}
                />
              )}
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
