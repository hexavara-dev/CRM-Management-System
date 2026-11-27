"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AppSidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { AvailabilityState } from "@/components/availability/availability-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { reservationErrorMessage, useReservationDetail } from "@/hooks/use-reservations";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export default function ReservationSummaryPage() {
  const params = useParams<{ id: string }>();
  const reservation = useReservationDetail(params.id);

  return (
    <SidebarProvider className="overflow-hidden bg-[#f8fafc]">
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <PageHeader title="Reservation Summary" breadcrumbs={["Availability & Reservation", "Reservation", "Summary"]} />
        <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
          {reservation.isLoading ? (
            <AvailabilityState loading message="Memuat ringkasan reservasi..." />
          ) : reservation.isError ? (
            <AvailabilityState message={reservationErrorMessage(reservation.error)} />
          ) : reservation.data ? (
            <div className="space-y-5">
              <div className="text-center">
                <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
                <h1 className="mt-3 text-2xl font-bold text-[#101828]">
                  Reservasi berhasil dibuat
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Simpan nomor referensi {reservation.data.refCode} untuk proses berikutnya.
                </p>
              </div>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle>Ringkasan Pemesanan Unit</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {[
                    ["Nomor referensi", reservation.data.refCode],
                    ["Status", reservation.data.status],
                    ["Pemesan", reservation.data.customer],
                    ["Sales", reservation.data.sales.name],
                    ["Project", reservation.data.project],
                    ["Hierarchy", reservation.data.hierarchy.map((item) => item.name).join(" / ")],
                    ["Nomor unit", reservation.data.unit],
                    ["Harga jual", rupiah.format(reservation.data.price)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 font-semibold text-[#101828]">{value || "—"}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                <Button asChild variant="outline">
                  <Link href="/reservation">Lihat Daftar Reservasi</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/availability">Kembali ke Availability</Link>
                </Button>
                <Button asChild>
                  <Link href="/">Lanjut ke Halaman Utama</Link>
                </Button>
              </div>
            </div>
          ) : (
            <AvailabilityState message="Reservasi tidak ditemukan." />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
