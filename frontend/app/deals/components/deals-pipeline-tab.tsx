"use client";

import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { useSidebar } from "@/components/ui/sidebar";
import { useDeals, type DealFilters } from "@/hooks/use-deals";
import { usePipelineStages } from "@/hooks/use-pipeline-stages";
import type { Deal } from "@/types/deal";
import { formatRupiah, formatRupiahCompact } from "@/lib/helper";
import { CalendarDays, Circle, FileText, FolderOpen, Phone, Truck, Wallet, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { pipelineTextColor, resolvePipelineColor } from "@/lib/pipeline-color";
import { cn } from "@/lib/utils";

const paymentLabel = { CASH: "Tunai", KPR: "KPR", KPR_SHARIA: "KPR Syariah" } as const;
const COLLAPSED_DEAL_COUNT = 3;
const daysSince = (value?: string) => value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)) : null;

/** Ikon kolom mengikuti nama fase; fase lain memakai ikon umum. */
function stageIcon(name: string): LucideIcon {
  const normalized = name.toLowerCase();
  if (normalized.includes("itj")) return FileText;
  if (normalized.includes("dp")) return Wallet;
  if (normalized.includes("berkas")) return FolderOpen;
  if (normalized.includes("serah")) return Truck;
  return Circle;
}

function DaysBadge({ age }: { age: number | null }) {
  if (age === null) return null;
  if (age === 0) {
    return <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[#EFF8FF] px-1 py-px text-[10px] font-medium text-[#175CD3]"><CalendarDays className="size-2.5" />Hari ini</span>;
  }
  const tone = age <= 3 ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEF0C7] text-[#B54708]";
  return <span className={cn("inline-flex shrink-0 rounded px-1 py-px text-[10px] font-medium", tone)}>{age} hari</span>;
}

function DealCard({ deal }: { deal: Deal }) {
  const router = useRouter();
  const sortable = useSortable({ id: deal.id, data: { kind: "deal", deal } });
  const age = daysSince(deal.lastActivityAt);
  const customer = deal.lead?.customer;
  const bank = deal.financingBank;
  return <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} {...sortable.attributes} {...sortable.listeners} onClick={() => router.push(`/deals/${deal.id}`)} className={`cursor-grab rounded-md border border-[#EAECF0] bg-background p-2 shadow-sm active:cursor-grabbing ${sortable.isDragging ? "opacity-40" : ""}`}>
    <div className="flex items-start justify-between gap-1"><p className="truncate text-xs font-semibold text-[#101828]">{customer ? `${customer.firstName} ${customer.lastName ?? ""}`.trim() : "Customer tidak tersedia"}</p><DaysBadge age={age} /></div>
    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#667085]"><Phone className="size-2.5" />{customer?.phoneNumber || "-"}</p>
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      <span className="max-w-full truncate rounded bg-[#DCFCE7] px-1 py-px text-[10px] font-medium text-[#15803D]">{deal.unit?.variant.product.name ?? "Tanpa proyek"}</span>
      <span className="rounded border border-[#D0D5DD] px-1 py-px text-[10px] text-[#344054]">{deal.unit?.code ?? "Tanpa unit"}</span>
      <span className="rounded bg-[#EFF8FF] px-1 py-px text-[10px] font-medium text-[#175CD3]">{paymentLabel[deal.paymentMethod]}</span>
      {bank?.logoUrl ? <img src={bank.logoUrl} alt={bank.name} title={bank.name} className="h-3.5 max-w-12 object-contain" /> : deal.bankName && <span className="max-w-full truncate rounded border border-[#D0D5DD] px-1 py-px text-[10px] text-[#344054]">{deal.bankName}</span>}
    </div>
    <p className="mt-1.5 text-xs font-semibold text-[#101828]" title={formatRupiah(deal.amount ?? deal.expectedAmount ?? 0)}>{formatRupiahCompact(deal.amount ?? deal.expectedAmount ?? 0)}</p>
  </article>;
}

function Lane({ id, name, color, deals, isMobile }: { id: string; name: string; color?: string | null; deals: Deal[]; isMobile: boolean }) {
  const drop = useDroppable({ id, data: { kind: "stage" } });
  const [expanded, setExpanded] = useState(false);
  const accent = resolvePipelineColor(color);
  const textColor = pipelineTextColor(accent);
  const Icon = stageIcon(name);
  const shown = expanded ? deals : deals.slice(0, COLLAPSED_DEAL_COUNT);
  const hiddenCount = deals.length - shown.length;
  return <section ref={drop.setNodeRef} className={cn("min-w-0 rounded-lg border bg-muted/30", isMobile && "w-56 shrink-0", drop.isOver && "ring-2 ring-primary/30")} style={{ borderColor: accent }}>
    <header className="flex items-center justify-between gap-1.5 rounded-t-[7px] px-2 py-1.5" style={{ backgroundColor: accent, color: textColor }}>
      <h3 className="flex min-w-0 items-center gap-1.5 text-xs font-semibold" title={name}><Icon className="size-3.5 shrink-0" /><span className="truncate">{name}</span></h3>
      <span className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium" style={{ backgroundColor: `${textColor}26` }}>{deals.length} deals</span>
    </header>
    <SortableContext items={shown.map((deal) => deal.id)} strategy={verticalListSortingStrategy}><div className="min-h-32 space-y-1.5 p-1.5">{shown.map((deal) => <DealCard key={deal.id} deal={deal} />)}{!deals.length && <p className="p-3 text-center text-[11px] text-muted-foreground">Belum ada Deal</p>}
      {deals.length > COLLAPSED_DEAL_COUNT && <button type="button" onClick={() => setExpanded((value) => !value)} title={expanded ? "Tampilkan lebih sedikit" : `Tampilkan ${hiddenCount} deals lainnya`} className="w-full rounded-md py-1 text-center text-[11px] font-medium text-[#475467] hover:bg-white/70">{expanded ? "Tampilkan lebih sedikit" : `+ ${hiddenCount} deals lainnya`}</button>}
    </div></SortableContext>
  </section>;
}

export function DealsPipelineTab({ filters = {}, hiddenStageIds = [] }: { filters?: DealFilters; hiddenStageIds?: string[] }) {
  const router = useRouter(); const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const { isMobile } = useSidebar();
  const { data: configured = [], isLoading: stagesLoading } = usePipelineStages("deal");
  const { deals, isLoading, updateDeal } = useDeals({ ...filters, page: 1, limit: 100 });
  const [active, setActive] = useState<Deal | null>(null);
  const stages = useMemo(() => configured.filter((stage) => stage.isActive && !hiddenStageIds.includes(stage.id)).sort((a, b) => a.position - b.position), [configured, hiddenStageIds]);
  const byStage = useMemo(() => Object.fromEntries(stages.map((stage) => [stage.id, deals.filter((deal) => deal.stageId === stage.id)])), [deals, stages]);
  if (stagesLoading || isLoading) return <div className="grid h-72 place-items-center rounded-xl border text-sm text-muted-foreground">Memuat pipeline…</div>;
  if (!stages.length) return <Card className="p-8 text-center text-sm">Belum ada fase yang ditampilkan. Atur kolom lewat tombol Columns, atau konfigurasi di <button className="font-medium text-primary underline" onClick={() => router.push("/crm-configuration/deals-pipeline")}>Konfigurasi Deals Pipeline</button>.</Card>;
  return <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(event) => setActive(event.active.data.current?.deal as Deal)} onDragCancel={() => setActive(null)} onDragEnd={async (event) => { const deal = event.active.data.current?.deal as Deal | undefined; const destination = event.over?.data.current?.kind === "stage" ? String(event.over.id) : (event.over?.data.current?.deal as Deal | undefined)?.stageId; setActive(null); if (!deal || !destination || destination === deal.stageId) return; await updateDeal({ id: deal.id, data: { stageId: destination } }); }}>
    <div className="max-h-[calc(100dvh-270px)] overflow-y-auto overflow-x-auto pb-3">{/* Desktop: semua kolom berbagi lebar yang tersedia (tanpa scroll horizontal) selama tiap kolom masih ≥ 140px. */}<div className={cn("gap-2", isMobile ? "flex" : "grid")} style={isMobile ? undefined : { gridTemplateColumns: `repeat(${stages.length}, minmax(140px, 1fr))` }}>{stages.map((stage) => <Lane key={stage.id} id={stage.id} name={stage.name} color={stage.color} deals={byStage[stage.id] ?? []} isMobile={isMobile} />)}</div></div>
    <DragOverlay>{active ? <div className="w-72 rounded-lg border bg-background p-3 shadow-xl"><p className="font-semibold">{active.lead?.customer.firstName ?? "Deal"}</p><p className="text-sm">{formatRupiah(active.amount ?? active.expectedAmount ?? 0)}</p></div> : null}</DragOverlay>
  </DndContext>;
}
