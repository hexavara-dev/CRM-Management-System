"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatViewingTimeRange,
  getInitials,
  getViewingCustomerName,
  getViewingPhone,
  getViewingProjectName,
  getViewingSalesName,
} from "@/lib/viewing-display";
import type { Pagination as PaginationMeta } from "@/types/api";
import type { Viewing } from "@/types/viewing";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  ExternalLink,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ViewingStatusPill } from "./viewing-status-pill";

export type ViewingSortField =
  | "scheduledAt"
  | "customerName"
  | "phone"
  | "sales"
  | "status";
export type ViewingSortOrder = "asc" | "desc";

type ViewingsTableProps = {
  viewings: Viewing[];
  isLoading: boolean;
  isError?: boolean;
  meta?: PaginationMeta;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  sortBy: ViewingSortField;
  sortOrder: ViewingSortOrder;
  onSortChange: (field: ViewingSortField) => void;
  onEdit: (viewing: Viewing) => void;
  onDelete: (viewing: Viewing) => void;
};

const DAY_MONTH_YEAR = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  year: "numeric",
});
const WEEKDAY = new Intl.DateTimeFormat("id-ID", { weekday: "long" });

function pageWindow(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages]
    .filter((value) => value >= 1 && value <= total)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  for (const value of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && value - previous > 1)
      result.push("ellipsis");
    result.push(value);
  }
  return result;
}

function SortableHead({
  label,
  field,
  sortBy,
  sortOrder,
  onSortChange,
}: {
  label: string;
  field: ViewingSortField;
  sortBy: ViewingSortField;
  sortOrder: ViewingSortOrder;
  onSortChange: (field: ViewingSortField) => void;
}) {
  const isActive = sortBy === field;
  const Icon = !isActive
    ? ChevronsUpDown
    : sortOrder === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSortChange(field)}
      className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium"
      aria-label={`Urutkan berdasarkan ${label}`}
    >
      {label}
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

export function ViewingsTable({
  viewings,
  isLoading,
  isError,
  meta,
  page,
  limit,
  onPageChange,
  sortBy,
  sortOrder,
  onSortChange,
  onEdit,
  onDelete,
}: ViewingsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected =
    viewings.length > 0 &&
    viewings.every((viewing) => selectedIds.has(viewing.id));

  const toggleAll = (checked: boolean) =>
    setSelectedIds(
      checked ? new Set(viewings.map((viewing) => viewing.id)) : new Set(),
    );

  const toggleOne = (id: string, checked: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const total = meta?.total ?? viewings.length;
  const totalPages = meta?.totalPages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to =
    total === 0 ? 0 : Math.min((page - 1) * limit + viewings.length, total);
  const pages = useMemo(() => pageWindow(page, totalPages), [page, totalPages]);

  const sortProps = { sortBy, sortOrder, onSortChange };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Pilih semua visit"
                />
              </TableHead>
              <TableHead>
                <SortableHead
                  label="Tanggal Visit"
                  field="scheduledAt"
                  {...sortProps}
                />
              </TableHead>
              <TableHead>
                <SortableHead
                  label="Nama Customer"
                  field="customerName"
                  {...sortProps}
                />
              </TableHead>
              <TableHead>
                <SortableHead
                  label="No. Telepon"
                  field="phone"
                  {...sortProps}
                />
              </TableHead>
              <TableHead>
                <SortableHead label="Sales" field="sales" {...sortProps} />
              </TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Waktu</TableHead>
              <TableHead>
                <SortableHead label="Status" field="status" {...sortProps} />
              </TableHead>
              <TableHead className="text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, row) => (
                <TableRow key={`loading-${row}`}>
                  {Array.from({ length: 9 }).map((__, cell) => (
                    <TableCell key={`loading-${row}-${cell}`}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : viewings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {isError
                    ? "Gagal memuat jadwal visit. Pastikan backend memakai versi terbaru, lalu muat ulang halaman."
                    : "Belum ada jadwal visit untuk filter ini."}
                </TableCell>
              </TableRow>
            ) : (
              viewings.map((viewing) => {
                const date = new Date(viewing.scheduledAt);
                const salesName = getViewingSalesName(viewing);
                return (
                  <TableRow
                    key={viewing.id}
                    data-state={
                      selectedIds.has(viewing.id) ? "selected" : undefined
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(viewing.id)}
                        onCheckedChange={(checked) =>
                          toggleOne(viewing.id, checked === true)
                        }
                        aria-label={`Pilih visit ${getViewingCustomerName(viewing)}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="leading-tight">
                        <div className="text-base font-bold">
                          {date.getDate()}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {DAY_MONTH_YEAR.format(date)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {WEEKDAY.format(date)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {getViewingCustomerName(viewing)}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {getViewingPhone(viewing)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback className="bg-blue-50 text-[10px] font-semibold text-blue-700">
                            {getInitials(salesName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm whitespace-nowrap">
                          {salesName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell
                      className="max-w-44 truncate text-sm"
                      title={getViewingProjectName(viewing)}
                    >
                      {getViewingProjectName(viewing)}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatViewingTimeRange(viewing)}
                    </TableCell>
                    <TableCell>
                      <ViewingStatusPill status={viewing.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Aksi visit"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onEdit(viewing)}>
                            <Pencil className="h-4 w-4" />
                            Edit Visit
                          </DropdownMenuItem>
                          {viewing.leadId ? (
                            <DropdownMenuItem asChild>
                              <Link href={`/leads/${viewing.leadId}?tab=visit`}>
                                <ExternalLink className="h-4 w-4" />
                                Detail Lead
                              </Link>
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onDelete(viewing)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Menampilkan {from} – {to} dari {total} data
        </p>
        {totalPages > 1 ? (
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text=""
                  aria-disabled={page <= 1}
                  className={
                    page <= 1 ? "pointer-events-none opacity-50" : undefined
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    if (page > 1) onPageChange(page - 1);
                  }}
                />
              </PaginationItem>
              {pages.map((entry, index) =>
                entry === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={entry}>
                    <PaginationLink
                      href="#"
                      isActive={entry === page}
                      className={
                        entry === page
                          ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-600 hover:text-white"
                          : undefined
                      }
                      onClick={(event) => {
                        event.preventDefault();
                        onPageChange(entry);
                      }}
                    >
                      {entry}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  text=""
                  aria-disabled={page >= totalPages}
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    if (page < totalPages) onPageChange(page + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}
      </div>
    </div>
  );
}
