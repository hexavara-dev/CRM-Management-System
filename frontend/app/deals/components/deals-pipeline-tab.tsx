"use client";

import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useDeals, type DealFilters } from "@/hooks/use-deals";
import { usePipelineStages } from "@/hooks/use-pipeline-stages";
import type { Deal } from "@/types/deal";
import { formatRupiah } from "@/lib/helper";
import { Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const paymentLabel = { CASH: "Tunai", KPR: "KPR", KPR_SHARIA: "KPR Syariah" } as const;
const daysSince = (value?: string) => value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)) : null;

function DealCard({ deal }: { deal: Deal }) {
  const router = useRouter();
  const sortable = useSortable({ id: deal.id, data: { kind: "deal", deal } });
  const age = daysSince(deal.lastActivityAt);
  const customer = deal.lead?.customer;
  return <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} {...sortable.attributes} {...sortable.listeners} onClick={() => router.push(`/deals/${deal.id}`)} className={`cursor-grab rounded-lg border bg-background p-3 shadow-sm active:cursor-grabbing ${sortable.isDragging ? "opacity-40" : ""}`}>
    <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold">{customer ? `${customer.firstName} ${customer.lastName ?? ""}`.trim() : "Customer tidak tersedia"}</p>{age !== null && <Badge variant="secondary">{age} hari</Badge>}</div>
    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" />{customer?.phoneNumber || "-"}</p>
    <div className="mt-3 flex flex-wrap gap-1"><Badge variant="secondary">{deal.unit?.variant.product.name ?? "Tanpa proyek"}</Badge><Badge variant="outline">{deal.unit?.code ?? "Tanpa unit"}</Badge><Badge variant="secondary">{paymentLabel[deal.paymentMethod]}</Badge>{deal.bankName && <Badge variant="outline">{deal.bankName}</Badge>}</div>
    <p className="mt-3 text-sm font-semibold">{formatRupiah(deal.amount ?? deal.expectedAmount ?? 0)}</p>
  </article>;
}

function Lane({ id, name, color, deals }: { id: string; name: string; color?: string | null; deals: Deal[] }) {
  const drop = useDroppable({ id, data: { kind: "stage" } });
  const total = deals.reduce((sum, deal) => sum + Number(deal.amount ?? deal.expectedAmount ?? 0), 0);
  return <section ref={drop.setNodeRef} className={`w-72 shrink-0 rounded-xl border bg-muted/30 ${drop.isOver ? "ring-2 ring-primary/30" : ""}`}>
    <header className="rounded-t-xl px-3 py-3" style={{ backgroundColor: color ? `${color}1A` : undefined, borderTop: `3px solid ${color ?? "#94A3B8"}` }}><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{name}</h3><Badge>{deals.length} deals</Badge></div><p className="mt-2 text-sm font-medium">Total: {formatRupiah(total)}</p></header>
    <SortableContext items={deals.map((deal) => deal.id)} strategy={verticalListSortingStrategy}><div className="min-h-44 space-y-2 p-2">{deals.map((deal) => <DealCard key={deal.id} deal={deal} />)}{!deals.length && <p className="p-4 text-center text-sm text-muted-foreground">Belum ada Deal</p>}</div></SortableContext>
  </section>;
}

export function DealsPipelineTab({ filters = {} }: { filters?: DealFilters }) {
  const router = useRouter(); const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const { data: configured = [], isLoading: stagesLoading } = usePipelineStages("deal");
  const { deals, isLoading, updateDeal } = useDeals({ ...filters, page: 1, limit: 100 });
  const [active, setActive] = useState<Deal | null>(null);
  const stages = useMemo(() => configured.filter((stage) => stage.isActive).sort((a, b) => a.position - b.position), [configured]);
  const byStage = useMemo(() => Object.fromEntries(stages.map((stage) => [stage.id, deals.filter((deal) => deal.stageId === stage.id)])), [deals, stages]);
  if (stagesLoading || isLoading) return <div className="grid h-72 place-items-center rounded-xl border text-sm text-muted-foreground">Memuat pipeline…</div>;
  if (!stages.length) return <Card className="p-8 text-center text-sm">Belum ada fase aktif. Atur Deals Pipeline di <button className="font-medium text-primary underline" onClick={() => router.push("/crm-configuration/deals-pipeline")}>Konfigurasi Deals Pipeline</button>.</Card>;
  return <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(event) => setActive(event.active.data.current?.deal as Deal)} onDragCancel={() => setActive(null)} onDragEnd={async (event) => { const deal = event.active.data.current?.deal as Deal | undefined; const destination = event.over?.data.current?.kind === "stage" ? String(event.over.id) : (event.over?.data.current?.deal as Deal | undefined)?.stageId; setActive(null); if (!deal || !destination || destination === deal.stageId) return; await updateDeal({ id: deal.id, data: { stageId: destination } }); }}>
    <div className="overflow-x-auto pb-3"><div className="flex min-w-max gap-3">{stages.map((stage) => <Lane key={stage.id} id={stage.id} name={stage.name} color={stage.color} deals={byStage[stage.id] ?? []} />)}</div></div>
    <DragOverlay>{active ? <div className="w-72 rounded-lg border bg-background p-3 shadow-xl"><p className="font-semibold">{active.lead?.customer.firstName ?? "Deal"}</p><p className="text-sm">{formatRupiah(active.amount ?? active.expectedAmount ?? 0)}</p></div> : null}</DragOverlay>
  </DndContext>;
}
