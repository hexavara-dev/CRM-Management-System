"use client";

import { useState } from "react";
import { CalendarDays, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Skeleton } from "@/components/ui/skeleton";
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

/** "2026-10-01" menjadi "1 Okt 2026". */
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );

function period(campaign: LeadCampaign) {
  const { startDate, endDate } = campaign;
  if (!startDate && !endDate) return "Periode belum ditentukan";
  if (startDate && endDate) return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  return startDate ? `Mulai ${formatDate(startDate)}` : `Sampai ${formatDate(endDate as string)}`;
}

/** Daftar campaign satu source, tampil saat baris source dibuka. */
export function CampaignPanel({ source, canWrite }: { source: LeadSource; canWrite: boolean }) {
  const campaigns = useLeadCampaigns(source.id);
  const remove = useDeleteLeadCampaign();
  const [dialog, setDialog] = useState<{ open: boolean; campaign?: LeadCampaign }>({ open: false });
  const [deleting, setDeleting] = useState<LeadCampaign>();
  const rows = campaigns.data ?? [];

  return (
    <div className="space-y-3 bg-[#F8FAFC] px-4 py-4 sm:pl-14">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#1f1f1f]">
          <Megaphone className="size-4 text-[#1980C0]" />
          Campaign {source.name}
        </p>
        {canWrite && (
          <Button type="button" size="sm" variant="outline" onClick={() => setDialog({ open: true })}>
            <Plus className="size-4" />
            Tambah Campaign
          </Button>
        )}
      </div>

      {campaigns.isLoading ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : campaigns.isError ? (
        <p className="rounded-lg border border-dashed border-[#D64545]/40 py-4 text-center text-sm text-[#D64545]">
          {errorMessage(campaigns.error, "Gagal memuat campaign.")}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#E4E4E7] bg-white py-4 text-center text-sm text-[#6b6b6b]">
          Belum ada campaign untuk source ini.
        </p>
      ) : (
        <ul className="divide-y divide-[#EDEDED] rounded-lg border border-[#E4E4E7] bg-white">
          {rows.map((campaign) => {
            const phase = PHASES[campaignPhase(campaign)];
            return (
              <li key={campaign.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[#1f1f1f]">{campaign.name}</p>
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", phase.className)}>{phase.label}</span>
                  </div>
                  {campaign.description && <p className="mt-0.5 text-sm text-[#475467]">{campaign.description}</p>}
                </div>
                <p className="flex shrink-0 items-center gap-1.5 text-sm text-[#475467]">
                  <CalendarDays className="size-4" />
                  {period(campaign)}
                </p>
                {canWrite && (
                  <div className="flex shrink-0 gap-1">
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
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && (
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
    </div>
  );
}
