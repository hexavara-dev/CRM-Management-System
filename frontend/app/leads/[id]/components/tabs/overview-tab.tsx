import { Badge } from "@/components/ui/badge";
import type { PipelineStage } from "@/hooks/use-pipeline-stages";
import type { Lead } from "@/types/lead";
import { useState } from "react";
import {
  Check,
  CalendarDays,
  ClipboardList,
  FileText,
  ImageOff,
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

const moneyFull = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const moneyShort = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  notation: "compact",
  maximumFractionDigits: 2,
});

const money = (value?: string | number) =>
  value === undefined || value === null ? (
    "-"
  ) : (
    <span title={moneyFull.format(Number(value))}>
      {moneyShort.format(Number(value))}
    </span>
  );

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
          : "grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2 text-xs"
      }
    >
      <dt className={compact ? "text-[#667085]" : "text-[11px] text-[#667085]"}>
        {label}
      </dt>
      <dd className="min-w-0 break-words font-medium text-[#101828]">
        {value || "-"}
      </dd>
    </div>
  );
}

/** Foto tipe rumah; bila tidak ada atau gagal dimuat tampil placeholder broken. */
function SurveyTypeImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={`Foto ${alt} tidak tersedia`}
        className="flex h-[110px] w-[160px] shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[#D0D5DD] bg-[#F9FAFB] text-[#98A2B3]"
      >
        <ImageOff className="size-6" />
        <span className="text-[10px]">Gambar tipe tidak tersedia</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="h-[110px] w-[160px] shrink-0 rounded-md object-cover"
    />
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
      detail:
        "Proses penjualan dapat dilanjutkan melalui halaman Deals Management.",
    };
  }
  if (normalized.includes("disqualified")) {
    return {
      title: "Lead tidak dilanjutkan.",
      detail:
        stage?.description || "Lead berada pada tahap akhir Disqualified.",
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
                  className={`absolute top-[7px] right-1/2 h-[2px] w-full ${reached ? "bg-[#22B573]" : "bg-[#D9E2F2]"}`}
                />
              )}
              <span
                className={`relative z-10 mx-auto flex size-4 items-center justify-center rounded-full border-2 bg-white ${
                  completed
                    ? "border-[#16A34A] bg-[#16A34A] text-white"
                    : current
                      ? "border-[#1769FF] text-[#1769FF] ring-2 ring-[#D9E8FF]"
                      : "border-[#C9D4E8]"
                }`}
              >
                {completed ? (
                  <Check className="size-2.5" strokeWidth={3.5} />
                ) : current ? (
                  <span className="size-1.5 rounded-full bg-[#1769FF]" />
                ) : null}
              </span>
              <p
                className={`mt-1.5 px-0.5 break-words text-[11px] font-semibold leading-4 ${current ? "text-[#1769FF]" : "text-[#101828]"}`}
                title={stage.name}
              >
                {stage.name}
              </p>
              <p className="h-4 truncate px-1 text-[10px] leading-4 text-[#475467]">
                {changedAt ? date(changedAt) : ""}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-md bg-[#EAF4FF] px-3 py-2 text-[#102A56]">
        <Info className="mt-0.5 size-4 shrink-0 text-[#1769FF]" />
        <div className="min-w-0 text-xs leading-4">
          <p className="font-semibold">{message.title}</p>
          <p>{message.detail}</p>
        </div>
      </div>
    </div>
  );
}

/** Isian custom field dengan label dari versi template saat Lead dibuat. */
function customFieldRows(lead: Lead) {
  const values = lead.customValues ?? {};
  const fields = lead.formTemplateVersion?.fields ?? [];
  return Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const field = fields.find((item) => item.key === key && !item.standard);
      let text: string;
      if (Array.isArray(value)) text = value.join(", ");
      else if (typeof value === "boolean") text = value ? "Ya" : "Tidak";
      else if (field?.type === "CURRENCY" && typeof value === "number") text = moneyFull.format(value);
      else if (field?.type === "DATE" && typeof value === "string") text = date(value);
      else text = String(value);
      return { key, label: field?.label ?? key.replace(/_/g, " "), value: text };
    });
}

export function OverviewTab({
  lead,
  stages,
}: {
  lead: Lead;
  stages: PipelineStage[];
}) {
  const latestNoteActivity = [...(lead.activities ?? [])]
    .filter((activity) => activity.notes?.length)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  const latestNote = latestNoteActivity?.notes?.[0];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const surveyViewing = [...(lead.viewings ?? [])]
    .filter((viewing) => new Date(viewing.scheduledAt) >= todayStart)
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))[0];
  const typeImageUrl = lead.productVariant?.media?.[0]?.fileUrl;
  const priority = PRIORITY[lead.priority ?? "MEDIUM"];
  const customRows = customFieldRows(lead);

  return (
    <div className="grid items-start gap-3 xl:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <Card title="Informasi Lead" icon={Info}>
          <div className="grid min-w-0 gap-y-3 md:grid-cols-2 md:divide-x md:divide-[#EAECF0]">
            <dl className="min-w-0 space-y-3 md:pr-6">
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
            <dl className="min-w-0 space-y-3 md:pl-6">
              <Field
                label="Interest Project"
                value={lead.project?.name ?? lead.location?.name}
              />
              <Field label="Tipe Rumah" value={lead.productVariant?.name} />
              <Field label="Rentang Budget" value={money(lead.budget)} />
              <Field
                label="Prioritas"
                value={
                  <Badge colorHex={priority.color}>{priority.label}</Badge>
                }
              />
            </dl>
          </div>
        </Card>

        <Card title="Informasi Customer" icon={UserRound}>
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
                lead.customer.age != null
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

        {customRows.length > 0 && (
          <Card title="Informasi Tambahan" icon={FileText}>
            <dl className="grid gap-3 md:grid-cols-2">
              {customRows.map((row) => (
                <Field key={row.key} label={row.label} value={row.value} />
              ))}
            </dl>
          </Card>
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <Card title="Tahap Lead" icon={ClipboardList} compact>
          <LeadStageProgress lead={lead} stages={stages} />
        </Card>
        {surveyViewing && (
          <section className="rounded-lg border border-[#E4E7EC] bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="size-4 text-[#1769FF]" />
              <h3 className="text-sm font-semibold text-[#102A56]">
                Informasi Survey
              </h3>
            </div>
            <div className="flex items-stretch gap-4">
              <dl className="min-w-0 flex-1 text-xs">
                {[
                  {
                    label: "Status Survey",
                    value: (
                      <span className="inline-flex rounded-md bg-[#DDF8E4] px-2 py-0.5 text-[11px] font-semibold text-[#16803A]">
                        {surveyViewing.status?.name || "Rencana Survey"}
                      </span>
                    ),
                  },
                  {
                    label: "Tanggal Rencana",
                    value: (
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="size-4 text-[#1769FF]" />
                        {date(surveyViewing.scheduledAt)}
                      </span>
                    ),
                  },
                  {
                    label: "Lokasi Survey",
                    value: surveyViewing.location?.name ?? "-",
                  },
                  {
                    label: "Unit Survey",
                    value: surveyViewing.slot?.label ?? "-",
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[120px_1fr] items-center gap-2 border-b border-dashed border-[#E4E7EC] py-2 last:border-b-0"
                  >
                    <dt className="text-[#344054]">{row.label}</dt>
                    <dd className="min-w-0 text-[#101828]">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <SurveyTypeImage
                src={typeImageUrl}
                alt={lead.productVariant?.name ?? "Tipe"}
              />
            </div>
          </section>
        )}

        <Card title="Catatan Terakhir" icon={FileText} compact>
          {latestNote ? (
            <div className="flex items-start gap-2 rounded-md bg-[#FFF7DF] px-3 py-2 text-xs leading-4">
              <FileText className="mt-0.5 size-4 shrink-0 text-[#F59E0B]" />
              <p className="min-w-0 flex-1 text-[#344054]">
                {latestNote.content}
              </p>
              <p className="shrink-0 text-right text-[10px] font-semibold text-[#344054]">
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
