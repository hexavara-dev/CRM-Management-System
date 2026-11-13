import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Eye, MoreVertical } from "lucide-react";
import type { Reservation, ReservationStatus } from "./reservation-types";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatReservationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

const statusStyles: Record<ReservationStatus, string> = {
  Aktif: "bg-success-bg text-success",
  "Menunggu Pembayaran": "bg-warning-bg text-amber-700",
  Kedaluwarsa: "bg-danger-bg text-danger",
  Dibatalkan: "bg-gray-100 text-gray-600",
  Selesai: "bg-info-bg text-info",
};

function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <Badge className={cn("border-0 text-[10px]", statusStyles[status])}>
      {status}
    </Badge>
  );
}

function SalesCell({ sales }: { sales: Reservation["sales"] }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm">
        <AvatarFallback className={cn("font-semibold", sales.color)}>
          {sales.initials}
        </AvatarFallback>
      </Avatar>
      <span className="whitespace-nowrap font-medium text-slate-700">
        {sales.name}
      </span>
    </div>
  );
}

function RowActions({ unit }: { unit: string }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="size-11 lg:size-6"
        aria-label={`Lihat reservasi unit ${unit}`}
      >
        <Eye data-icon="inline-start" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-11 lg:size-6"
            aria-label={`Aksi lain untuk unit ${unit}`}
          >
            <MoreVertical data-icon="inline-start" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem>Lihat detail</DropdownMenuItem>
            <DropdownMenuItem>Ubah reservasi</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type ReservationTableProps = {
  reservations: Reservation[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
};

export function ReservationTable({
  reservations,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  isLoading = false,
}: ReservationTableProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pageNumbers = Array.from(
    { length: Math.min(totalPages, 5) },
    (_, index) => {
      const firstPage = Math.min(
        Math.max(1, page - 2),
        Math.max(1, totalPages - 4),
      );
      return firstPage + index;
    },
  );

  if (isLoading) {
    return (
      <div className="grid gap-2 p-4">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12 rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="grid min-h-64 place-items-center px-6 text-center">
        <div>
          <p className="font-semibold text-navy-900">
            Reservasi tidak ditemukan
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Coba ubah kata pencarian atau filter yang dipilih.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden lg:block">
        <Table className="min-w-[1120px] text-xs">
          <TableHeader className="bg-surface">
            <TableRow className="hover:bg-surface">
              {[
                "No.",
                "Unit",
                "Project",
                "Cluster",
                "Blok",
                "Pemesan",
                "Tanggal Reservasi",
                "Harga Unit",
                "Sales",
                "Status",
                "Aksi",
              ].map((heading) => (
                <TableHead
                  key={heading}
                  className="h-10 whitespace-nowrap px-3 text-[11px] font-semibold text-slate-700"
                >
                  {heading}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservations.map((reservation, index) => (
              <TableRow key={reservation.id} className="bg-white">
                <TableCell className="px-3 py-2.5 text-gray-500">
                  {(page - 1) * pageSize + index + 1}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <Badge className="bg-brand-100 text-brand-700">
                    {reservation.unit}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700">
                  {reservation.project}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2.5">
                  {reservation.cluster}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  {reservation.block}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700">
                  {reservation.customer}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2.5 text-gray-500">
                  {formatReservationDate(reservation.reservationDate)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-slate-700">
                  {currencyFormatter.format(reservation.price)}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <SalesCell sales={reservation.sales} />
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <StatusBadge status={reservation.status} />
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <RowActions unit={reservation.unit} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 bg-surface p-3 lg:hidden">
        {reservations.map((reservation) => (
          <article
            key={reservation.id}
            className="rounded-xl bg-white p-4 shadow-[0_4px_14px_rgba(16,45,85,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-brand-100 text-brand-700">
                    {reservation.unit}
                  </Badge>
                  <StatusBadge status={reservation.status} />
                </div>
                <h2 className="mt-3 font-semibold text-navy-900">
                  {reservation.customer}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {reservation.project} · {reservation.cluster} · Blok{" "}
                  {reservation.block}
                </p>
              </div>
              <RowActions unit={reservation.unit} />
            </div>

            <div className="mt-4 grid gap-3 border-t border-gray-200 pt-3 text-xs sm:grid-cols-2">
              <div>
                <p className="text-gray-500">Tanggal Reservasi</p>
                <p className="mt-1 font-medium text-slate-700">
                  {formatReservationDate(reservation.reservationDate)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Harga Unit</p>
                <p className="mt-1 font-semibold tabular-nums text-slate-700">
                  {currencyFormatter.format(reservation.price)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-gray-500">Sales</p>
                <SalesCell sales={reservation.sales} />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-4 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Menampilkan{" "}
          <span className="font-semibold text-slate-700">
            {start}–{end}
          </span>{" "}
          dari <span className="font-semibold text-slate-700">{total}</span>{" "}
          reservasi
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="size-11 sm:size-7"
            aria-label="Halaman sebelumnya"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft data-icon="inline-start" />
          </Button>
          {pageNumbers.map((pageNumber) => (
            <Button
              key={pageNumber}
              type="button"
              variant={pageNumber === page ? "default" : "ghost"}
              size="icon-sm"
              className="size-11 sm:size-7"
              aria-label={`Halaman ${pageNumber}`}
              aria-current={pageNumber === page ? "page" : undefined}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </Button>
          ))}
          {totalPages > 5 && page < totalPages - 2 ? (
            <span className="px-1" aria-hidden="true">
              …
            </span>
          ) : null}
          {totalPages > 5 && !pageNumbers.includes(totalPages) ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-11 sm:size-7"
              aria-label={`Halaman ${totalPages}`}
              onClick={() => onPageChange(totalPages)}
            >
              {totalPages}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="size-11 sm:size-7"
            aria-label="Halaman berikutnya"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </>
  );
}
