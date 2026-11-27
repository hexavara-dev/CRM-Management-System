"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpDown, Columns3, Eye, GripVertical, Info, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { AppSidebar } from "@/components/Sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useDeletePipelineStage,
  usePipelineStages,
  useReorderPipelineStages,
  useToggleStageActive,
  type PipelineEntity,
  type PipelineStage,
} from "@/hooks/use-pipeline-stages";
import { errorMessage } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import { ConfigHeader, ConfigNavbar } from "../config-header";
import { Switch } from "../leads-label/toggle";
import { PIPELINE_COPY } from "./copy";
import { PreviewDialog } from "./preview-dialog";
import { StageChevrons } from "./stage-chevron";
import { StageDialog } from "./stage-dialog";


const COLUMNS = "grid grid-cols-[32px_minmax(160px,1fr)_minmax(220px,1.6fr)_110px_120px_80px_88px] items-center gap-3";

function StageRow({
  stage,
  sorting,
  canWrite,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  stage: PipelineStage;
  sorting: boolean;
  canWrite: boolean;
  toggling: boolean;
  onToggle: (isActive: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    disabled: !sorting,
  });
  const locked = stage.isDefaultStage || stage.isTerminalStage;
  const lockReason = stage.isDefaultStage ? "Tahapan default" : "Tahapan akhir";
  const activeLocked = locked || stage.isWonStage;
  const activeLockReason = locked ? lockReason : "Tahapan Won Deals";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        COLUMNS,
        "min-w-[900px] border-t border-[#EDEDED] bg-white px-4 py-3 text-sm",
        isDragging && "relative z-10 shadow-lg",
        !stage.isActive && "bg-[#FAFAFA] text-[#6b6b6b]",
      )}
    >
      <button
        type="button"
        aria-label={`Geser ${stage.name}`}
        disabled={!sorting}
        className={cn("flex text-[#9ca3af]", sorting ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-40")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0">
        <p className="truncate font-semibold text-[#1f1f1f]">{stage.name}</p>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {stage.isDefaultStage && (
            <span className="rounded bg-[#E5F1FA] px-1.5 py-0.5 text-[10px] font-medium text-[#1980C0]">Default</span>
          )}
          {stage.isTerminalStage && (
            <span className="rounded bg-[#E6F6EC] px-1.5 py-0.5 text-[10px] font-medium text-[#1E9E55]">Akhir</span>
          )}
          {stage.isWonStage && (
            <span className="rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-medium text-[#B45309]">Won</span>
          )}
          {stage.evidences.length > 0 && (
            <span className="rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] text-[#475467]">
              {stage.evidences.length} evidence
            </span>
          )}
        </div>
      </div>
      <p className="line-clamp-2 text-[#1f1f1f]">{stage.description ?? <span className="text-[#6b6b6b]">-</span>}</p>
      <span className="w-fit rounded-md bg-[#F3F4F6] px-2.5 py-1 font-medium text-[#1f1f1f]">{stage.probability}%</span>
      <span className="inline-flex items-center gap-2 font-mono">
        <span className="size-5 rounded" style={{ backgroundColor: stage.color ?? "#94A3B8" }} />
        {stage.color ?? "-"}
      </span>
      <div title={activeLocked ? `${activeLockReason} tidak dapat dinonaktifkan` : undefined}>
        <Switch
          label={`Status ${stage.name}`}
          checked={stage.isActive}
          disabled={!canWrite || sorting || activeLocked || toggling}
          onChange={onToggle}
        />
      </div>
      <div className="flex justify-end gap-1">
        {canWrite && (
          <>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${stage.name}`} disabled={sorting} onClick={onEdit}>
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Hapus ${stage.name}`}
              title={locked ? `${lockReason} tidak dapat dihapus` : undefined}
              disabled={sorting || locked}
              className="text-[#D64545] hover:text-[#D64545]"
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Halaman konfigurasi tahapan pipeline, dipakai untuk Leads dan Deals. */
export function PipelineConfigPage({ entity }: { entity: PipelineEntity }) {
  const copy = PIPELINE_COPY[entity];
  const { user } = useAuth();
  const canWrite = user?.role === "owner";

  const stages = usePipelineStages(entity);
  const toggle = useToggleStageActive();
  const reorder = useReorderPipelineStages(entity);
  const remove = useDeletePipelineStage();

  const [order, setOrder] = useState<string[] | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; stage?: PipelineStage }>({ open: false });
  const [deleting, setDeleting] = useState<PipelineStage>();
  const [previewOpen, setPreviewOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const data = stages.data ?? [];
  const sorting = order !== null;
  // Saat mengatur urutan, tanda mengikuti posisi: pertama = default, terakhir = akhir.
  const rows = sorting
    ? (order.map((id) => data.find((s) => s.id === id)).filter(Boolean) as PipelineStage[]).map((stage, index, list) => ({
        ...stage,
        isDefaultStage: index === 0,
        isTerminalStage: list.length > 1 && index === list.length - 1,
      }))
    : data;
  const dirty = sorting && order.some((id, index) => id !== data[index]?.id);
  const wonFirst = sorting && rows.length > 1 && !!rows[0]?.isWonStage;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !order) return;
    setOrder(arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))));
  };

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <ConfigNavbar />
        <div className="space-y-4 p-4">
          <ConfigHeader
            icon={Columns3}
            description={copy.pageDescription}
            actions={
              <>
                <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)} disabled={data.length === 0}>
                  <Eye className="size-4" />
                  Preview Pipeline
                </Button>
                {canWrite && (
                  <Button
                    type="button"
                    disabled={!dirty || wonFirst || reorder.isPending}
                    title={!dirty ? "Aktif setelah urutan tahapan diubah lewat Atur Urutan" : undefined}
                    onClick={() => order && reorder.mutate(order, { onSuccess: () => setOrder(null) })}
                    className="bg-[#1980C0] text-white hover:bg-[#166ea6]"
                  >
                    <Save className="size-4" />
                    {reorder.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                  </Button>
                )}
              </>
            }
          />

          <section className="rounded-xl border border-[#E4E4E7] bg-white p-4">
            <StageChevrons stages={rows.filter((s) => s.isActive)} />
          </section>

          <section className="space-y-4 rounded-xl border border-[#E4E4E7] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#1f1f1f]">Daftar Tahapan Pipeline</h2>
                <p className="text-sm text-[#475467]">Kelola urutan, nama, dan pengaturan setiap tahapan dalam pipeline {copy.items}.</p>
              </div>
              {canWrite && (
                <div className="flex flex-wrap gap-2">
                  {sorting ? (
                    <Button type="button" variant="outline" onClick={() => setOrder(null)} disabled={reorder.isPending}>
                      <X className="size-4" />
                      Batal Atur Urutan
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => setOrder(data.map((s) => s.id))} disabled={data.length < 2}>
                      <ArrowUpDown className="size-4" />
                      Atur Urutan
                    </Button>
                  )}
                  <Button
                    type="button"
                    disabled={sorting}
                    onClick={() => setDialog({ open: true })}
                    className="bg-[#1980C0] text-white hover:bg-[#166ea6]"
                  >
                    <Plus className="size-4" />
                    Tambah Tahapan
                  </Button>
                </div>
              )}
            </div>

            {sorting && (
              <p className="rounded-lg bg-[#E5F1FA] px-3 py-2 text-sm text-[#1980C0]">
                Geser baris lewat ikon ⠿ untuk mengubah urutan, lalu klik <strong>Simpan Perubahan</strong>. Tahapan
                paling atas otomatis menjadi <strong>Default</strong> dan paling bawah menjadi <strong>Akhir</strong>.
              </p>
            )}
            {wonFirst && (
              <p className="rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#D64545]">
                Tahapan Won Deals tidak boleh di urutan pertama karena akan menjadi tahapan default. Pindahkan tahapan
                lain ke paling atas.
              </p>
            )}

            {stages.isLoading ? (
              <Skeleton className="h-72 rounded-xl" />
            ) : stages.isError ? (
              <div className="rounded-xl border border-dashed border-[#D64545]/40 py-12 text-center text-sm text-[#D64545]">
                {errorMessage(stages.error, "Gagal memuat tahapan pipeline.")}
              </div>
            ) : data.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E4E4E7] py-12 text-center text-sm text-[#6b6b6b]">
                Belum ada tahapan pipeline.{canWrite && " Klik Tambah Tahapan untuk menambahkan."}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E4E4E7]">
                <div className={cn(COLUMNS, "min-w-[900px] bg-[#F8FAFC] px-4 py-3 text-sm font-medium text-[#1f1f1f]")}>
                  {/* Sel kosong untuk kolom pegangan geser; teksnya hanya untuk pembaca layar. */}
                  <span>
                    <span className="sr-only">Urutan</span>
                  </span>
                  <span>Tahapan</span>
                  <span>Deskripsi</span>
                  <span className="inline-flex items-center gap-1">
                    Probabilitas
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="size-3.5 cursor-help text-[#6b6b6b]" aria-label="Penjelasan probabilitas" />
                      </TooltipTrigger>
                      <TooltipContent>{copy.probabilityHint}</TooltipContent>
                    </Tooltip>
                  </span>
                  <span>Warna</span>
                  <span>Status</span>
                  <span className="text-right">Aksi</span>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={rows.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    {rows.map((stage) => (
                      <StageRow
                        key={stage.id}
                        stage={stage}
                        sorting={sorting}
                        canWrite={canWrite}
                        toggling={toggle.isPending}
                        onToggle={(isActive) => toggle.mutate({ id: stage.id, isActive })}
                        onEdit={() => setDialog({ open: true, stage })}
                        onDelete={() => setDeleting(stage)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </section>
        </div>
      </SidebarInset>

      {canWrite && (
        <StageDialog
          open={dialog.open}
          entity={entity}
          stage={dialog.stage}
          stages={data}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        />
      )}
      <PreviewDialog entity={entity} open={previewOpen} stages={rows} onOpenChange={setPreviewOpen} />
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(undefined)}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(undefined) })}
        title="Hapus tahapan?"
        description={
          deleting
            ? deleting.itemCount > 0
              ? `"${deleting.name}" masih berisi ${deleting.itemCount} ${copy.item}. Pindahkan ${copy.item} terlebih dahulu atau nonaktifkan tahapan ini.`
              : `"${deleting.name}" beserta evidence-nya akan dihapus permanen.`
            : ""
        }
        loading={remove.isPending}
      />
    </SidebarProvider>
  );
}
