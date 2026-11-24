"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, Eye, FileText, Info, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useDeleteFormTemplate,
  useDuplicateFormTemplate,
  useFormTemplates,
  type FormTemplateStatus,
  type FormTemplateSummary,
} from "@/hooks/use-form-templates";
import { errorMessage } from "@/hooks/use-projects";
import { pageItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { ConfigHeader } from "../config-header";
import { LabelIcon } from "../leads-label/label-icons";
import { PreviewDialog } from "./preview-dialog";

const PAGE_SIZES = [10, 20, 50];
const ALL = "all";

/** "10 Nov 2026, 09:24" (waktu lokal browser). */
const formatDateTime = (value: string) => {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${day}, ${time.replace(".", ":")}`;
};

export default function FormTemplatePage() {
  const { user } = useAuth();
  const canWrite = user?.role === "owner";

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FormTemplateStatus>();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [previewId, setPreviewId] = useState<string>();
  const [deleting, setDeleting] = useState<FormTemplateSummary>();
  const [copying, setCopying] = useState<FormTemplateSummary>();
  const search = useDebouncedValue(query.trim());

  const templates = useFormTemplates({ search, status, page, limit });
  const duplicate = useDuplicateFormTemplate();
  const remove = useDeleteFormTemplate();

  const rows = templates.data?.data ?? [];
  const total = templates.data?.meta.total ?? 0;
  const totalPages = Math.max(1, templates.data?.meta.totalPages ?? 1);
  const start = (page - 1) * limit;
  const filtered = !!search || !!status;

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3 empty:hidden">
          <SidebarOpenTrigger />
        </header>
        <div className="space-y-4 p-4">
          <ConfigHeader icon={FileText} description="Kelola template form untuk pengumpulan data Lead sesuai kebutuhan bisnis." />

          <div className="flex gap-3 rounded-xl border border-[#1980C0]/20 bg-[#E5F1FA]/60 p-4">
            <Info className="mt-0.5 size-5 shrink-0 text-[#1980C0]" />
            <div>
              <p className="font-semibold text-[#1f1f1f]">Form Template</p>
              <p className="text-sm text-[#475467]">
                Buat dan kelola template form (custom field) yang digunakan saat menambah Lead. Field standar seperti
                Nama, Nomor HP, dan Email sudah tersedia secara default.
              </p>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative sm:w-80">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Cari template..."
                    className="h-10 bg-white pl-8"
                  />
                </div>
                <Select
                  value={status ?? ALL}
                  onValueChange={(value) => {
                    setStatus(value === ALL ? undefined : (value as FormTemplateStatus));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 bg-white sm:w-48" aria-label="Filter status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Status: Semua</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {canWrite && (
                <Button asChild className="h-10 bg-[#1980C0] px-5 text-white hover:bg-[#166ea6]">
                  <Link href="/crm-configuration/form-template/new">
                    <Plus className="size-4" />
                    Tambah Template
                  </Link>
                </Button>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white">
            {templates.isLoading ? (
              <Skeleton className="m-4 h-60 rounded-lg" />
            ) : templates.isError ? (
              <div className="py-12 text-center text-sm text-[#D64545]">
                {errorMessage(templates.error, "Gagal memuat template.")}
              </div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#6b6b6b]">
                {filtered
                  ? "Tidak ada template yang cocok dengan filter."
                  : `Belum ada template.${canWrite ? " Klik Tambah Template untuk membuat." : ""}`}
              </div>
            ) : (
              <div className={cn("overflow-x-auto", templates.isFetching && "opacity-70")}>
                <Table>
                  <TableHeader>
                    <TableRow className="h-12 bg-[#F8FAFC] [&>th]:px-4 [&>th]:font-semibold [&>th]:text-[#1f1f1f]">
                      <TableHead>Nama Template</TableHead>
                      <TableHead>Deskripsi</TableHead>
                      <TableHead className="text-center">Jumlah Field</TableHead>
                      <TableHead>Terakhir Diubah</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((template) => (
                      <TableRow key={template.id} className="[&>td]:px-4 [&>td]:py-4">
                        <TableCell className="min-w-64">
                          <div className="flex items-center gap-3">
                            <LabelIcon icon={template.icon} color={template.color} className="flex size-12 shrink-0 items-center justify-center rounded-xl" />
                            <span className="text-base font-semibold text-[#1f1f1f]">{template.name}</span>
                            {template.isDefault && (
                              <span className="rounded-md bg-[#E5F1FA] px-2 py-0.5 text-xs font-medium text-[#1980C0]">Default</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-64 max-w-md whitespace-normal text-sm text-[#1f1f1f]">
                          {template.description ?? <span className="text-[#6b6b6b]">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="whitespace-nowrap rounded-md bg-[#E5F1FA] px-2.5 py-1 text-sm font-medium text-[#1f1f1f]">{template.fieldCount} Field</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <p className="text-[#1f1f1f]">{formatDateTime(template.updatedAt)}</p>
                          {template.updatedBy?.name && <p className="text-xs text-[#6b6b6b]">oleh {template.updatedBy.name}</p>}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "rounded-md px-2.5 py-1 text-sm font-medium",
                              template.isActive ? "bg-[#E6F6EC] text-[#1E9E55]" : "bg-[#F3F4F6] text-[#6b6b6b]",
                            )}
                          >
                            {template.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Preview ${template.name}`} onClick={() => setPreviewId(template.id)}>
                              <Eye className="size-4" />
                            </Button>
                            {canWrite && (
                              <>
                                <Button asChild variant="ghost" size="icon-sm" aria-label={`Edit ${template.name}`}>
                                  <Link href={`/crm-configuration/form-template/${template.id}`}>
                                    <Pencil className="size-4" />
                                  </Link>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Duplikat ${template.name}`}
                                  disabled={duplicate.isPending}
                                  onClick={() => setCopying(template)}
                                >
                                  <Copy className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Hapus ${template.name}`}
                                  title={template.isDefault ? "Template default tidak dapat dihapus" : undefined}
                                  disabled={template.isDefault}
                                  className="text-[#D64545] hover:text-[#D64545]"
                                  onClick={() => setDeleting(template)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-[#EDEDED] px-4 py-3 text-sm text-[#475467] sm:flex-row sm:items-center sm:justify-between">
              <p>
                Menampilkan {total === 0 ? 0 : start + 1} – {start + rows.length} dari {total} template
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
            </div>
          </section>
        </div>
      </SidebarInset>

      <PreviewDialog id={previewId} onOpenChange={(open) => !open && setPreviewId(undefined)} />
      <ConfirmModal
        isOpen={!!copying}
        onClose={() => setCopying(undefined)}
        onConfirm={() => copying && duplicate.mutate(copying.id, { onSettled: () => setCopying(undefined) })}
        title="Salin template?"
        description={
          copying
            ? `"${copying.name}" beserta semua field-nya akan disalin menjadi template baru. Salinan berstatus aktif, bukan template default, dan dapat diubah setelah dibuat.`
            : ""
        }
        loading={duplicate.isPending}
      />
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
        title="Hapus template?"
        description={
          deleting
            ? `"${deleting.name}" beserta field-nya akan dihapus permanen. Template yang sudah dipakai Lead tidak dapat dihapus; nonaktifkan saja.`
            : ""
        }
        loading={remove.isPending}
      />
    </SidebarProvider>
  );
}
