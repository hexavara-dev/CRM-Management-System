import type { DealHistory } from "@/types/deal";
import { CheckCircle2, Clock3, History } from "lucide-react";

const labels: Record<string, string> = {
  deal_created: "Deal dibuat",
  update: "Informasi Deal diperbarui",
  stage_changed: "Fase Deal diubah",
  payment_added: "Transaksi ditambahkan",
  payment_updated: "Transaksi diperbarui",
  lost_requested: "Pengajuan Lost dibuat",
  lost_approved: "Pengajuan Lost disetujui",
  lost_rejected: "Pengajuan Lost ditolak",
};

export function DealHistoryTab({ history }: { history: DealHistory[] }) {
  if (history.length === 0) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center text-center text-sm text-[#667085]">
        <History className="mb-3 size-8 text-[#98A2B3]" />
        <p className="font-medium text-[#344054]">Belum ada riwayat Deal</p>
        <p>
          Perubahan fase, transaksi, dan verifikasi Lost akan dicatat di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-4">
      <div className="relative space-y-6 before:absolute before:bottom-2 before:left-3 before:top-2 before:w-px before:bg-[#EAECF0]">
        {history.map((row) => (
          <div key={row.id} className="relative flex gap-4">
            <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#EFF8FF] text-[#1570EF]">
              <CheckCircle2 className="size-3.5" />
            </span>
            <div className="flex-1 rounded-lg border border-[#EAECF0] bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#101828]">
                  {labels[row.action] || row.action.replaceAll("_", " ")}
                </p>
                <span className="flex items-center gap-1 text-[11px] text-[#667085]">
                  <Clock3 className="size-3" />
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(row.createdAt))}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#667085]">
                Oleh {row.actor?.name || row.actor?.email || "Sistem"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
