"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Columns3, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { AppSidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { FacilityIcon } from "@/components/projects/facility-icon";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useDeleteProjectFacility,
  useProjectFacilityList,
  type ProjectFacility,
  type ProjectFacilityStatus,
} from "@/hooks/use-project-facilities";
import { errorMessage } from "@/hooks/use-projects";
import { pageItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { FacilityDialog } from "./facility-dialog";

const PAGE_SIZES = [10, 25, 50];
const ALL = "all";

const COLUMNS = { icon: "Ikon", description: "Deskripsi", usage: "Digunakan", status: "Status" } as const;
type Column = keyof typeof COLUMNS;

export default function FacilityConfigurationPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "owner";

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectFacilityStatus>();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [hidden, setHidden] = useState<Column[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; facility?: ProjectFacility }>({ open: false });
  const [deleting, setDeleting] = useState<ProjectFacility>();
  const search = useDebouncedValue(query.trim());

  const facilities = useProjectFacilityList({ search, status, page, limit });
  const remove = useDeleteProjectFacility();

  const rows = facilities.data?.data ?? [];
  const total = facilities.data?.meta.total ?? 0;
  const totalPages = Math.max(1, facilities.data?.meta.totalPages ?? 1);
  const start = (page - 1) * limit;
  const filtered = !!search || !!status;
  const show = (column: Column) => !hidden.includes(column);

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <PageHeader
          title="Konfigurasi Fasilitas"
          breadcrumbs={["Product Management", "Konfigurasi Fasilitas"]}
          actions={
            canWrite ? (
              <Button
                type="button"
                onClick={() => setDialog({ open: true })}
                className="bg-[#1980C0] text-white hover:bg-[#166ea6]"
              >
                <Plus className="size-4" />
                Tambah Fasilitas
              </Button>
            ) : undefined
          }
        />
        <div className="space-y-4 p-4">
          <section className="space-y-4 rounded-xl border border-[#E4E4E7] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="relative sm:w-80">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari nama fasilitas"
                  className="h-9 pl-8"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div>
                  <p className="mb-1 text-sm font-medium text-[#1f1f1f]">Status</p>
                  <Select
                    value={status ?? ALL}
                    onValueChange={(value) => {
                      setStatus(value === ALL ? undefined : (value as ProjectFacilityStatus));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 sm:w-48" aria-label="Filter status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Semua Status</SelectItem>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="inactive">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="h-9">
                      <Columns3 className="size-4" />
                      Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuLabel>Tampilkan kolom</DropdownMenuLabel>
                    {(Object.keys(COLUMNS) as Column[]).map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column}
                        checked={show(column)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) =>
                          setHidden((h) => (checked ? h.filter((c) => c !== column) : [...h, column]))
                        }
                      >
                        {COLUMNS[column]}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {facilities.isLoading ? (
              <Skeleton className="h-60 rounded-xl" />
            ) : facilities.isError ? (
              <div className="rounded-xl border border-dashed border-[#D64545]/40 py-12 text-center text-sm text-[#D64545]">
                {errorMessage(facilities.error, "Gagal memuat fasilitas.")}
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E4E4E7] py-12 text-center text-sm text-[#6b6b6b]">
                {filtered
                  ? "Tidak ada fasilitas yang cocok dengan filter."
                  : `Belum ada fasilitas.${canWrite ? " Klik Tambah Fasilitas untuk menambahkan." : ""}`}
              </div>
            ) : (
              <div className={cn("overflow-x-auto rounded-xl border border-[#E4E4E7]", facilities.isFetching && "opacity-70")}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F8FAFC]">
                      <TableHead>Nama Fasilitas</TableHead>
                      {show("icon") && <TableHead className="w-20 text-center">Ikon</TableHead>}
                      {show("description") && <TableHead>Deskripsi</TableHead>}
                      {show("usage") && <TableHead className="w-32 text-center">Digunakan</TableHead>}
                      {show("status") && <TableHead className="w-28 text-center">Status</TableHead>}
                      {canWrite && <TableHead className="w-24 text-center">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((facility) => (
                      <TableRow key={facility.id}>
                        <TableCell className="max-w-64 whitespace-normal font-semibold text-[#1f1f1f]">{facility.name}</TableCell>
                        {show("icon") && (
                          <TableCell>
                            <div className="flex justify-center">
                              <span className="flex size-9 items-center justify-center rounded-lg bg-[#E5F1FA] text-[#1980C0]">
                                <FacilityIcon iconKey={facility.iconKey} className="size-4" />
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {show("description") && (
                          <TableCell className="min-w-64 max-w-md whitespace-normal text-sm text-[#1f1f1f]">
                            {facility.description ?? <span className="text-[#6b6b6b]">-</span>}
                          </TableCell>
                        )}
                        {show("usage") && (
                          <TableCell className="text-center text-sm text-[#1f1f1f]">{facility.usageCount} project</TableCell>
                        )}
                        {show("status") && (
                          <TableCell className="text-center">
                            <span
                              className={cn(
                                "rounded-md px-2 py-1 text-xs font-medium",
                                facility.isActive ? "bg-[#E6F6EC] text-[#1E9E55]" : "bg-[#F3F4F6] text-[#6b6b6b]",
                              )}
                            >
                              {facility.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </TableCell>
                        )}
                        {canWrite && (
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit ${facility.name}`}
                                onClick={() => setDialog({ open: true, facility })}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Hapus ${facility.name}`}
                                className="text-[#D64545] hover:text-[#D64545]"
                                onClick={() => setDeleting(facility)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex flex-col gap-3 text-sm text-[#475467] sm:flex-row sm:items-center sm:justify-between">
              <p>
                Menampilkan {total === 0 ? 0 : start + 1} – {start + rows.length} dari {total} data
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2">
                  Baris per halaman
                  <Select
                    value={String(limit)}
                    onValueChange={(value) => {
                      setLimit(Number(value));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-20" aria-label="Baris per halaman">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon-sm" aria-label="Halaman sebelumnya" disabled={page === 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  {pageItems(page, totalPages).map((n, gapIndex) =>
                  n === "gap" ? (
                    <span key={`gap-${gapIndex}`} className="px-1 text-xs text-muted-foreground" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <Button
                      key={n}
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-current={n === page ? "page" : undefined}
                      onClick={() => setPage(n)}
                      className={cn(n === page && "border-[#1980C0] bg-[#1980C0] text-white hover:bg-[#166ea6] hover:text-white")}
                    >
                      {n}
                    </Button>
                  ))}
                  <Button type="button" variant="outline" size="icon-sm" aria-label="Halaman berikutnya" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </SidebarInset>

      {canWrite && (
        <FacilityDialog
          open={dialog.open}
          facility={dialog.facility}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        />
      )}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(undefined)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(undefined);
              if (rows.length === 1 && page > 1) setPage(page - 1);
            },
          })
        }
        title="Hapus fasilitas?"
        description={
          deleting
            ? `"${deleting.name}" akan dihapus permanen. Fasilitas yang masih digunakan project tidak dapat dihapus, nonaktifkan saja.`
            : ""
        }
        loading={remove.isPending}
      />
    </SidebarProvider>
  );
}
