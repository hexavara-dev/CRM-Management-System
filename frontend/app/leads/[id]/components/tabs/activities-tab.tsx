"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PipelineStage } from "@/hooks/use-pipeline-stages";
import { useLeads } from "@/hooks/use-leads";
import api from "@/lib/api";
import type { Lead } from "@/types/lead";
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  Info,
  Layers3,
  Loader2,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "-";

function description(activity: NonNullable<Lead["activities"]>[number]) {
  if (activity.notes?.[0]?.content) return activity.notes[0].content;
  if (activity.tasks?.[0])
    return activity.tasks[0].description || activity.tasks[0].title;
  if (activity.callLogs?.[0])
    return (
      activity.callLogs[0].description ||
      activity.callLogs[0].title ||
      "Panggilan dengan customer"
    );
  return activity.activityType;
}

function activityPresentation(type: string) {
  const normalized = type.toLowerCase();
  if (
    normalized.includes("visit") ||
    normalized.includes("survey") ||
    normalized.includes("meeting")
  ) {
    return {
      label: normalized.includes("survey") ? "Visit / Survey" : type,
      icon: MapPin,
      iconClass: "bg-[#E8F8EE] text-[#16A34A]",
    };
  }
  if (
    normalized.includes("penawaran") ||
    normalized.includes("proposal") ||
    normalized.includes("quotation")
  ) {
    return {
      label: "Penawaran",
      icon: FileText,
      iconClass: "bg-[#F3E8FF] text-[#9333EA]",
    };
  }
  if (
    normalized.includes("call") ||
    normalized.includes("follow") ||
    normalized.includes("task")
  ) {
    return {
      label: normalized.includes("task") ? "Follow Up (FU)" : type,
      icon: Phone,
      iconClass: "bg-[#E9F2FF] text-[#1769FF]",
    };
  }
  return {
    label: normalized.includes("note") ? "Catatan" : type,
    icon: ClipboardList,
    iconClass: "bg-[#F2F4F7] text-[#475467]",
  };
}

function PanelTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof Info;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-bold text-[#102A56]">
        <Icon className="size-4 text-[#1769FF]" />
        {title}
      </h3>
      {action}
    </div>
  );
}

export function ActivitiesTab({
  lead,
  stages,
  onAddActivity,
}: {
  lead: Lead;
  stages: PipelineStage[];
  onAddActivity: (data: {
    type: string;
    description: string;
  }) => Promise<void>;
}) {
  const [filter, setFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activityType, setActivityType] = useState("follow-up");
  const [activityDescription, setActivityDescription] = useState("");
  const [targetStageId, setTargetStageId] = useState("");
  const [pendingStage, setPendingStage] = useState<PipelineStage>();
  const [evidenceFiles, setEvidenceFiles] = useState<Record<string, File>>({});
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { setLeadStage } = useLeads();

  const activities = useMemo(
    () =>
      [...(lead.activities ?? [])].sort(
        (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      ),
    [lead.activities],
  );
  const filtered =
    filter === "all"
      ? activities
      : activities.filter((activity) => activity.activityType === filter);
  const shown = showAll ? filtered : filtered.slice(0, 4);
  const count = (types: string[]) =>
    activities.filter((activity) =>
      types.some((type) => activity.activityType.toLowerCase().includes(type)),
    ).length;
  const tasks = activities
    .flatMap((activity) => activity.tasks ?? [])
    .filter((task) => task.dueDate)
    .sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!));
  const nextTask = tasks.find((task) => +new Date(task.dueDate!) >= Date.now()) ?? tasks[0];
  const nextVisit =
    lead.viewings
      ?.filter((viewing) => +new Date(viewing.scheduledAt) >= Date.now())
      .sort(
        (a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt),
      )[0] ?? lead.viewings?.[0];
  const latestNoteActivity = activities.find(
    (activity) => activity.notes?.length,
  );
  const latestNote = latestNoteActivity?.notes?.[0];
  const activeStages = stages
    .filter((stage) => stage.isActive)
    .sort((a, b) => a.position - b.position);
  const requiredEvidence =
    pendingStage?.evidences.filter((item) => item.isRequired) ?? [];

  const submitActivity = async () => {
    if (!activityDescription.trim()) return;
    setSaving(true);
    try {
      await onAddActivity({
        type: activityType,
        description: activityDescription.trim(),
      });
      setActivityDescription("");
      setAddOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const openNoteEditor = () => {
    setActivityType("note");
    setActivityDescription(latestNote?.content ?? "");
    setAddOpen(true);
  };

  const requestStageChange = () => {
    const stage = activeStages.find((item) => item.id === targetStageId);
    if (!stage || stage.id === lead.stageId) return;
    if (stage.evidences.some((item) => item.isRequired)) {
      setEvidenceFiles({});
      setPendingStage(stage);
      return;
    }
    void changeStage(stage, []).catch(() => undefined);
  };

  const changeStage = async (
    stage: PipelineStage,
    attachmentIds: string[],
  ) => {
    setSaving(true);
    try {
      await setLeadStage({
        id: lead.id,
        stageName: stage.name,
        evidenceAttachmentIds: attachmentIds,
      });
      toast.success(`Fase Lead diubah ke ${stage.name}.`);
      setTargetStageId("");
      setPendingStage(undefined);
      setEvidenceFiles({});
    } catch (error) {
      await Promise.all(
        attachmentIds.map((id) =>
          api.delete(`/api/attachment/${id}`).catch(() => undefined),
        ),
      );
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const uploadEvidenceAndMove = async () => {
    if (
      !pendingStage ||
      requiredEvidence.some(
        (item) => !evidenceFiles[item.id ?? item.name],
      )
    )
      return;
    setSaving(true);
    const ids: string[] = [];
    try {
      for (const evidence of requiredEvidence) {
        const form = new FormData();
        form.append("document", evidenceFiles[evidence.id ?? evidence.name]);
        const response = await api.post<{ attachment: { id: string } }>(
          `/api/lead/${lead.id}/upload`,
          form,
        );
        ids.push(response.data.attachment.id);
      }
      await changeStage(pendingStage, ids);
    } catch (error) {
      await Promise.all(
        ids.map((id) =>
          api.delete(`/api/attachment/${id}`).catch(() => undefined),
        ),
      );
      toast.error(
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || "Gagal mengubah fase Lead.",
      );
      setSaving(false);
    }
  };

  const stats = [
    {
      label: "Total Aktivitas",
      value: activities.length,
      icon: Layers3,
      tone: "bg-[#EDF4FF] text-[#1769FF]",
    },
    {
      label: "Follow Up (FU)",
      value: count(["follow", "call", "task"]),
      icon: Phone,
      tone: "bg-[#EDF2FF] text-[#4F46E5]",
    },
    {
      label: "Penawaran",
      value: count(["penawaran", "proposal", "quotation"]),
      icon: ClipboardList,
      tone: "bg-[#F3E8FF] text-[#9333EA]",
    },
    {
      label: "Visit / Survey",
      value:
        count(["visit", "survey", "meeting"]) +
        (lead.viewings?.length ?? 0),
      icon: MapPin,
      tone: "bg-[#E8F8EE] text-[#16A34A]",
    },
  ];

  return (
    <div className="grid items-start gap-3 xl:grid-cols-12">
      <section className="rounded-lg border border-[#E4E7EC] bg-white p-3 xl:col-span-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#102A56]">
          <ClipboardList className="size-4 text-[#1769FF]" />
          Aktivitas Leads
        </h2>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className="flex min-h-[58px] items-center gap-2.5 rounded-md bg-[#F6F8FC] px-3 py-2"
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-md ${tone}`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[10px] text-[#667085]">{label}</p>
                <p className="text-base font-bold leading-5 text-[#102A56]">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[#102A56]">
            Timeline Aktivitas
          </h3>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-36 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Aktivitas</SelectItem>
                {[...new Set(activities.map((item) => item.activityType))].map(
                  (type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-[10px]">
                  <Plus className="size-3.5" />
                  Tambah Aktivitas
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CalendarDays className="size-5 text-[#1769FF]" />
                    Tambah Aktivitas
                  </DialogTitle>
                  <DialogDescription>
                    Catat interaksi atau perkembangan terbaru dengan Lead.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold">
                      Jenis Aktivitas <span className="text-red-500">*</span>
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: "follow-up", label: "Follow Up", icon: Phone },
                        {
                          value: "penawaran",
                          label: "Penawaran",
                          icon: FileText,
                        },
                        { value: "visit", label: "Visit / Survey", icon: MapPin },
                        {
                          value: "note",
                          label: "Catatan",
                          icon: ClipboardList,
                        },
                      ].map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setActivityType(value)}
                          className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border text-[10px] font-medium ${
                            activityType === value
                              ? "border-[#1769FF] bg-[#EFF6FF] text-[#1769FF]"
                              : "border-[#D9E2F2] text-[#344054]"
                          }`}
                        >
                          <Icon className="size-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="activity-detail"
                      className="mb-1.5 block text-xs font-semibold"
                    >
                      Detail Aktivitas <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      id="activity-detail"
                      value={activityDescription}
                      onChange={(event) =>
                        setActivityDescription(event.target.value)
                      }
                      placeholder="Tuliskan detail aktivitas..."
                      rows={5}
                      maxLength={500}
                    />
                    <p className="mt-1 text-right text-[10px] text-[#667085]">
                      {activityDescription.length} / 500
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAddOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    disabled={saving || !activityDescription.trim()}
                    onClick={submitActivity}
                  >
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    <Plus className="size-4" />
                    Simpan Aktivitas
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="relative mt-2.5 pl-4">
          {shown.length > 0 && (
            <span className="absolute top-2 bottom-2 left-[5px] w-px bg-[#C7D8F6]" />
          )}
          {shown.length === 0 ? (
            <p className="rounded-md border border-dashed border-[#D9E2F2] p-7 text-center text-xs text-[#667085]">
              Belum ada aktivitas.
            </p>
          ) : (
            <div className="space-y-2">
              {shown.map((activity) => {
                const presentation = activityPresentation(
                  activity.activityType,
                );
                const Icon = presentation.icon;
                return (
                  <div key={activity.id} className="relative">
                    <span className="absolute top-5 -left-[15px] z-10 size-2 rounded-full border-2 border-white bg-[#1769FF]" />
                    <p className="mb-1 text-[9px] font-medium text-[#667085]">
                      {formatDate(activity.createdAt)}
                    </p>
                    <details className="group rounded-md border border-[#D9E2F2] bg-white">
                      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2">
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${presentation.iconClass}`}
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-[#102A56]">
                            {presentation.label}
                          </p>
                          <p className="truncate text-[10px] leading-4 text-[#475467]">
                            {description(activity)}
                          </p>
                        </div>
                        <ChevronDown className="size-3.5 text-[#102A56] transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-[#EEF2F6] px-12 py-2 text-[10px] text-[#475467]">
                        <p>{description(activity)}</p>
                        {activity.tasks?.map((task) => (
                          <p key={task.id} className="mt-1 font-medium">
                            Follow-up: {formatDate(task.dueDate)}
                          </p>
                        ))}
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {filtered.length > 4 && (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[9px]"
              onClick={() => setShowAll((current) => !current)}
            >
              {showAll ? "Tampilkan Lebih Sedikit" : "Tampilkan Lebih Banyak"}
              <ChevronDown
                className={`size-3 transition-transform ${showAll ? "rotate-180" : ""}`}
              />
            </Button>
          </div>
        )}
      </section>

      <aside className="space-y-3 xl:col-span-4">
        <section className="rounded-lg border border-[#E4E7EC] bg-white p-3">
          <PanelTitle
            icon={CalendarDays}
            title="Next Follow-up"
            action={<Info className="size-3.5 text-[#1769FF]" />}
          />
          {nextTask ? (
            <div className="text-[10px] leading-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#102A56]">
                  {formatDate(nextTask.dueDate)}
                </p>
                <span className="rounded bg-[#DDF8E4] px-1.5 py-0.5 text-[9px] font-semibold text-[#16803A]">
                  Terjadwal
                </span>
              </div>
              <p className="mt-1 text-[#475467]">
                {nextTask.description || nextTask.title}
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-[#667085]">
              Belum ada follow-up berikutnya.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-[#E4E7EC] bg-white p-3">
          <PanelTitle
            icon={RefreshCw}
            title="Ubah Fase Leads"
            action={<Info className="size-3.5 text-[#1769FF]" />}
          />
          <div className="mb-2 flex items-center gap-2 text-[10px]">
            <span className="text-[#667085]">Fase Saat Ini</span>
            <BadgeLike
              label={lead.stage?.name || "-"}
              color={lead.stage?.color || "#667085"}
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Select value={targetStageId} onValueChange={setTargetStageId}>
              <SelectTrigger className="h-8 text-[10px]">
                <SelectValue placeholder="Pilih fase..." />
              </SelectTrigger>
              <SelectContent>
                {activeStages.map((stage) => (
                  <SelectItem
                    key={stage.id}
                    value={stage.id}
                    disabled={stage.id === lead.stageId}
                  >
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="h-8 px-3 text-[10px]"
              disabled={
                !targetStageId ||
                targetStageId === lead.stageId ||
                saving
              }
              onClick={requestStageChange}
            >
              Simpan
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-[#E4E7EC] bg-white p-3">
          <PanelTitle
            icon={CalendarDays}
            title="Jadwal Visit"
            action={
              <button
                type="button"
                onClick={() => router.push("/viewings")}
                className="text-[9px] font-semibold text-[#1769FF]"
              >
                Lihat Semua
              </button>
            }
          />
          {nextVisit ? (
            <div className="text-[10px] leading-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#102A56]">
                  Visit Lokasi -{" "}
                  {nextVisit.location?.name || "Lokasi belum ditentukan"}
                </p>
                <span className="rounded bg-[#DDF8E4] px-1.5 py-0.5 text-[9px] font-semibold text-[#16803A]">
                  {nextVisit.status?.name || "Terjadwal"}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-[#475467]">
                <CalendarDays className="size-3" />
                {formatDate(nextVisit.scheduledAt)}
              </p>
              <p className="flex items-center gap-1 text-[#475467]">
                <UserRound className="size-3" />
                {lead.customer.firstName} {lead.customer.lastName || ""} (1 orang)
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-[#667085]">
              Belum ada jadwal visit.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-[#E4E7EC] bg-white p-3">
          <PanelTitle
            icon={FileText}
            title="Catatan Singkat"
            action={
              <button
                type="button"
                onClick={openNoteEditor}
                className="flex items-center gap-1 text-[9px] font-semibold text-[#1769FF]"
              >
                <Pencil className="size-3" />
                Edit
              </button>
            }
          />
          <p className="text-[10px] leading-4 text-[#475467]">
            {latestNote?.content || "Belum ada catatan."}
          </p>
        </section>
      </aside>

      <Dialog
        open={!!pendingStage}
        onOpenChange={(open) =>
          !open && !saving && setPendingStage(undefined)
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evidence Wajib</DialogTitle>
            <DialogDescription>
              Lengkapi evidence sebelum berpindah ke {pendingStage?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {requiredEvidence.map((evidence) => {
              const key = evidence.id ?? evidence.name;
              const accept = evidence.fileTypes
                .flatMap(
                  (type) =>
                    ({
                      PDF: [".pdf"],
                      DOC: [".doc", ".docx"],
                      IMAGE: [".jpg", ".jpeg", ".png", ".webp"],
                      SHEET: [".xls", ".xlsx"],
                    })[type],
                )
                .join(",");
              return (
                <label key={key} className="block rounded-lg border p-3">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Paperclip className="size-4" />
                    {evidence.name}
                  </span>
                  <Input
                    type="file"
                    accept={accept}
                    className="mt-2"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file)
                        setEvidenceFiles((current) => ({
                          ...current,
                          [key]: file,
                        }));
                    }}
                  />
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setPendingStage(undefined)}
            >
              Batal
            </Button>
            <Button
              disabled={
                saving ||
                requiredEvidence.some(
                  (item) => !evidenceFiles[item.id ?? item.name],
                )
              }
              onClick={uploadEvidenceAndMove}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Upload & Pindahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BadgeLike({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
      style={{ color, backgroundColor: `${color}18` }}
    >
      {label}
    </span>
  );
}
