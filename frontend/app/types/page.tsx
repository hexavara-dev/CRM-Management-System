"use client";

import { PageHeader } from "@/components/PageHeader";
import { AppSidebar } from "@/components/Sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { TypeGallery, typeGalleryPhotos } from "@/components/projects/type-gallery";
import { NoImagePlaceholder } from "@/components/projects/no-image-placeholder";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  Bath,
  BedDouble,
  Building2,
  Car,
  CircleCheck,
  CircleSlash,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  FileText,
  House,
  Layers3,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Shapes,
} from "lucide-react";
import { type SpecCode, specRange } from "@/lib/unit-specs";
import { useMemo, useState } from "react";
import { pageItems } from "@/lib/pagination";
import { toast } from "sonner";
import { buildTypeExport } from "./export-rows";
import { TypeDialog } from "./type-dialog";
import type { CellInput } from "jspdf-autotable";

const PAGE_SIZE = 5;
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
      className={`flex min-h-20 items-center gap-3 rounded-xl px-4 py-3 ${className}`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/80">
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className={`text-2xl font-bold leading-8 ${valueClassName}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function specifications({ typeVariants }: ProjectTypeRow) {
  const range = (code: SpecCode) => specRange(typeVariants, code);
  return [
    `LB ${range("building_area")} m²  |  LT ${range("surface_area")} m²`,
    `${range("bedroom")} Kamar Tidur`,
    `${range("bathroom")} Kamar Mandi`,
    `${range("carport")} Carport`,
  ];
}

export default function TypesPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "owner";
  const { data, isLoading, isError, error } = useProjectTypes();
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogKey, setDialogKey] = useState(0);
  const [previewRow, setPreviewRow] = useState<ProjectTypeRow | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectTypeRow | null>(null);
  const typeOptions = useMemo(
    () =>
      [
        ...new Set(
          (data?.rows ?? [])
            .filter(
              (row) =>
                projectFilter === "all" || row.projectId === projectFilter,
            )
            .map((row) => row.name),
        ),
      ].sort((a, b) => a.localeCompare(b, "id-ID", { numeric: true })),
    [data?.rows, projectFilter],
  );

  const filteredRows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("id-ID");
    return (data?.rows ?? []).filter((row) => {
      const matchesProject =
        projectFilter === "all" || row.projectId === projectFilter;
      const matchesType = typeFilter === "all" || row.name === typeFilter;
      const matchesStatus =
        statusFilter === "all" || row.isActive === (statusFilter === "active");
      const matchesSearch =
        !search || row.name.toLocaleLowerCase("id-ID").includes(search);
      return matchesProject && matchesType && matchesStatus && matchesSearch;
    });
  }, [data?.rows, projectFilter, query, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = filteredRows.slice(start, start + PAGE_SIZE);

  // Kunci baru setiap dialog dibuka agar isian form selalu mulai dari data yang benar.
  const openEdit = (row: ProjectTypeRow) => {
    setEditing(row);
    setDialogKey((key) => key + 1);
    setDialogOpen(true);
  };
  const openCreate = () => {
    setEditing(null);
    setDialogKey((key) => key + 1);
    setDialogOpen(true);
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    try {
      const ExcelJS = await import("exceljs");
      const { columns, rows, merges } = buildTypeExport(filteredRows);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Tipe Unit");
      sheet.views = [{ showGridLines: false }];
      sheet.addRow(columns);
      rows.forEach((row) => sheet.addRow(row));
      const cellBorder = {
        top: { style: "thin" as const, color: { argb: "FF000000" } },
        left: { style: "thin" as const, color: { argb: "FF000000" } },
        bottom: { style: "thin" as const, color: { argb: "FF000000" } },
        right: { style: "thin" as const, color: { argb: "FF000000" } },
      };
      for (const { column, start, end } of merges) {
        if (end > start) sheet.mergeCells(start + 2, column + 1, end + 2, column + 1);
      }
      // ExcelJS dapat mengubah style cell saat merge. Terapkan ulang ke seluruh
      // grid setelah merge agar border terlihat pada cell biasa maupun merged cell.
      for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
        for (
          let columnNumber = 1;
          columnNumber <= columns.length;
          columnNumber += 1
        ) {
          const cell = sheet.getCell(rowNumber, columnNumber);
          cell.border = cellBorder;
          cell.alignment = { vertical: "middle", wrapText: true };
        }
      }
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2D86B9" },
      };
      sheet.columns.forEach((column) => {
        column.width = 18;
      });
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([new Uint8Array(buffer as ArrayBuffer)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "tipe-unit.xlsx",
      );
      toast.success("Data tipe berhasil diekspor ke Excel.", {
        duration: 1000,
      });
    } catch {
      toast.error("Gagal mengekspor data tipe ke Excel.");
    }
  };

  const exportPdf = async () => {
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const { columns, rows, merges } = buildTypeExport(filteredRows);
      const document = new jsPDF({ orientation: "landscape" });
      document.setFontSize(14);
      document.text("Daftar Tipe Unit", 14, 14);
      const pdfBody: CellInput[][] = rows.map((row, rowIndex) =>
        row.flatMap((content, column): CellInput[] => {
          const merge = merges.find(
            (item) => item.column === column && item.start <= rowIndex && rowIndex <= item.end,
          );
          if (!merge) return [content];
          if (merge.start !== rowIndex) return [];
          return [{ content, rowSpan: merge.end - merge.start + 1, styles: { valign: "middle" as const } }];
        }),
      );
      autoTable(document, {
        head: [columns],
        body: pdfBody,
        startY: 20,
        theme: "grid",
        styles: {
          fontSize: 7,
          valign: "middle",
          lineColor: [0, 0, 0],
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: [45, 134, 185],
          textColor: 255,
          lineColor: [0, 0, 0],
          lineWidth: 0.15,
        },
      });
      document.save("tipe-unit.pdf");
      toast.success("Data tipe berhasil diekspor ke PDF.", {
        duration: 1000,
      });
    } catch {
      toast.error("Gagal mengekspor data tipe ke PDF.");
    }
  };

  const updateFilters = (callback: () => void) => {
    callback();
    setPage(1);
  };

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <PageHeader title="Types" breadcrumbs={["Product Management", "Types"]} />
        <main className="space-y-4 p-4">
          <div className="flex justify-end">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!filteredRows.length}
                    className="h-10 rounded-xl border-[#D0D5DD] px-4 text-sm"
                  >
                    <FileDown className="size-4" />
                    Ekspor
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={exportPdf}>
                    <FileText className="size-4" />
                    Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={exportExcel}>
                    <FileSpreadsheet className="size-4" />
                    Export Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canWrite && (
                <Button
                  type="button"
                  onClick={openCreate}
                  disabled={!data?.projects.length}
                  className="h-10 rounded-xl bg-[#0866FF] px-4 text-sm hover:bg-[#0757D5]"
                >
                  <Plus className="size-4" />
                  Tambah Tipe
                </Button>
              )}
            </div>
          </div>
          <p className="-mt-3 text-sm text-[#475467]">
            Kelola tipe unit (rumah) di setiap project perumahan.
          </p>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
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
                label="Total Unit Dibuat"
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
            <div className="grid gap-3 border-b border-[#E4EAF2] bg-[#FCFDFF] p-4 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(160px,0.8fr)_minmax(240px,1.6fr)_minmax(160px,0.8fr)]">
              <div className="space-y-1.5 text-xs font-semibold text-[#344054]">
                <span>Project</span>
                <SearchableSelect
                  value={projectFilter === "all" ? undefined : projectFilter}
                  onChange={(value) =>
                    updateFilters(() => {
                      setProjectFilter(value ?? "all");
                      setTypeFilter("all");
                    })
                  }
                  placeholder="Semua Project"
                  searchPlaceholder="Cari project..."
                  options={(data?.projects ?? []).map((project) => ({
                    value: project.id,
                    label: project.name,
                  }))}
                  loading={isLoading}
                  triggerClassName="h-10 bg-white text-sm font-normal text-foreground"
                />
              </div>
              <div className="space-y-1.5 text-xs font-semibold text-[#344054]">
                <span>Type</span>
                <SearchableSelect
                  value={typeFilter === "all" ? undefined : typeFilter}
                  onChange={(value) =>
                    updateFilters(() => setTypeFilter(value ?? "all"))
                  }
                  placeholder="Semua Type"
                  searchPlaceholder="Cari tipe..."
                  options={typeOptions.map((type) => ({ value: type, label: type }))}
                  triggerClassName="h-10 bg-white text-sm font-normal text-foreground"
                />
              </div>
              <div className="space-y-1.5 text-xs font-semibold text-[#344054]">
                <span>Pencarian</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#667085]" />
                  <Input
                    value={query}
                    onChange={(event) =>
                      updateFilters(() => setQuery(event.target.value))
                    }
                    placeholder="Cari nama tipe..."
                    className="h-10 bg-white pl-9 text-sm font-normal md:text-sm"
                  />
                </span>
              </div>
              <div className="space-y-1.5 text-xs font-semibold text-[#344054]">
                <span>Status</span>
                <SearchableSelect
                  value={statusFilter === "all" ? undefined : statusFilter}
                  onChange={(value) =>
                    updateFilters(() =>
                      setStatusFilter((value as "active" | "inactive" | undefined) ?? "all"),
                    )
                  }
                  placeholder="Semua Status"
                  searchPlaceholder="Cari status..."
                  options={[
                    { value: "active", label: "Aktif" },
                    { value: "inactive", label: "Nonaktif" },
                  ]}
                  triggerClassName="h-10 bg-white text-sm font-normal text-foreground"
                />
              </div>
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
                <Table className="min-w-[1080px] text-sm">
                  <TableHeader>
                    <TableRow className="bg-[#F5F8FC] hover:bg-[#F5F8FC]">
                      {[
                        "No.",
                        "Project",
                        "Type",
                        "Gambar",
                        "Spesifikasi Utama",
                        "Unit Dibuat",
                        "Status",
                        "Aksi",
                      ].map((heading) => (
                        <TableHead
                          key={heading}
                          className="h-12 px-4 text-sm font-semibold text-[#1e3a8a]"
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
                          <TableCell className="px-4 py-3 text-[#667085]">
                            {start + index + 1}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex min-w-[145px] items-start gap-2">
                              <Building2 className="mt-0.5 size-5 shrink-0 text-[#0866FF]" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[#101828]">
                                  {row.projectName}
                                </p>
                                <p className="max-w-56 truncate text-xs text-[#667085]" title={row.location || row.projectCode}>
                                  {row.location || row.projectCode}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <p className="whitespace-nowrap text-base font-bold text-[#101828]">
                              {row.name}
                            </p>
                            <p className="whitespace-nowrap text-xs text-[#1e3a8a]">
                              {row.typeVariants.length} varian
                            </p>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="size-20 overflow-hidden rounded-xl border border-[#E4EAF2] bg-[#F4F4F5]">
                              {typeGalleryPhotos(row)[0] ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewRow(row)}
                                  aria-label={`Lihat foto ${row.name}`}
                                  className="relative block size-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1980C0]"
                                >
                                  {/* Foto utama tipe; bila tidak ada, foto varian pertama. */}
                                  <img
                                    src={typeGalleryPhotos(row)[0].url}
                                    alt={`Tipe ${row.name}`}
                                    className="size-full object-cover transition-transform duration-200 hover:scale-105"
                                    loading="lazy"
                                  />
                                  {typeGalleryPhotos(row).length > 1 && (
                                    <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/65 px-1.5 text-[10px] font-medium text-white">
                                      +{typeGalleryPhotos(row).length - 1}
                                    </span>
                                  )}
                                </button>
                              ) : (
                                <NoImagePlaceholder compact />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="space-y-1 whitespace-nowrap text-xs leading-4 text-[#344054]">
                              {specifications(row).map((spec, specIndex) => (
                                <p
                                  key={`${row.id}-${specIndex}`}
                                  className="flex items-center gap-1.5"
                                >
                                  {(() => {
                                    const SpecIcon = [House, BedDouble, Bath, Car][specIndex] ?? Layers3;
                                    return <SpecIcon className="size-3.5 shrink-0 text-[#475467]" />;
                                  })()}
                                  {spec}
                                </p>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center text-base font-bold text-[#101828]">
                            {numberFormat.format(row.unitCount)}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {row.isActive ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F8EC] px-3 py-1 text-xs font-semibold text-[#12833B]">
                                <CircleCheck className="size-3.5" />
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F2F4F7] px-3 py-1 text-xs font-semibold text-[#667085]">
                                <CircleSlash className="size-3.5" />
                                Nonaktif
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {canWrite && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit ${row.name}`}
                                onClick={() => openEdit(row)}
                                className="text-[#344054] hover:text-[#0866FF]"
                              >
                                <Pencil className="size-4" />
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4EAF2] px-4 py-3 text-sm text-[#475467]">
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
                {pageItems(currentPage, totalPages).map((number, gapIndex) =>
                  number === "gap" ? (
                    <span key={`gap-${gapIndex}`} className="px-1 text-xs text-muted-foreground" aria-hidden="true">
                      …
                    </span>
                  ) : (
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
      {previewRow && <TypeGallery type={previewRow} onClose={() => setPreviewRow(null)} />}
      <TypeDialog
        key={dialogKey}
        open={dialogOpen}
        projects={data?.projects ?? []}
        initial={editing}
        onOpenChange={setDialogOpen}
      />
    </SidebarProvider>
  );
}
