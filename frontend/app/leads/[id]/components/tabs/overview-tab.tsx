import { Badge } from "@/components/ui/badge";
import type { PipelineStage } from "@/hooks/use-pipeline-stages";
import type { Lead } from "@/types/lead";
import {
  Check,
  ClipboardList,
  FileText,
  Info,
  MapPin,
  UserRound,
} from "lucide-react";

const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "-";

const money = (value?: string | number) =>
  value === undefined || value === null
    ? "-"
    : new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(Number(value));

const PRIORITY = {
  LOW: { label: "Rendah", color: "#667085" },
  MEDIUM: { label: "Sedang", color: "#F79009" },
  HIGH: { label: "Tinggi", color: "#D92D20" },
} as const;

function Field({
  label,
  value,
  compact = false,
}: {
  label: string;
  value?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 text-[11px] leading-4"
          : "grid grid-cols-[120px_1fr] gap-3 text-sm"
      }
    >
      <dt className="text-[#667085]">{label}</dt>
      <dd className="min-w-0 font-medium text-[#101828]">{value || "-"}</dd>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
  className = "",
  compact = false,
}: {
  title: string;
  icon: typeof Info;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded-lg border border-[#E4E7EC] bg-white ${compact ? "p-3" : "p-4"} ${className}`}
    >
      <h2
        className={`${compact ? "mb-3" : "mb-4"} flex items-center gap-2 text-sm font-bold text-[#101828]`}
      >
        <Icon className="size-4 text-[#0B63F6]" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function stageChangedAt(lead: Lead, stage: PipelineStage, index: number) {
  const change = lead.history?.find((entry) => {
    if (!entry.changes || typeof entry.changes !== "object") return false;
    const stageChange = (entry.changes as Record<string, unknown>).stageId;
    if (!stageChange || typeof stageChange !== "object") return false;
    return (stageChange as Record<string, unknown>).new === stage.id;
  });
  if (change) return change.createdAt;
  if (index === 0 || stage.id === lead.stageId) return lead.createdAt;
  return undefined;
}

function stageMessage(stage?: PipelineStage) {
  const normalized = stage?.name.toLowerCase() ?? "";
  if (normalized.includes("qualified")) {
    return {
      title: "Lead siap dikonversi ke Deals.",
      detail:
        "Calon customer sudah terverifikasi, memiliki minat dan kebutuhan yang jelas.",
    };
  }
  if (normalized.includes("converted")) {
    return {
      title: "Lead telah dikonversi ke Deals.",
      detail: "Proses penjualan dapat dilanjutkan melalui halaman Deals Management.",
    };
  }
  if (normalized.includes("disqualified")) {
    return {
      title: "Lead tidak dilanjutkan.",
      detail: stage?.description || "Lead berada pada tahap akhir Disqualified.",
    };
  }
  return {
    title: stage
      ? `Lead berada di tahap ${stage.name}.`
      : "Tahap Lead belum ditentukan.",
    detail:
      stage?.description ||
      "Pantau perkembangan Lead dan perbarui tahap sesuai hasil aktivitas terbaru.",
  };
}

function LeadStageProgress({
  lead,
  stages,
}: {
  lead: Lead;
  stages: PipelineStage[];
}) {
  const ordered = [...stages]
    .filter((stage) => stage.isActive)
    .sort((a, b) => a.position - b.position);
  const currentIndex = ordered.findIndex((stage) => stage.id === lead.stageId);
  const currentStage = currentIndex >= 0 ? ordered[currentIndex] : undefined;
  const message = stageMessage(currentStage);

  if (ordered.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[#D0D5DD] px-3 py-5 text-center text-xs text-[#667085]">
        Belum ada konfigurasi Pipeline Leads yang aktif.
      </p>
    );
  }

  return (
    <div>
      <div className="flex w-full items-start px-1 pt-0.5">
        {ordered.map((stage, index) => {
          const completed = currentIndex >= 0 && index < currentIndex;
          const current = index === currentIndex;
          const reached = completed || current;
          const changedAt = stageChangedAt(lead, stage, index);

          return (
            <div key={stage.id} className="relative min-w-0 flex-1 text-center">
              {index > 0 && (
                <span
                  className={`absolute top-[5px] right-1/2 h-[2px] w-full ${reached ? "bg-[#22B573]" : "bg-[#D9E2F2]"}`}
                />
              )}
              <span
                className={`relative z-10 mx-auto flex size-3 items-center justify-center rounded-full border-2 bg-white ${
                  completed
                    ? "border-[#16A34A] bg-[#16A34A] text-white"
                    : current
                      ? "border-[#1769FF] text-[#1769FF] ring-2 ring-[#D9E8FF]"
                      : "border-[#C9D4E8]"
                }`}
              >
                {completed ? (
                  <Check className="size-2" strokeWidth={3.5} />
                ) : current ? (
                  <span className="size-1 rounded-full bg-[#1769FF]" />
                ) : null}
              </span>
              <p
                className={`mt-1 truncate px-1 text-[9px] font-semibold leading-3 ${current ? "text-[#1769FF]" : "text-[#101828]"}`}
                title={stage.name}
              >
                {stage.name}
              </p>
              <p className="h-3 truncate px-1 text-[8px] leading-3 text-[#475467]">
                {changedAt ? date(changedAt) : ""}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-start gap-2 rounded-md bg-[#EAF4FF] px-3 py-2 text-[#102A56]">
        <Info className="mt-0.5 size-3.5 shrink-0 text-[#1769FF]" />
        <div className="min-w-0 text-[10px] leading-[14px]">
          <p className="font-semibold">{message.title}</p>
          <p>{message.detail}</p>
        </div>
      </div>
    </div>
  );
}

export function OverviewTab({
  lead,
  stages,
}: {
  lead: Lead;
  stages: PipelineStage[];
}) {
  const latestViewing = lead.viewings?.[0];
  const latestNoteActivity = [...(lead.activities ?? [])]
    .filter((activity) => activity.notes?.length)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  const latestNote = latestNoteActivity?.notes?.[0];
  const surveyImage = latestViewing?.attachments?.find((attachment) =>
    attachment.fileType?.startsWith("image/"),
  );
  const priority = PRIORITY[lead.priority ?? "MEDIUM"];

  return (
    <div className="grid items-start gap-3 xl:grid-cols-12">
      <Card title="Informasi Lead" icon={Info} className="xl:col-span-7">
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          <dl className="space-y-3">
            <Field
              label="Fase Leads"
              value={
                lead.stage ? (
                  <Badge colorHex={lead.stage.color}>{lead.stage.name}</Badge>
                ) : (
                  "-"
                )
              }
            />
            <Field label="Sumber Lead" value={lead.source?.name} />
            <Field label="Tanggal Lead" value={date(lead.createdAt)} />
            <Field label="Assigned Sales" value={lead.assignedUser?.name} />
            <Field label="Campaign" value={lead.campaign?.name} />
          </dl>
          <dl className="space-y-3">
            <Field
              label="Interest Project"
              value={lead.project?.name ?? lead.location?.name}
            />
            <Field label="Tipe Rumah" value={lead.productVariant?.name} />
            <Field label="Rentang Budget" value={money(lead.budget)} />
            <Field
              label="Prioritas"
              value={<Badge colorHex={priority.color}>{priority.label}</Badge>}
            />
          </dl>
        </div>
      </Card>

      <Card
        title="Tahap Lead"
        icon={ClipboardList}
        className="xl:col-span-5"
        compact
      >
        <LeadStageProgress lead={lead} stages={stages} />
      </Card>

      <Card
        title="Informasi Customer"
        icon={UserRound}
        className="xl:col-span-7"
      >
        <dl className="grid gap-3 md:grid-cols-2">
          <Field
            label="Nama"
            value={`${lead.customer.firstName} ${lead.customer.lastName || ""}`.trim()}
          />
          <Field label="Nomor HP" value={lead.customer.phoneNumber} />
          <Field label="Email" value={lead.customer.email} />
          <Field
            label="Umur"
            value={
              lead.customer.age !== undefined
                ? `${lead.customer.age} tahun`
                : undefined
            }
          />
          <Field
            label="Jenis Kelamin"
            value={
              lead.customer.gender === "male"
                ? "Laki-laki"
                : lead.customer.gender === "female"
                  ? "Perempuan"
                  : undefined
            }
          />
          <Field
            label="Alamat"
            value={
              lead.customer.location || lead.customer.organization?.location
            }
          />
        </dl>
      </Card>

      <div className="space-y-3 xl:col-span-5">
        <Card title="Informasi Survey" icon={MapPin} compact>
          {!latestViewing ? (
            <div className="flex min-h-16 items-center justify-center rounded-md border border-dashed border-[#D9E2F2] bg-[#FAFCFF] px-3 text-center text-xs text-[#667085]">
              Belum ada jadwal survey.
            </div>
          ) : (
            <div className="flex items-stretch gap-3">
              <dl className="min-w-0 flex-1 space-y-0.5">
                <Field
                  compact
                  label="Status Survey"
                  value={
                    latestViewing.status?.name ? (
                      <span className="inline-flex rounded bg-[#DDF8E4] px-1.5 py-0.5 text-[9px] font-semibold text-[#16803A]">
                        {latestViewing.status.name}
                      </span>
                    ) : (
                      "-"
                    )
                  }
                />
                <Field
                  compact
                  label="Tanggal Rencana"
                  value={date(latestViewing.scheduledAt)}
                />
                <Field
                  compact
                  label="Lokasi Survey"
                  value={latestViewing.location?.name}
                />
                <Field
                  compact
                  label="Unit Survey"
                  value={latestViewing.slot?.label}
                />
              </dl>
              {surveyImage && (
                <a
                  href={surveyImage.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
                  <img
                    src={surveyImage.fileUrl}
                    alt="Dokumentasi survey"
                    className="h-[70px] w-[108px] rounded-md object-cover"
                  />
                </a>
              )}
            </div>
          )}
        </Card>

        <Card title="Catatan Terakhir" icon={FileText} compact>
          {latestNote ? (
            <div className="flex items-start gap-2 rounded-md bg-[#FFF7DF] px-3 py-2 text-[10px] leading-[14px]">
              <FileText className="mt-0.5 size-3.5 shrink-0 text-[#F59E0B]" />
              <p className="min-w-0 flex-1 text-[#344054]">
                {latestNote.content}
              </p>
              <p className="shrink-0 text-right text-[9px] font-semibold text-[#344054]">
                {date(latestNoteActivity?.createdAt)}
                {latestNoteActivity?.actorId && (
                  <span className="block font-medium text-[#1769FF]">
                    Aktivitas Lead
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="flex min-h-12 items-center justify-center rounded-md border border-dashed border-[#E8DFCA] bg-[#FFFCF5] px-3 text-center text-xs text-[#667085]">
              Belum ada catatan.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
