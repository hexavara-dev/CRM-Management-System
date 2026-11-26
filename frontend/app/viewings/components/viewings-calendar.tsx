"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatViewingStartTime,
  formatViewingTimeRange,
  getViewingCustomerName,
  getViewingProjectName,
  getViewingSalesName,
} from "@/lib/viewing-display";
import type { Viewing } from "@/types/viewing";
import { MapPin, Pencil, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { ViewingStatusPill, resolveStatusColor } from "./viewing-status-pill";

const MAX_PREVIEW_ITEMS_PER_DAY = 2;
const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function toDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - startOffset + 1;
    return new Date(year, month, dayNumber);
  });
}

type ViewingsCalendarProps = {
  viewings: Viewing[];
  isLoading: boolean;
  isError?: boolean;
  currentMonth: Date;
  onEdit: (viewing: Viewing) => void;
  onDelete: (viewing: Viewing) => void;
};

function VisitCard({ viewing }: { viewing: Viewing }) {
  const color = resolveStatusColor(viewing.status);
  return (
    <div
      className="rounded-md border-l-4 px-2 py-1.5 text-xs"
      style={{ borderLeftColor: color, backgroundColor: `${color}14` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1 font-semibold text-slate-900">
          <UserRound className="h-3 w-3 shrink-0" />
          <span className="truncate">{getViewingCustomerName(viewing)}</span>
        </p>
        <span className="shrink-0 text-slate-600">
          {formatViewingStartTime(viewing)}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[11px] text-slate-600">
        Sales: {getViewingSalesName(viewing)}
      </p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-700">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{getViewingProjectName(viewing)}</span>
      </p>
    </div>
  );
}

export function ViewingsCalendar({
  viewings,
  isLoading,
  isError,
  currentMonth,
  onEdit,
  onDelete,
}: ViewingsCalendarProps) {
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const groupedViewingsByDate = useMemo(() => {
    const grouped = new Map<string, Viewing[]>();

    viewings.forEach((viewing) => {
      const dateKey = toDateKey(viewing.scheduledAt);
      const existing = grouped.get(dateKey) || [];
      existing.push(viewing);
      grouped.set(dateKey, existing);
    });

    grouped.forEach((items, key) => {
      grouped.set(
        key,
        [...items].sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime(),
        ),
      );
    });

    return grouped;
  }, [viewings]);

  const calendarDays = useMemo(
    () => getMonthCalendarDays(currentMonth),
    [currentMonth],
  );

  const selectedViewings = useMemo(() => {
    if (!selectedDateKey) return [];
    return groupedViewingsByDate.get(selectedDateKey) || [];
  }, [groupedViewingsByDate, selectedDateKey]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDateKey) return "";
    const date = new Date(`${selectedDateKey}T00:00:00`);
    if (Number.isNaN(date.getTime())) return selectedDateKey;
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }, [selectedDateKey]);

  const openDateDialog = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setIsDialogOpen(true);
  };

  const todayKey = toDateKey(new Date());

  return (
    <>
      <div className="flex min-h-0 flex-1 overflow-auto rounded-xl border bg-white">
        <div className="flex min-h-full min-w-225 flex-1 flex-col">
          <div className="grid grid-cols-7 border-b bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            {WEEKDAY_LABELS.map((dayName) => (
              <div
                key={dayName}
                className="border-r px-3 py-2.5 last:border-r-0"
              >
                {dayName}
              </div>
            ))}
          </div>

          <div
            className="grid flex-1 grid-cols-7"
            style={{
              gridTemplateRows: `repeat(${calendarDays.length / 7}, minmax(6rem, 1fr))`,
            }}
          >
            {calendarDays.map((day) => {
              const dateKey = toDateKey(day);
              const dayViewings = groupedViewingsByDate.get(dateKey) || [];
              const previewItems = dayViewings.slice(
                0,
                MAX_PREVIEW_ITEMS_PER_DAY,
              );
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isToday = dateKey === todayKey;

              if (!isCurrentMonth) {
                return (
                  <div
                    key={dateKey}
                    className="min-h-24 border-r border-b bg-white p-2 last:border-r-0"
                  >
                    <span className="text-sm text-slate-300">
                      {day.getDate()}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={dateKey}
                  className="min-h-24 cursor-pointer border-r border-b bg-white p-2 transition-colors last:border-r-0 hover:bg-slate-50/60"
                  role="button"
                  tabIndex={0}
                  onClick={() => openDateDialog(dateKey)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDateDialog(dateKey);
                    }
                  }}
                >
                  <div className="mb-1.5">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-sm font-medium ${
                        isToday ? "bg-blue-600 text-white" : "text-slate-800"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {isLoading && dayViewings.length > 0
                      ? Array.from({
                          length: Math.min(
                            MAX_PREVIEW_ITEMS_PER_DAY,
                            dayViewings.length,
                          ),
                        }).map((_, index) => (
                          <div
                            key={`skeleton-${dateKey}-${index}`}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2"
                          >
                            <div className="h-2.5 w-4/5 animate-pulse rounded bg-slate-200" />
                            <div className="mt-2 h-2 w-1/2 animate-pulse rounded bg-slate-200" />
                          </div>
                        ))
                      : previewItems.map((viewing) => (
                          <VisitCard key={viewing.id} viewing={viewing} />
                        ))}

                    {dayViewings.length > MAX_PREVIEW_ITEMS_PER_DAY ? (
                      <span className="inline-flex text-xs font-medium text-blue-600">
                        +{dayViewings.length - MAX_PREVIEW_ITEMS_PER_DAY}{" "}
                        lainnya
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-slate-500">Memuat jadwal visit...</p>
      ) : isError ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          Gagal memuat jadwal visit. Pastikan backend memakai versi terbaru,
          lalu muat ulang halaman.
        </p>
      ) : viewings.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Belum ada jadwal visit pada bulan ini untuk filter yang dipilih.
        </p>
      ) : null}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="flex max-h-[90vh] w-full max-w-[95vw] flex-col overflow-hidden sm:max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="capitalize">
              Visit pada {selectedDateLabel}
            </DialogTitle>
            <DialogDescription>
              Total {selectedViewings.length} visit terjadwal.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
              Memuat jadwal visit...
            </div>
          ) : selectedViewings.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
              Belum ada visit pada tanggal ini.
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-background">
              <div className="min-w-160">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Sales</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedViewings.map((viewing) => (
                      <TableRow key={viewing.id}>
                        <TableCell className="font-medium">
                          {getViewingCustomerName(viewing)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getViewingSalesName(viewing)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getViewingProjectName(viewing)}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatViewingTimeRange(viewing)}
                        </TableCell>
                        <TableCell>
                          <ViewingStatusPill status={viewing.status} />
                        </TableCell>
                        <TableCell className="max-w-45 truncate text-sm text-muted-foreground">
                          {viewing.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Edit Visit"
                              onClick={() => {
                                setIsDialogOpen(false);
                                onEdit(viewing);
                              }}
                            >
                              <Pencil className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Hapus Visit"
                              onClick={() => {
                                setIsDialogOpen(false);
                                onDelete(viewing);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
