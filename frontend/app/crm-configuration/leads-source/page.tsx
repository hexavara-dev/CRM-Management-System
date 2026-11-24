"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Megaphone, Pencil, Plus, Search, Target, Trash2 } from "lucide-react";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { ConfigHeader } from "../config-header";
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
  useDeleteLeadSource,
  useLeadSources,
  type LeadSource,
  type LeadSourceStatus,
} from "@/hooks/use-lead-sources";
import { errorMessage } from "@/hooks/use-projects";
import { pageItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { CampaignModal } from "./campaign-modal";
import { SourceDialog } from "./source-dialog";

const PAGE_SIZE = 10;
const ALL = "all";

/** "2026-11-10T02:14:00Z" menjadi "10 Nov 2026, 09:14" (waktu lokal browser). */
const formatDateTime = (value: string) => {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${day}, ${time.replace(".", ":")}`;
};

export default function LeadsSourcePage() {
  const { user } = useAuth();
  const canWrite = user?.role === "owner";

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadSourceStatus>();
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ open: boolean; source?: LeadSource }>({ open: false });
  const [deleting, setDeleting] = useState<LeadSource>();
  const [campaignSource, setCampaignSource] = useState<LeadSource>();
  const search = useDebouncedValue(query.trim());

  const sources = useLeadSources({ search, status, page, limit: PAGE_SIZE });
  const remove = useDeleteLeadSource();

  const rows = sources.data?.data ?? [];
  const total = sources.data?.meta.total ?? 0;
  const totalPages = Math.max(1, sources.data?.meta.totalPages ?? 1);
  const start = (page - 1) * PAGE_SIZE;
  const filtered = !!search || !!status;

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3 empty:hidden">
          <SidebarOpenTrigger />
        </header>
        <div className="space-y-4 p-4">
          <ConfigHeader
            icon={Target}
            description="Kelola sumber Leads untuk mengidentifikasi dari mana prospek diperoleh."
          />

          <section className="space-y-4 rounded-xl border border-[#E4E4E7] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative sm:w-72">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Cari leads source..."
                    className="h-9 pl-8"
                  />
                </div>
                <Select
                  value={status ?? ALL}
                  onValueChange={(value) => {
                    setStatus(value === ALL ? undefined : (value as LeadSourceStatus));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 sm:w-44" aria-label="Filter status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Semua Status</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {canWrite && (
                <Button
                  type="button"
                  onClick={() => setDialog({ open: true })}
                  className="bg-[#1980C0] text-white hover:bg-[#166ea6]"
                >
                  <Plus className="size-4" />
                  Tambah Leads Source
                </Button>
              )}
            </div>

            {sources.isLoading ? (
              <Skeleton className="h-60 rounded-xl" />
            ) : sources.isError ? (
              <div className="rounded-xl border border-dashed border-[#D64545]/40 py-12 text-center text-sm text-[#D64545]">
                {errorMessage(sources.error, "Gagal memuat leads source.")}
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E4E4E7] py-12 text-center text-sm text-[#6b6b6b]">
                {filtered
                  ? "Tidak ada leads source yang cocok dengan filter."
                  : `Belum ada leads source.${canWrite ? " Klik Tambah Leads Source untuk menambahkan." : ""}`}
              </div>
            ) : (
              <div className={cn("overflow-x-auto rounded-xl border border-[#E4E4E7]", sources.isFetching && "opacity-70")}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F8FAFC]">
                      <TableHead className="w-14">No</TableHead>
                      <TableHead>Nama Leads Source</TableHead>
                      <TableHead>Deskripsi</TableHead>
                      <TableHead>Warna</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal Dibuat</TableHead>
                      {canWrite && <TableHead className="text-right">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((source, index) => (
                      <TableRow key={source.id}>
                        <TableCell>{start + index + 1}</TableCell>
                        <TableCell className="max-w-64 whitespace-normal font-semibold text-[#1f1f1f]">{source.name}</TableCell>
                        <TableCell className="min-w-64 max-w-md whitespace-normal text-sm text-[#1f1f1f]">
                          {source.description ?? <span className="text-[#6b6b6b]">-</span>}
                        </TableCell>
                        <TableCell>
                          {source.color ? (
                            <span className="inline-flex items-center gap-2 font-mono text-sm">
                              <span className="size-5 rounded" style={{ backgroundColor: source.color }} />
                              {source.color}
                            </span>
                          ) : (
                            <span className="text-[#6b6b6b]">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            aria-label={`Lihat campaign ${source.name}`}
                            onClick={() => setCampaignSource(source)}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#F3F4F6] px-2 py-1 text-xs font-medium text-[#475467] hover:bg-[#E5F1FA] hover:text-[#1980C0]"
                          >
                            <Megaphone className="size-3.5" />
                            {source.campaignCount} campaign
                          </button>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "rounded-md px-2 py-1 text-xs font-medium",
                              source.isActive ? "bg-[#E6F6EC] text-[#1E9E55]" : "bg-[#F3F4F6] text-[#6b6b6b]",
                            )}
                          >
                            {source.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDateTime(source.createdAt)}</TableCell>
                        {canWrite && (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit ${source.name}`}
                                onClick={() => setDialog({ open: true, source })}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Hapus ${source.name}`}
                                className="text-[#D64545] hover:text-[#D64545]"
                                onClick={() => setDeleting(source)}
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
          </section>
        </div>
      </SidebarInset>

      {canWrite && (
        <SourceDialog
          open={dialog.open}
          source={dialog.source}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        />
      )}
      <CampaignModal
        source={campaignSource}
        canWrite={canWrite}
        onOpenChange={(open) => !open && setCampaignSource(undefined)}
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
        title="Hapus leads source?"
        description={
          deleting
            ? `"${deleting.name}" akan dihapus permanen. Source yang sudah dipakai Lead tidak dapat dihapus; nonaktifkan saja.`
            : ""
        }
        loading={remove.isPending}
      />
    </SidebarProvider>
  );
}
