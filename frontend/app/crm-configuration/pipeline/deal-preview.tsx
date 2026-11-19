"use client";

import { Paperclip, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PipelineStage } from "@/hooks/use-pipeline-stages";

const FALLBACK = "#94A3B8";

/** Contoh kartu Deal untuk pratinjau; bukan data asli. */
const SAMPLES = [
  { name: "Hendra Wijaya", phone: "0812 3456 7890", project: "Royal Mutiara", unit: "A-12", payment: "KPR", bank: "BRI", price: 1_200_000_000, age: 2 },
  { name: "Rizal Hidayat", phone: "0812 1122 3344", project: "Green Harmony", unit: "C-07", payment: "Tunai", bank: null, price: 1_150_000_000, age: 3 },
  { name: "Intan Sari", phone: "0821 3344 5566", project: "Green Sukun", unit: "B-11", payment: "KPR Syariah", bank: "BSI", price: 950_000_000, age: 4 },
];

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

/** "Rp 6,25 M" untuk total kolom. */
const compact = (value: number) => `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;

function SampleCard({ sample }: { sample: (typeof SAMPLES)[number] }) {
  return (
    <div className="space-y-2.5 rounded-xl border border-[#E4E4E7] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate font-semibold text-[#1f1f1f]">{sample.name}</p>
        <span
          className={
            sample.age >= 4
              ? "shrink-0 rounded-md bg-[#FFF1E0] px-2 py-0.5 text-xs font-medium text-[#D9822B]"
              : "shrink-0 rounded-md bg-[#E6F6EC] px-2 py-0.5 text-xs font-medium text-[#1E9E55]"
          }
        >
          {sample.age} hari
        </span>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-[#475467]">
        <Phone className="size-3" />
        {sample.phone}
      </p>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-md bg-[#EEE9FE] px-2 py-0.5 font-medium text-[#6D4AE0]">{sample.project}</span>
        <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[#1f1f1f]">{sample.unit}</span>
        <span className="rounded-md bg-[#E5F1FA] px-2 py-0.5 font-medium text-[#1980C0]">{sample.payment}</span>
        {sample.bank && (
          <span className="rounded-md border border-[#E4E4E7] px-2 py-0.5 font-semibold text-[#1f1f1f]">{sample.bank}</span>
        )}
      </div>
      <p className="text-sm font-medium text-[#1f1f1f]">{rupiah(sample.price)}</p>
    </div>
  );
}

/** Pratinjau kanban Deals: kolom tahapan aktif seperti yang dilihat sales. */
export function DealPreviewDialog({
  open,
  stages,
  onOpenChange,
}: {
  open: boolean;
  stages: PipelineStage[];
  onOpenChange: (open: boolean) => void;
}) {
  const active = stages.filter((stage) => stage.isActive);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-4 overflow-y-auto p-4 sm:max-w-[min(1400px,95vw)] sm:p-6">
        <DialogHeader>
          <DialogTitle>Preview Pipeline</DialogTitle>
          <DialogDescription>
            Tampilan pipeline Deals dengan urutan dan warna saat ini. Kartu dan total nilai berisi contoh Deal; jumlah di
            setiap kolom adalah jumlah Deal sebenarnya. Tahapan nonaktif tidak ditampilkan.
          </DialogDescription>
        </DialogHeader>
        {active.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#6b6b6b]">Belum ada tahapan aktif.</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-3">
              {active.map((stage) => {
                const color = stage.color ?? FALLBACK;
                const shown = Math.min(SAMPLES.length, Math.max(stage.itemCount, 1));
                const samples = SAMPLES.slice(0, shown);
                const more = stage.itemCount - shown;
                return (
                  <div
                    key={stage.id}
                    className="flex w-80 flex-col rounded-2xl border border-[#EDEDED]"
                    style={{ backgroundColor: `${color}0D` }}
                  >
                    <div className="rounded-t-2xl" style={{ backgroundColor: `${color}26` }}>
                      <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <p className="truncate text-lg font-semibold" style={{ color }}>
                          {stage.name}
                        </p>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-sm font-medium text-[#1f1f1f]">
                          {stage.itemCount} deals
                        </span>
                      </div>
                      <p className="px-4 pb-3 text-sm font-medium text-[#1f1f1f]">
                        Total: {compact(samples.reduce((sum, s) => sum + s.price, 0))}
                      </p>
                    </div>
                    <div className="space-y-3 p-3">
                      {samples.map((sample) => (
                        <SampleCard key={sample.name} sample={sample} />
                      ))}
                      {more > 0 && <p className="px-1 text-sm font-medium text-[#475467]">+ {more} deals lainnya</p>}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-[#6b6b6b]">
                        <span>Probabilitas {stage.probability}%</span>
                        {stage.evidences.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="size-3" />
                            {stage.evidences.length} evidence
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
