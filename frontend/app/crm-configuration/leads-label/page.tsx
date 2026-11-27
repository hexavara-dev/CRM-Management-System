"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Info, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { AppSidebar } from "@/components/Sidebar";
import { ConfigHeader, ConfigNavbar } from "../config-header";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useDeleteLeadLabel,
  useLeadLabels,
  useToggleLeadLabel,
  type LeadLabel,
  type LeadLabelType,
} from "@/hooks/use-lead-labels";
import { errorMessage } from "@/hooks/use-projects";
import { pageItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { LabelDialog } from "./label-dialog";
import { LabelBadge, LabelIcon } from "./label-icons";
import { Switch } from "./toggle";

const PAGE_SIZES = [10, 20, 50];

const TABS: Record<LeadLabelType, { title: string; icon: typeof Flame; info: string }> = {
  TEMPERATURE: {
    title: "Temperature",
    icon: Flame,
    info: "Menunjukkan tingkat ketertarikan/potensi Lead. Satu Lead hanya dapat memiliki satu Temperature aktif.",
  },
  TAG: {
    title: "Tags",
    icon: Tag,
    info: "Label tambahan untuk mengelompokkan karakteristik, kebutuhan, atau kondisi khusus Lead. Satu Lead dapat memiliki lebih dari satu Tag.",
  },
};

export default function LeadsLabelPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "owner";

  const [type, setType] = useState<LeadLabelType>("TEMPERATURE");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [dialog, setDialog] = useState<{ open: boolean; label?: LeadLabel }>({ open: false });
  const [deleting, setDeleting] = useState<LeadLabel>();

  const labels = useLeadLabels(type, page, limit);
  const toggle = useToggleLeadLabel();
  const remove = useDeleteLeadLabel();

  const rows = labels.data?.data ?? [];
  const total = labels.data?.meta.total ?? 0;
  const totalPages = Math.max(1, labels.data?.meta.totalPages ?? 1);
  const start = (page - 1) * limit;
  const isTemperature = type === "TEMPERATURE";
  const tab = TABS[type];

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <ConfigNavbar />
        <div className="space-y-4 p-4">
          <ConfigHeader
            icon={Tag}
            description="Kelola label yang digunakan untuk mengklasifikasikan dan memberikan konteks pada Lead."
          />

          <section className="space-y-4 rounded-xl border border-[#E4E4E7] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2" role="tablist" aria-label="Jenis label">
                {(Object.keys(TABS) as LeadLabelType[]).map((key) => {
                  const { title, icon: Icon } = TABS[key];
                  const active = key === type;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setType(key);
                        setPage(1);
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                        active
                          ? "border-[#1980C0] bg-white text-[#1980C0]"
                          : "border-transparent bg-[#F3F4F6] text-[#1f1f1f] hover:bg-[#E9E8EC]",
                      )}
                    >
                      <Icon className="size-4" />
                      {title} ({labels.data?.counts[key] ?? 0})
                    </button>
                  );
                })}
              </div>
              {canWrite && (
                <Button
                  type="button"
                  onClick={() => setDialog({ open: true })}
                  className="bg-[#1980C0] text-white hover:bg-[#166ea6]"
                >
                  <Plus className="size-4" />
                  Add Label
                </Button>
              )}
            </div>

            <div className="flex gap-3 rounded-xl border border-[#1980C0]/20 bg-[#E5F1FA]/60 p-4">
              <Info className="mt-0.5 size-5 shrink-0 text-[#1980C0]" />
              <div>
                <p className="font-semibold text-[#1f1f1f]">{tab.title}</p>
                <p className="text-sm text-[#475467]">{tab.info}</p>
              </div>
            </div>

            {labels.isLoading ? (
              <Skeleton className="h-60 rounded-xl" />
            ) : labels.isError ? (
              <div className="rounded-xl border border-dashed border-[#D64545]/40 py-12 text-center text-sm text-[#D64545]">
                {errorMessage(labels.error, "Gagal memuat label.")}
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E4E4E7] py-12 text-center text-sm text-[#6b6b6b]">
                Belum ada label {tab.title}.{canWrite && " Klik Add Label untuk menambahkan."}
              </div>
            ) : (
              <div className={cn("overflow-x-auto rounded-xl border border-[#E4E4E7]", labels.isFetching && "opacity-70")}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F8FAFC]">
                      <TableHead>Label</TableHead>
                      <TableHead>Warna</TableHead>
                      <TableHead>Ikon</TableHead>
                      <TableHead>Deskripsi</TableHead>
                      {isTemperature && (
                        <TableHead>
                          <span className="inline-flex items-center gap-1">
                            Wajib Diisi
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="size-3.5 cursor-help text-[#6b6b6b]" aria-label="Penjelasan Wajib Diisi" />
                              </TooltipTrigger>
                              <TooltipContent>Wajib mengisi alasan saat Temperature ini dipilih pada Lead.</TooltipContent>
                            </Tooltip>
                          </span>
                        </TableHead>
                      )}
                      <TableHead>Status</TableHead>
                      {canWrite && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((label) => (
                      <TableRow key={label.id}>
                        <TableCell className="max-w-56">
                          <LabelBadge name={label.name} color={label.color} icon={label.icon} />
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2 font-mono text-sm">
                            <span className="size-5 rounded" style={{ backgroundColor: label.color }} />
                            {label.color}
                          </span>
                        </TableCell>
                        <TableCell>
                          <LabelIcon icon={label.icon} color={label.color} />
                        </TableCell>
                        <TableCell className="min-w-64 max-w-md whitespace-normal text-sm text-[#1f1f1f]">
                          {label.description ?? <span className="text-[#6b6b6b]">-</span>}
                        </TableCell>
                        {isTemperature && (
                          <TableCell>
                            <Switch
                              label={`Wajib Diisi ${label.name}`}
                              checked={label.isRequired}
                              disabled={!canWrite || toggle.isPending}
                              onChange={(isRequired) => toggle.mutate({ id: label.id, isRequired })}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <span
                            className={cn(
                              "rounded-md px-2 py-1 text-xs font-medium",
                              label.isActive ? "bg-[#E6F6EC] text-[#1E9E55]" : "bg-[#F3F4F6] text-[#6b6b6b]",
                            )}
                          >
                            {label.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        {canWrite && (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit ${label.name}`}
                                onClick={() => setDialog({ open: true, label })}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Hapus ${label.name}`}
                                className="text-[#D64545] hover:text-[#D64545]"
                                onClick={() => setDeleting(label)}
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
                Menampilkan {total === 0 ? 0 : start + 1} – {start + rows.length} dari {total} label
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
        <LabelDialog
          open={dialog.open}
          type={type}
          label={dialog.label}
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
        title="Hapus label?"
        description={deleting ? `Label "${deleting.name}" akan dihapus permanen.` : ""}
        loading={remove.isPending}
      />
    </SidebarProvider>
  );
}
