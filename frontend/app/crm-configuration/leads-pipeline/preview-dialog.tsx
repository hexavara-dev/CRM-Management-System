"use client";

import { CalendarDays, CircleCheck, Flame, MoreVertical, Paperclip, Phone, Snowflake } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PipelineStage } from "@/hooks/use-pipeline-stages";

const FALLBACK = "#94A3B8";

/** Contoh kartu Lead untuk pratinjau; bukan data asli. */
const SAMPLES = [
  { name: "Rizky Pratama", phone: "0812 3456 7890", project: "Green Sukun", source: "Meta Ads", date: "12 Okt 2026", hot: true },
  { name: "Dewi Lestari", phone: "0813 6677 8899", project: "Royal Mutiara", source: "Pribadi", date: "13 Okt 2026", hot: true },
  { name: "Fajar Hidayat", phone: "0821 3344 5566", project: "Green Sukun", source: "Agency", date: "15 Okt 2026", hot: false },
];

function SampleCard({ sample, final }: { sample: (typeof SAMPLES)[number]; final: boolean }) {
  return (
    <div className="space-y-2.5 rounded-xl border border-[#E4E4E7] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate font-semibold text-[#1f1f1f]">{sample.name}</p>
        {sample.hot ? (
          <Flame className="size-4 shrink-0 text-[#F97316]" aria-label="Hot" />
        ) : (
          <Snowflake className="size-4 shrink-0 text-[#3B82F6]" aria-label="Cold" />
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-[#475467]">
        <Phone className="size-3" />
        {sample.phone}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-md bg-[#E5F1FA] px-2 py-0.5 text-xs font-medium text-[#1980C0]">{sample.project}</span>
        <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#475467]">{sample.source}</span>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-[#475467]">
        {final ? (
          <>
            <CircleCheck className="size-3.5 text-[#1E9E55]" />
            Converted: {sample.date}
          </>
        ) : (
          <>
            <CalendarDays className="size-3.5" />
            {sample.date}
          </>
        )}
      </p>
    </div>
  );
}

/** Pratinjau kanban Leads: kolom tahapan aktif seperti yang dilihat sales. */
export function PreviewDialog({
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
            Tampilan pipeline Leads dengan urutan dan warna saat ini. Kartu berisi contoh Lead; jumlah di setiap kolom
            adalah jumlah Lead sebenarnya. Tahapan nonaktif tidak ditampilkan.
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
                const more = stage.itemCount - shown;
                return (
                  <div
                    key={stage.id}
                    className="flex w-72 flex-col rounded-2xl border border-[#EDEDED]"
                    style={{ backgroundColor: `${color}0D` }}
                  >
                    <div
                      className="flex items-center justify-between gap-2 rounded-t-2xl px-4 py-3"
                      style={{ backgroundColor: `${color}26` }}
                    >
                      <p className="truncate text-lg font-semibold" style={{ color }}>
                        {stage.name}
                      </p>
                      <span className="flex items-center gap-1 text-sm font-medium" style={{ color }}>
                        {stage.itemCount}
                        <MoreVertical className="size-4" />
                      </span>
                    </div>
                    <div className="space-y-3 p-3">
                      {SAMPLES.slice(0, shown).map((sample) => (
                        <SampleCard key={sample.name} sample={sample} final={stage.isTerminalStage} />
                      ))}
                      {more > 0 && (
                        <p className="px-1 text-sm font-medium text-[#1980C0]">+ {more} leads lainnya</p>
                      )}
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
