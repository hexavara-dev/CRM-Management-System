"use client";

import { DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, closestCorners, defaultDropAnimationSideEffects, pointerWithin, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent, type DropAnimation, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Phone, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-provider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSidebar } from "@/components/ui/sidebar";
import { useLeadLabels } from "@/hooks/use-lead-labels";
import { useLeads } from "@/hooks/use-leads";
import { isLeadEvidenceGrandfathered, LeadStageEvidenceDialog } from "@/app/leads/components/lead-stage-evidence-dialog";
import { type PipelineStage, usePipelineStages } from "@/hooks/use-pipeline-stages";
import { useProjects } from "@/hooks/use-projects";
import { useActiveLeadSources } from "@/hooks/use-lead-sources";
import { useUsers } from "@/hooks/use-users";
import { cn } from "@/lib/utils";
import { pipelineTextColor, resolvePipelineColor } from "@/lib/pipeline-color";
import type { Lead } from "@/types/lead";

const dropAnimation: DropAnimation = {
  duration: 180,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.18" } } }),
};
/**
 * Kolom yang berisi pointer selalu menang. `closestCorners` saja membandingkan
 * keempat sudut overlay, sehingga kolom tinggi atau kosong kalah dari kartu di
 * kolom sebelah dan drop ke kolom kosong tidak terdeteksi. Sensor keyboard
 * (tanpa koordinat pointer) tetap memakai `closestCorners`.
 */
const laneFirstCollision: CollisionDetection = (args) => {
  const lanes = pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => container.data.current?.kind === "stage"),
  });
  return lanes.length ? lanes : closestCorners(args);
};

const lastContactAt = (lead: Lead) => lead.activities?.[0]?.createdAt || lead.createdAt;

const contactAge = (lead: Lead) => {
  const days = Math.max(0, Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(lastContactAt(lead)).setHours(0, 0, 0, 0)) / 86_400_000));
  return days === 0 ? "Hari ini" : `${days} hari`;
};

function PipelineCard({ lead, overlay = false }: { lead: Lead; overlay?: boolean }) {
  const router = useRouter();
  const sortable = useSortable({ id: lead.id, data: { kind: "lead", lead }, disabled: overlay });
  const name = `${lead.customer.firstName} ${lead.customer.lastName || ""}`.trim();

  return (
    <article
      ref={overlay ? undefined : sortable.setNodeRef}
      style={overlay ? undefined : { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition ?? "transform 180ms cubic-bezier(0.2, 0, 0, 1)", willChange: "transform" }}
      {...(!overlay ? sortable.attributes : {})}
      {...(!overlay ? sortable.listeners : {})}
      onClick={() => !overlay && router.push(`/leads/${lead.id}`)}
      className={cn("cursor-grab rounded-lg border border-[#E4E7EC] bg-white p-2 shadow-sm transition-[box-shadow,opacity] duration-150 active:cursor-grabbing", sortable.isDragging && "opacity-[0.18]", overlay && "w-60 rotate-[1.5deg] cursor-grabbing border-primary/30 shadow-2xl ring-2 ring-primary/15")}
    >
      <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[#101828]">{name}</p>
          <p className="mt-1 flex min-w-0 items-center gap-1 text-[10px] text-[#475467]">
            <span className="max-w-24 truncate rounded bg-[#E7F0FF] px-1 py-0.5 font-medium text-[#0B63F6]" title={lead.project?.name}>{lead.project?.name || lead.location?.name || "-"}</span>
            <span aria-hidden="true">|</span>
            <span className="truncate">{lead.source?.name || "-"}</span>
          </p>
          {(lead.labels ?? []).length > 0 && (
            <div className="mt-1 flex min-w-0 flex-wrap gap-1">
              {(lead.labels ?? []).slice(0, 2).map((label) => {
                const color = resolvePipelineColor(label.color, "#667085");
                return <span key={label.id} className="max-w-20 truncate rounded px-1 py-0.5 text-[10px] font-medium" style={{ backgroundColor: color, color: pipelineTextColor(color) }} title={label.name}>{label.name}</span>;
              })}
              {(lead.labels ?? []).length > 2 && <span className="text-[10px] text-[#475467]">+{(lead.labels ?? []).length - 2}</span>}
            </div>
          )}
          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[#475467]">
            <Phone className="size-3" /> Last Contact:
            <span className="rounded bg-[#F2F4F7] px-1 py-0.5 font-medium text-[#344054]">{contactAge(lead)}</span>
          </p>
      </div>
    </article>
  );
}

function StageLane({ stage, leads, expanded, onToggle, fitViewport, visibleColumns, isMobile, dropState }: { stage: PipelineStage; leads: Lead[]; expanded: boolean; onToggle: () => void; fitViewport: boolean; visibleColumns: number; isMobile: boolean; dropState?: "allowed" | "blocked" | "evidence" }) {
  const droppable = useDroppable({ id: stage.id, data: { kind: "stage", stage } });
  const shown = expanded ? leads : leads.slice(0, 3);
  const remaining = Math.max(0, leads.length - shown.length);
  const color = resolvePipelineColor(stage.color, "#667085");
  const headerText = pipelineTextColor(color);
  const badgeStyle = headerText === "#111827" ? { backgroundColor: "rgba(17,24,39,0.12)", color: headerText } : { backgroundColor: "rgba(255,255,255,0.22)", color: headerText };
  const isTarget = dropState !== undefined;

  return (
    <section className={cn("flex flex-col rounded-xl border transition-[background-color,border-color,box-shadow,transform] duration-150", fitViewport ? "min-w-0 w-full" : isMobile ? "w-64 min-w-64" : "min-w-0 shrink-0", isTarget && dropState === "allowed" && "bg-primary/[0.06] shadow-sm ring-2 ring-primary/30", isTarget && dropState === "evidence" && "bg-amber-50 shadow-sm ring-2 ring-amber-400/50", isTarget && dropState === "blocked" && "bg-destructive/[0.05] ring-2 ring-destructive/30")} style={{ backgroundColor: isTarget ? undefined : `${color}14`, borderColor: isTarget && dropState === "blocked" ? "rgb(239 68 68)" : `${color}40`, ...(!fitViewport && !isMobile ? { width: `calc((100% - ${(visibleColumns - 1) * 0.5}rem) / ${visibleColumns})` } : {}) }}>
      <header className="rounded-t-xl px-2.5 py-2" style={{ backgroundColor: color, color: pipelineTextColor(color) }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-xs font-semibold">{stage.name}</h3>
          </div>
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={badgeStyle}>{leads.length}</span>
        </div>
      </header>
      <div ref={droppable.setNodeRef} className="min-h-52 flex-1 space-y-1.5 p-1.5">
        <SortableContext items={shown.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
          {isTarget && <div className={cn("grid min-h-24 place-items-center rounded-lg border-2 border-dashed px-2 text-center text-xs font-medium transition-all", dropState === "allowed" ? "border-primary/40 bg-primary/[0.05] text-primary" : dropState === "evidence" ? "border-amber-400/60 bg-amber-50 text-amber-800" : "border-destructive/40 bg-destructive/[0.05] text-destructive")}>{dropState === "allowed" ? "Lepaskan untuk memindahkan Lead" : dropState === "evidence" ? "Lepaskan untuk mengisi evidence fase ini" : "Fase ini tidak dapat dilompati"}</div>}
          {shown.map((lead) => <PipelineCard key={lead.id} lead={lead} />)}
        </SortableContext>
        {leads.length === 0 && !isTarget && <p className="px-2 py-10 text-center text-xs text-[#98A2B3]">Belum ada Lead</p>}
        {(remaining > 0 || expanded) && leads.length > 3 && (
          <button type="button" onClick={onToggle} className="px-1 py-1 text-xs font-semibold text-[#0B63F6]">
            {expanded ? "Tampilkan lebih sedikit" : `+ ${remaining} lead lainnya`}
          </button>
        )}
      </div>
    </section>
  );
}

export type LeadDateRange = { from: string; to: string };

export function LeadsPipelineTab({
  dateRange,
}: {
  dateRange: LeadDateRange;
}) {
  const { user } = useAuth();
  const { state: sidebarState, isMobile } = useSidebar();
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [salesId, setSalesId] = useState("all");
  const [sourceId, setSourceId] = useState("all");
  const [labelId, setLabelId] = useState("all");
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [activeLead, setActiveLead] = useState<Lead>();
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ lead: Lead; stage: PipelineStage }>();

  const leadsQuery = useLeads({ page: 1, limit: 100, useServerPagination: true, additionalParams: { projectId: projectId === "all" ? undefined : projectId, labelId: labelId === "all" ? undefined : labelId,assignedUserId: user?.role === "owner" ? undefined : user?.id, isDeleted: false }, getAll: true, fetchAllPages: true });
  const stagesQuery = usePipelineStages("lead");
  const stages = useMemo(
    () => (stagesQuery.data ?? []).filter((stage) => stage.isActive),
    [stagesQuery.data],
  );
  const { users } = useUsers();
  const { sources } = useActiveLeadSources();
  const projectsQuery = useProjects({ page: 1, limit: 100, isActive: true });
  const projects = projectsQuery.data?.data ?? [];
  const labelsQuery = useLeadLabels(undefined, 1, 100);
  const labels = (labelsQuery.data?.data ?? []).filter((label) => label.isActive);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("id-ID");
    return leadsQuery.leads.filter((lead) => {
      const name = `${lead.customer.firstName} ${lead.customer.lastName || ""}`.toLocaleLowerCase("id-ID");
      const leadDate = lead.createdAt.slice(0, 10);
      return (!needle || name.includes(needle) || (lead.customer.phoneNumber || "").includes(needle)) && (salesId === "all" || lead.assignedUser?.id === salesId) && (sourceId === "all" || lead.source?.id === sourceId) && (!dateRange.from || leadDate >= dateRange.from) && (!dateRange.to || leadDate <= dateRange.to);
    });
  }, [dateRange, leadsQuery.leads, salesId, search, sourceId]);
  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);
  const grouped = useMemo(() => Object.fromEntries(sortedStages.map((stage) => [stage.id, filtered.filter((lead) => lead.stageId === stage.id)])) as Record<string, Lead[]>, [filtered, sortedStages]);
  const visibleStageLimit = sidebarState === "collapsed" ? 6 : 4;
  const fitPipelineViewport = !isMobile && sortedStages.length <= visibleStageLimit;

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.kind === "lead") setActiveLead(event.active.data.current.lead as Lead);
  };
  const stageFromEvent = (event: DragOverEvent | DragEndEvent) => event.over?.data.current?.kind === "stage"
    ? String(event.over.id)
    : (event.over?.data.current?.lead as Lead | undefined)?.stageId;
  const dropState = (stage: PipelineStage) => {
    if (!activeLead || stage.id === activeLead.stageId) return undefined;
    const source = sortedStages.find((item) => item.id === activeLead.stageId);
    if (!source) return "blocked" as const;
    if (stage.position < source.position) return "allowed" as const;
    if (stage.position !== source.position + 1) return "blocked" as const;
    return !isLeadEvidenceGrandfathered(activeLead, stage, sortedStages) && stage.evidences.length > 0
      ? "evidence" as const
      : "allowed" as const;
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveLead(undefined);
    setOverStageId(null);
    if (!event.over || event.active.data.current?.kind !== "lead") return;
    const targetStage = event.over.data.current?.kind === "stage" ? (event.over.data.current.stage as PipelineStage) : sortedStages.find((stage) => stage.id === stageFromEvent(event));
    const sourceLead = event.active.data.current.lead as Lead;
    if (!targetStage || sourceLead.stageId === targetStage.id) return;
    const sourceStage = sortedStages.find((stage) => stage.id === sourceLead.stageId);
    const forward = !!sourceStage && targetStage.position > sourceStage.position;
    if (forward && targetStage.position !== sourceStage.position + 1) {
      toast.error("Lead hanya dapat maju satu fase agar persyaratan setiap fase tidak terlewati.");
      return;
    }
    if (forward && !isLeadEvidenceGrandfathered(sourceLead, targetStage, sortedStages) && targetStage.evidences.length > 0) {
      setPendingMove({ lead: sourceLead, stage: targetStage });
      return;
    }
    try {
      await leadsQuery.transitionLeadStage({ id: sourceLead.id, targetStageId: targetStage.id, expectedSourceStageId: sourceLead.stageId! });
    } catch {
      // Mutation already shows an actionable toast; the card remains in its source lane.
    }
  };

  const confirmMove = async (documents: { name: string; file: File }[]) => {
    if (!pendingMove) return;
    try {
      await leadsQuery.transitionLeadStage({
        id: pendingMove.lead.id,
        targetStageId: pendingMove.stage.id,
        expectedSourceStageId: pendingMove.lead.stageId!,
        documents,
      });
      setPendingMove(undefined);
    } catch {
      // Keep the dialog and selected files open so the user can correct them.
    }
  };

  return (
    <div className="space-y-2 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1">
            <span aria-hidden="true" className="invisible block text-xs font-medium">Pencarian</span>
            <span className="relative block">
              <span className="sr-only">Cari nama atau nomor HP</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau nomor HP..." className="pl-9" />
            </span>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium">Project</span>
            <Select value={projectId} onValueChange={setProjectId} disabled={projectsQuery.isLoading}><SelectTrigger aria-label="Filter project"><SelectValue placeholder="Semua Project" /></SelectTrigger><SelectContent><SelectItem value="all">Semua Project</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}{!projectsQuery.isLoading && projects.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">Belum ada Project aktif</p>}</SelectContent></Select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium">Assigned Sales</span>
            <Select value={salesId} onValueChange={setSalesId} disabled={user?.role !== "owner"}>
              <SelectTrigger aria-label="Filter assigned sales"><SelectValue placeholder="Semua Sales" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Semua Sales</SelectItem>{users.map((sales) => <SelectItem key={sales.id} value={sales.id}>{sales.name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium">Asal Leads</span>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger aria-label="Filter asal Leads"><SelectValue placeholder="Semua Sumber" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Semua Sumber</SelectItem>{sources.map((source) => <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium">Label</span>
            <Select value={labelId} onValueChange={setLabelId} disabled={labelsQuery.isLoading}><SelectTrigger aria-label="Filter label"><SelectValue placeholder={labelsQuery.isLoading ? "Memuat label..." : "Semua Label"} /></SelectTrigger><SelectContent><SelectItem value="all">Semua Label</SelectItem>{labels.map((label) => <SelectItem key={label.id} value={label.id}>{label.name}</SelectItem>)}</SelectContent></Select>
          </label>
        </div>
      </div>

      {leadsQuery.isLoading || stagesQuery.isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border text-sm text-muted-foreground">Memuat pipeline...</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={laneFirstCollision}measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} autoScroll onDragStart={handleDragStart} onDragOver={(event) => setOverStageId(stageFromEvent(event) ?? null)} onDragCancel={() => { setActiveLead(undefined); setOverStageId(null); }} onDragEnd={handleDragEnd}>
          <div className="max-h-[calc(100dvh-260px)] w-full overflow-auto pb-3">
            <div className={cn(fitPipelineViewport ? "grid gap-2" : "flex w-full gap-2")} style={fitPipelineViewport ? { gridTemplateColumns: `repeat(${sortedStages.length}, minmax(0, 1fr))` } : undefined}>
              {sortedStages.map((stage) => <StageLane key={stage.id} stage={stage} leads={grouped[stage.id] ?? []} expanded={expandedStages.has(stage.id)} fitViewport={fitPipelineViewport} visibleColumns={visibleStageLimit} isMobile={isMobile} dropState={overStageId === stage.id ? dropState(stage) : undefined} onToggle={() => setExpandedStages((current) => { const next = new Set(current); if (next.has(stage.id)) next.delete(stage.id); else next.add(stage.id); return next; })} />)}
            </div>
          </div>
          <DragOverlay dropAnimation={dropAnimation} adjustScale={false}>{activeLead ? <PipelineCard lead={activeLead} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      {pendingMove && <LeadStageEvidenceDialog lead={pendingMove.lead} stage={pendingMove.stage} stages={sortedStages} open saving={leadsQuery.isTransitioningStage} onCancel={() => setPendingMove(undefined)} onSave={confirmMove} />}
      {/* Legacy dialog retained below only temporarily during source transition.
      <Dialog open={!!pendingMove} onOpenChange={(open) => !open && !isMoving && setPendingMove(undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lengkapi Evidence Tahapan</DialogTitle>
            <DialogDescription>
              Upload evidence wajib sebelum {pendingMove?.lead.customer.firstName ?? "Lead"} dipindahkan ke {pendingMove?.stage.name ?? "tahapan tujuan"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {requiredEvidence.map((evidence) => {
              const key = evidence.id ?? evidence.name;
              const accept = evidence.fileTypes.flatMap((type) => ({ PDF: [".pdf"], DOC: [".doc", ".docx"], IMAGE: [".jpg", ".jpeg", ".png", ".webp"], SHEET: [".xls", ".xlsx"] })[type]).join(",");
              return (
                <label key={key} className="block rounded-lg border p-3">
                  <span className="flex items-center gap-2 text-sm font-semibold"><Paperclip className="size-4" />{evidence.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Format: {evidence.fileTypes.join(", ")} · maksimal 10 MB</span>
                  <Input type="file" accept={accept} disabled={isMoving} className="mt-2" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setEvidenceFiles((current) => ({ ...current, [key]: file }));
                  }} />
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isMoving} onClick={() => setPendingMove(undefined)}>Batal</Button>
            <Button type="button" disabled={isMoving || requiredEvidence.some((evidence) => !evidenceFiles[evidence.id ?? evidence.name])} onClick={confirmMove}>
              {isMoving ? <><Loader2 className="size-4 animate-spin" /> Memindahkan...</> : "Upload & Pindahkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}
    </div>
  );
}
