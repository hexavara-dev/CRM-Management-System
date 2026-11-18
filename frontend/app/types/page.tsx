"use client";

import { PageHeading } from "@/components/PageHeading";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { NoImagePlaceholder } from "@/components/projects/no-image-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
  type ProjectTypeRow,
  useProjectTypes,
} from "@/hooks/use-project-types";
import { errorMessage } from "@/hooks/use-projects";
import {
  Barcode,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  House,
  Layers3,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Shapes,
} from "lucide-react";
import { useMemo, useState } from "react";
import { TypeDialog } from "./type-dialog";

const PAGE_SIZE = 5;
type StatusFilter = "all" | "active" | "inactive";
const numberFormat = new Intl.NumberFormat("id-ID");

function Metric({
  label,
  value,
  icon: Icon,
  className,
  valueClassName,
}: {
  label: string;
  value: string | number;
  icon: typeof Barcode;
  className: string;
  valueClassName: string;
}) {
  return (
    <div
      className={`flex min-h-[68px] items-center gap-3 rounded-xl px-3 py-2.5 ${className}`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/70">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium">{label}</p>
        <p className={`text-xl font-bold leading-6 ${valueClassName}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function specifications(row: ProjectTypeRow) {
  const attrs = row.attributes;
  return [
    `LB ${numberFormat.format(attrs.building_area)} m²  |  LT ${numberFormat.format(attrs.surface_area)} m²`,
    `${numberFormat.format(attrs.bedroom)} Kamar Tidur`,
    `${numberFormat.format(attrs.bathroom)} Kamar Mandi`,
    `${numberFormat.format(attrs.carport)} Carport`,
  ];
}

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function TypesPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "owner";
  const { data, isLoading, isError, error } = useProjectTypes();
  const [projectFilter, setProjectFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectTypeRow | null>(null);

  const filteredRows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("id-ID");
    return (data?.rows ?? []).filter((row) => {
      const matchesProject =
        projectFilter === "all" || row.projectId === projectFilter;
      const matchesStatus =
        statusFilter === "all" || row.isActive === (statusFilter === "active");
      const matchesSearch =
        !search ||
        `${row.name} ${row.projectName} ${row.projectCode} ${row.id}`
          .toLocaleLowerCase("id-ID")
          .includes(search);
      return matchesProject && matchesStatus && matchesSearch;
    });
  }, [data?.rows, projectFilter, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = filteredRows.slice(start, start + PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row: ProjectTypeRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const exportCsv = () => {
    const columns = [
      "Project",
      "Project Code",
      "Location",
      "Type",
      "Type ID",
      "Building Area",
      "Surface Area",
      "Floors",
      "Bedrooms",
      "Bathrooms",
      "Carport",
      "Total Unit",
      "Status",
    ];
    const lines = filteredRows.map((row) =>
      [
        row.projectName,
        row.projectCode,
        row.location,
        row.name,
        row.id,
        row.attributes.building_area,
        row.attributes.surface_area,
        row.attributes.floors,
        row.attributes.bedroom,
        row.attributes.bathroom,
        row.attributes.carport,
        row.stock,
        row.isActive ? "Aktif" : "Nonaktif",
      ]
        .map(escapeCsv)
        .join(","),
    );
    const blob = new Blob(
      [[columns.map(escapeCsv).join(","), ...lines].join("\r\n")],
      {
        type: "text/csv;charset=utf-8",
      },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "project-types.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const updateFilters = (callback: () => void) => {
    callback();
    setPage(1);
  };

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3 empty:hidden">
          <SidebarOpenTrigger />
        </header>
        <main className="space-y-4 p-4">
          <PageHeading
            title="Types"
            actions={
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={exportCsv}
                  disabled={!filteredRows.length}
                  className="h-9 border-[#D0D5DD] px-3 text-xs"
                >
                  <Download className="size-4" />
                  Ekspor
                </Button>
                {canWrite && (
                  <Button
                    type="button"
                    onClick={openCreate}
                    className="h-9 bg-[#0866FF] px-3 text-xs text-white hover:bg-[#0757D5]"
                  >
                    <Plus className="size-4" />
                    Tambah Tipe
                  </Button>
                )}
              </div>
            }
          />
          <p className="-mt-3 text-xs text-[#667085]">
            Kelola tipe unit (rumah) di setiap project perumahan.
          </p>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-[68px] rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric
                label="Total Tipe"
                value={data?.summary.totalTypes ?? 0}
                icon={Shapes}
                className="bg-[#EAF4FF] text-[#0866FF]"
                valueClassName="text-[#101828]"
              />
              <Metric
                label="Total Project"
                value={data?.summary.totalProjects ?? 0}
                icon={Building2}
                className="bg-[#EAFBEF] text-[#12833B]"
                valueClassName="text-[#101828]"
              />
              <Metric
                label="Total Unit"
                value={numberFormat.format(data?.summary.totalUnits ?? 0)}
                icon={House}
                className="bg-[#FFF5E5] text-[#E56B00]"
                valueClassName="text-[#101828]"
              />
              <Metric
                label="Rata-rata Tipe / Project"
                value={(data?.summary.averageTypes ?? 0).toLocaleString(
                  "id-ID",
                  { maximumFractionDigits: 1 },
                )}
                icon={Layers3}
                className="bg-[#F3EAFE] text-[#722ED1]"
                valueClassName="text-[#101828]"
              />
            </div>
          )}

          <section className="overflow-hidden rounded-xl border border-[#E4EAF2] bg-white">
            <div className="grid gap-2 border-b border-[#E4EAF2] bg-[#FCFDFF] p-3 md:grid-cols-[minmax(170px,0.75fr)_minmax(220px,1.5fr)_minmax(155px,0.7fr)]">
              <label className="space-y-1 text-[10px] font-semibold text-[#344054]">
                Project
                <Select
                  value={projectFilter}
                  onValueChange={(value) =>
                    updateFilters(() => setProjectFilter(value))
                  }
                >
                  <SelectTrigger className="h-8 bg-white text-xs">
                    <SelectValue placeholder="Semua Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Project</SelectItem>
                    {(data?.projects ?? []).map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1 text-[10px] font-semibold text-[#344054]">
                Pencarian
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#667085]" />
                  <Input
                    value={query}
                    onChange={(event) =>
                      updateFilters(() => setQuery(event.target.value))
                    }
                    placeholder="Cari nama tipe atau kode..."
                    className="h-8 bg-white pl-8 text-xs"
                  />
                </span>
              </label>
              <label className="space-y-1 text-[10px] font-semibold text-[#344054]">
                Status
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    updateFilters(() => setStatusFilter(value as StatusFilter))
                  }
                >
                  <SelectTrigger className="h-8 bg-white text-xs">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>

            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: PAGE_SIZE }, (_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : isError ? (
              <div className="px-4 py-16 text-center text-sm text-[#D92D20]">
                {errorMessage(error, "Gagal memuat data tipe.")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[980px] text-xs">
                  <TableHeader>
                    <TableRow className="bg-[#F5F8FC] hover:bg-[#F5F8FC]">
                      {[
                        "No.",
                        "Project",
                        "Type",
                        "Gambar",
                        "Spesifikasi Utama",
                        "Total Unit",
                        "Status",
                        "Aksi",
                      ].map((heading) => (
                        <TableHead
                          key={heading}
                          className="h-10 px-3 text-[10px] font-semibold text-[#344054]"
                        >
                          {heading}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-36 text-center text-sm text-[#667085]"
                        >
                          {filteredRows.length
                            ? "Tidak ada tipe pada halaman ini."
                            : "Belum ada data tipe yang cocok."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleRows.map((row, index) => (
                        <TableRow
                          key={row.id}
                          className="border-[#E9EEF5] hover:bg-[#FAFCFF]"
                        >
                          <TableCell className="px-3 py-2.5 text-[#667085]">
                            {start + index + 1}
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            <div className="flex min-w-[145px] items-start gap-2">
                              <Building2 className="mt-0.5 size-4 shrink-0 text-[#0866FF]" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[#101828]">
                                  {row.projectName}
                                </p>
                                <p className="truncate text-[10px] text-[#667085]">
                                  {row.location || row.projectCode}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            <p className="whitespace-nowrap font-semibold text-[#101828]">
                              {row.name}
                            </p>
                            <p className="whitespace-nowrap text-[10px] text-[#667085]">
                              ID: {row.id.slice(0, 8).toUpperCase()}
                            </p>
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            <div className="size-[76px] overflow-hidden rounded-lg border border-[#E4EAF2] bg-[#F4F4F5]">
                              {row.image ? (
                                <img
                                  src={row.image}
                                  alt={`Tipe ${row.name}`}
                                  className="size-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <NoImagePlaceholder compact />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            <div className="space-y-0.5 whitespace-nowrap text-[10px] leading-4 text-[#344054]">
                              {specifications(row).map((spec, specIndex) => (
                                <p
                                  key={`${row.id}-${specIndex}`}
                                  className="flex items-center gap-1.5"
                                >
                                  {specIndex === 0 ? (
                                    <House className="size-3 shrink-0" />
                                  ) : specIndex === 3 ? (
                                    <Barcode className="size-3 shrink-0" />
                                  ) : (
                                    <Layers3 className="size-3 shrink-0" />
                                  )}
                                  {spec}
                                </p>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-center font-semibold text-[#344054]">
                            {numberFormat.format(row.stock)}
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            <Badge
                              className={
                                row.isActive
                                  ? "bg-[#DCFCE7] text-[#15803D]"
                                  : "bg-[#F2F4F7] text-[#667085]"
                              }
                            >
                              <Check />
                              {row.isActive ? "Aktif" : "Nonaktif"}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            {canWrite && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit ${row.name}`}
                                onClick={() => openEdit(row)}
                                className="text-[#344054] hover:text-[#0866FF]"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            )}
                            {!canWrite && (
                              <MoreVertical className="size-4 text-[#98A2B3]" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4EAF2] px-3 py-2.5 text-[10px] text-[#475467]">
              <span>
                Menampilkan {filteredRows.length ? start + 1 : 0}–
                {Math.min(start + PAGE_SIZE, filteredRows.length)} dari{" "}
                {filteredRows.length} tipe
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Halaman sebelumnya"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((number) => (
                  <Button
                    key={number}
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-current={number === currentPage ? "page" : undefined}
                    onClick={() => setPage(number)}
                    className={
                      number === currentPage
                        ? "border-[#0866FF] bg-[#0866FF] text-white hover:bg-[#0757D5] hover:text-white"
                        : ""
                    }
                  >
                    {number}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Halaman berikutnya"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </section>
        </main>
      </SidebarInset>
      <TypeDialog
        open={dialogOpen}
        projects={data?.projects ?? []}
        initial={editing}
        onOpenChange={setDialogOpen}
      />
    </SidebarProvider>
  );
}
