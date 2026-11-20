"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Megaphone, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { campaignPhase, useDeleteLeadCampaign, useLeadCampaigns, type LeadCampaign } from "@/hooks/use-lead-campaigns";
import type { LeadSource } from "@/hooks/use-lead-sources";
import { errorMessage } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import { CampaignDialog } from "./campaign-dialog";

const PHASES = {
  running: { label: "Berjalan", className: "bg-[#E6F6EC] text-[#1E9E55]" },
  upcoming: { label: "Akan datang", className: "bg-[#E5F1FA] text-[#1980C0]" },
  ended: { label: "Selesai", className: "bg-[#FFF4E5] text-[#D9822B]" },
  inactive: { label: "Nonaktif", className: "bg-[#F3F4F6] text-[#6b6b6b]" },
} as const;
type Phase = keyof typeof PHASES;

const ALL = "all";

/** "2026-10-01" menjadi "1 Okt 2026". */
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );

function period(campaign: LeadCampaign) {
  const { startDate, endDate } = campaign;
  if (!startDate && !endDate) return "Belum ditentukan";
  if (startDate && endDate) return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  return startDate ? `Mulai ${formatDate(startDate)}` : `Sampai ${formatDate(endDate as string)}`;
}

/** Modal daftar campaign satu source: cari, filter status, tambah, edit, hapus. */
export function CampaignModal({
  source,
  canWrite,
  onOpenChange,
}: {
  /** Source yang campaign-nya ditampilkan; kosong berarti modal tertutup. */
  source?: LeadSource;
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const campaigns = useLeadCampaigns(source?.id);
  const remove = useDeleteLeadCampaign();
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>();
  const [dialog, setDialog] = useState<{ open: boolean; campaign?: LeadCampaign }>({ open: false });
  const [deleting, setDeleting] = useState<LeadCampaign>();

  const all = campaigns.data ?? [];
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return all.filter(
      (c) => (!term || c.name.toLowerCase().includes(term)) && (!phase || campaignPhase(c) === phase),
    );
  }, [all, query, phase]);
  const filtered = !!query.trim() || !!phase;

  return (
    <>
      <Dialog
        open={!!source}
        onOpenChange={(open) => {
          if (!open) {
            setQuery("");
            setPhase(undefined);
          }
          onOpenChange(open);
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-4 p-4 sm:max-w-4xl sm:p-6">
          <DialogHeader className="flex-row items-center gap-3 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#E5F1FA] text-[#1980C0]">
              <Megaphone className="size-5" />
            </span>
            <div>
              <DialogTitle>Campaign {source?.name}</DialogTitle>
              <DialogDescription>Kelola campaign pada sumber leads ini.</DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari campaign..."
                  className="h-9 pl-8"
                />
              </div>
              <Select value={phase ?? ALL} onValueChange={(v) => setPhase(v === ALL ? undefined : (v as Phase))}>
                <SelectTrigger className="h-9 sm:w-40" aria-label="Filter status campaign">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua Status</SelectItem>
                  {(Object.keys(PHASES) as Phase[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {PHASES[key].label}
                    </SelectItem>
                  ))}
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
                Tambah Campaign
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {campaigns.isLoading ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : campaigns.isError ? (
              <p className="rounded-xl border border-dashed border-[#D64545]/40 py-10 text-center text-sm text-[#D64545]">
                {errorMessage(campaigns.error, "Gagal memuat campaign.")}
              </p>
            ) : rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#E4E4E7] py-10 text-center text-sm text-[#6b6b6b]">
                {filtered
                  ? "Tidak ada campaign yang cocok dengan filter."
                  : `Belum ada campaign.${canWrite ? " Klik Tambah Campaign untuk menambahkan." : ""}`}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E4E4E7]">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-[#F8FAFC]">
                      <TableHead>Nama Campaign</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Status</TableHead>
                      {canWrite && <TableHead className="text-right">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((campaign) => {
                      const current = PHASES[campaignPhase(campaign)];
                      return (
                        <TableRow key={campaign.id}>
                          <TableCell className="min-w-56 max-w-md whitespace-normal">
                            <p className="font-medium text-[#1f1f1f]">{campaign.name}</p>
                            {campaign.description && (
                              <p className="mt-0.5 text-sm text-[#475467]">{campaign.description}</p>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-[#475467]">
                            <span className="flex items-center gap-1.5">
                              <CalendarDays className="size-4" />
                              {period(campaign)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn("whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium", current.className)}
                            >
                              {current.label}
                            </span>
                          </TableCell>
                          {canWrite && (
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Edit ${campaign.name}`}
                                  onClick={() => setDialog({ open: true, campaign })}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Hapus ${campaign.name}`}
                                  className="text-[#D64545] hover:text-[#D64545]"
                                  onClick={() => setDeleting(campaign)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {!campaigns.isLoading && all.length > 0 && (
            <p className="text-sm text-[#475467]">
              Menampilkan {rows.length} dari {all.length} campaign
            </p>
          )}
        </DialogContent>
      </Dialog>

      {canWrite && source && (
        <CampaignDialog
          open={dialog.open}
          sourceId={source.id}
          sourceName={source.name}
          campaign={dialog.campaign}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        />
      )}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(undefined)}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(undefined) })}
        title="Hapus campaign?"
        description={
          deleting
            ? `"${deleting.name}" akan dihapus permanen. Jika hanya ingin menyembunyikannya dari Lead baru, nonaktifkan saja.`
            : ""
        }
        loading={remove.isPending}
      />
    </>
  );
}
