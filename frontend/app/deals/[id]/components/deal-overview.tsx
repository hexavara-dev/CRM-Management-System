"use client";

import { Button } from "@/components/ui/button";
import type { PipelineStage } from "@/hooks/use-pipeline-stages";
import { formatRupiah, formatRupiahCompact } from "@/lib/helper";
import { pipelineTextColor, resolvePipelineColor } from "@/lib/pipeline-color";
import { cn } from "@/lib/utils";
import type { Deal, DealHistory, DealPayment } from "@/types/deal";
import {
  BadgeInfo,
  Building2,
  CalendarDays,
  Check,
  Circle,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Flag,
  Hourglass,
  KeyRound,
  Landmark,
  Link2,
  Phone,
  Tag,
  TrendingUp,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { DealPaymentSummary } from "./deal-payment-summary";

const date = (value?: string | Date | null) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "—";

const paymentLabels = {
  CASH: "Tunai",
  KPR: "KPR",
  KPR_SHARIA: "KPR Syariah",
};

function stageDates(
  history: DealHistory[],
  stages: PipelineStage[],
  deal: Deal,
) {
  // Riwayat berurut terbaru→terlama; dibalik agar masuk terakhir ke sebuah fase menang
  // (Deal yang dipindah mundur lalu maju lagi memakai tanggal masuk terbaru).
  const byId = new Map<string, string>();
  for (const row of [...history].reverse()) {
    if (row.action !== "stage_changed") continue;
    const stageChange = row.changes?.stageId;
    if (!stageChange || typeof stageChange !== "object") continue;
    const next = (stageChange as { new?: unknown }).new;
    if (typeof next === "string") byId.set(next, row.createdAt);
  }
  const first = stages[0];
  if (first && !byId.has(first.id)) byId.set(first.id, deal.createdAt);
  if (deal.stageId && !byId.has(deal.stageId))
    byId.set(deal.stageId, deal.createdAt);
  return byId;
}

function InfoRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-2 py-1.5 text-sm">
      <span className="flex items-center gap-2 text-xs text-[#667085]">
        {Icon && <Icon className="size-3.5 shrink-0" />}
        {label}
      </span>
      <div className="min-w-0 break-words font-medium text-[#101828]">
        {children || "—"}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[#E4E7EC] bg-white p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between border-b border-[#EAECF0] pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
          <Icon className="size-4 text-[#1570EF]" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DealOverview({
  deal,
  stages,
  history,
  payments,
  onAddPayment,
  onOpenDocuments,
}: {
  deal: Deal;
  stages: PipelineStage[];
  history: DealHistory[];
  payments: DealPayment[];
  onAddPayment: () => void;
  onOpenDocuments: () => void;
}) {
  const sortedStages = [...stages]
    .filter((stage) => stage.isActive !== false)
    .sort((a, b) => a.position - b.position);
  const activeIndex = sortedStages.findIndex(
    (stage) => stage.id === deal.stageId,
  );
  const dates = stageDates(history, sortedStages, deal);
  const customer = deal.lead?.customer;
  const fullName = customer
    ? `${customer.firstName} ${customer.lastName || ""}`.trim()
    : "—";
  const latestActivity =
    deal.lastActivityAt ||
    deal.activities?.reduce<string | undefined>((latest, activity) => {
      if (!latest || new Date(activity.createdAt) > new Date(latest))
        return activity.createdAt;
      return latest;
    }, undefined) ||
    deal.createdAt;
  const daysSince = Math.max(
    0,
    Math.floor((Date.now() - new Date(latestActivity).getTime()) / 86_400_000),
  );
  const currentStage = sortedStages[activeIndex] ?? deal.stage;
  const configuredStageColor = currentStage?.color;
  const stageColor = resolvePipelineColor(configuredStageColor, "#F79009");
  const project = deal.unit?.variant.product;
  const documents = deal.attachments ?? [];

  return (
    <div className="grid gap-3 p-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-3">
        <SectionCard title="Informasi Deals" icon={BadgeInfo}>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:pr-6">
              <InfoRow label="Project" icon={Building2}>
                {project?.name ? (
                  <span className="inline-flex max-w-full break-words rounded-md bg-[#DCFCE7] px-2 py-0.5 text-xs leading-tight text-[#15803D]">
                    {project.name}
                  </span>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow label="Unit" icon={KeyRound}>
                {deal.unit?.code || "—"}
              </InfoRow>
              <InfoRow label="Harga Deals" icon={Tag}>
                <span
                  className="whitespace-nowrap"
                  title={formatRupiah(
                    Number(deal.amount ?? deal.expectedAmount ?? 0),
                  )}
                >
                  {formatRupiahCompact(
                    Number(deal.amount ?? deal.expectedAmount ?? 0),
                  )}
                </span>
              </InfoRow>
              <InfoRow label="Jenis Pembayaran" icon={CreditCard}>
                {deal.paymentMethod ? (
                  <span className="inline-flex rounded-md bg-[#EFF8FF] px-2 py-0.5 text-xs leading-tight text-[#175CD3]">
                    {paymentLabels[deal.paymentMethod]}
                  </span>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow label="Bank" icon={Landmark}>
                {deal.financingBank ? (
                  <span className="inline-flex items-center gap-2">
                    {deal.financingBank.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={deal.financingBank.logoUrl}
                        alt={deal.financingBank.name}
                        className="size-5 rounded object-contain"
                      />
                    )}
                    {deal.financingBank.name}
                  </span>
                ) : (
                  deal.bankName || "—"
                )}
              </InfoRow>
            </div>
            <div className="flex flex-col gap-1 sm:border-l sm:border-[#EAECF0] sm:pl-6">
              <InfoRow label="Fase Deal" icon={Flag}>
                <span
                  className="inline-flex max-w-full break-words rounded-md px-2 py-0.5 text-xs leading-tight"
                  style={{
                    backgroundColor: stageColor,
                    color: pipelineTextColor(stageColor),
                  }}
                >
                  {currentStage?.name || "Belum ada fase"}
                </span>
              </InfoRow>
              <InfoRow label="Last Activity" icon={CalendarDays}>
                {date(latestActivity)}
              </InfoRow>
              <InfoRow label="Hari" icon={Hourglass}>
                <span className="rounded-md bg-[#FEF0C7] px-2 py-0.5 text-xs text-[#B54708]">
                  {daysSince} hari
                </span>
              </InfoRow>
              <InfoRow label="Assigned Sales" icon={UserRound}>
                {deal.assignedUser?.name || "—"}
              </InfoRow>
              <InfoRow label="Sumber Lead" icon={Link2}>
                {deal.lead?.source?.name || "—"}
              </InfoRow>
            </div>
          </div>
        </SectionCard>

        <DealPaymentSummary payments={payments} onAddPayment={onAddPayment} />

        <SectionCard
          title="Informasi Customer"
          icon={UserRound}
          action={
            customer && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-7 text-xs"
              >
                <Link href={`/customers/${customer.id}`}>
                  <ExternalLink className="mr-1 size-3" /> Lihat Customer
                </Link>
              </Button>
            )
          }
        >
          <InfoRow label="Nama">{fullName}</InfoRow>
          <InfoRow label="No. HP">
            {customer?.phoneNumber ? (
              <a
                href={`tel:${customer.phoneNumber}`}
                className="inline-flex items-center gap-2 text-[#1570EF]"
              >
                <Phone className="size-3.5" /> {customer.phoneNumber}
              </a>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow label="Email">{customer?.email || "—"}</InfoRow>
          <InfoRow label="Alamat">{customer?.location || "—"}</InfoRow>
        </SectionCard>

        <SectionCard title="Keterangan" icon={FileText}>
          <InfoRow label="Minat Awal">{deal.lead?.needsNotes || "—"}</InfoRow>
          <InfoRow label="Catatan Deal">{deal.notes || "—"}</InfoRow>
        </SectionCard>
      </div>

      <div className="space-y-3">
        <SectionCard title="Progress Deals" icon={TrendingUp}>
          {sortedStages.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#667085]">
              Pipeline Deal belum dikonfigurasi.
            </p>
          ) : (
            <div className="pb-2">
              <div className="flex px-2 pt-2">
                {sortedStages.map((stage, index) => {
                  const completed = activeIndex >= 0 && index < activeIndex;
                  const current = index === activeIndex;
                  return (
                    <div
                      key={stage.id}
                      className="relative min-w-0 flex-1 text-center"
                    >
                      {index > 0 && (
                        <div
                          className={cn(
                            "absolute right-1/2 top-2.5 h-0.5 w-full",
                            completed || current
                              ? "bg-[#32D583]"
                              : "bg-[#D0D5DD]",
                          )}
                        />
                      )}
                      <div className="relative z-10 mx-auto flex size-5 items-center justify-center rounded-full bg-white">
                        {completed ? (
                          <span className="flex size-5 items-center justify-center rounded-full bg-[#32D583] text-white">
                            <Check className="size-3" />
                          </span>
                        ) : current ? (
                          <span className="size-5 rounded-full border-[5px] border-[#1570EF] bg-white" />
                        ) : (
                          <Circle className="size-5 text-[#D0D5DD]" />
                        )}
                      </div>
                      <p
                        className={cn(
                          "mt-2 text-xs font-semibold",
                          current && "text-[#1570EF]",
                        )}
                      >
                        {stage.name}
                      </p>
                      <p className="mt-1 text-[10px] text-[#667085]">
                        {index <= activeIndex ? date(dates.get(stage.id)) : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {currentStage && (
            <div className="mt-4 rounded-lg bg-[#EFF8FF] p-3 text-xs text-[#344054]">
              <p className="flex items-center gap-2 font-semibold text-[#175CD3]">
                <BadgeInfo className="size-4" /> Status Saat Ini:{" "}
                {currentStage.name}
              </p>
              {currentStage.description && (
                <p className="mt-1 pl-6">{currentStage.description}</p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Dokumen Penting"
          icon={FileText}
          action={
            <button
              type="button"
              onClick={onOpenDocuments}
              title="Buka tab Documents"
              className="text-xs font-medium text-[#1570EF] hover:underline"
            >
              Lihat Semua ({documents.length})
            </button>
          }
        >
          {documents.length === 0 ? (
            <p className="py-5 text-center text-xs text-[#667085]">
              Belum ada dokumen Deal.
            </p>
          ) : (
            <div className="space-y-2">
              {documents.slice(0, 3).map((document) => (
                <div
                  key={document.id}
                  className="flex items-center gap-3 rounded-lg border border-[#EAECF0] p-2.5"
                >
                  <FileText className="size-5 text-[#F04438]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[#101828]">
                      {document.fileName || document.name}
                    </p>
                    <p className="text-[10px] text-[#667085]">
                      {document.fileSize
                        ? `${Math.round(document.fileSize / 1024)} KB`
                        : "—"}{" "}
                      • {date(document.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    asChild
                  >
                    <a
                      href={document.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Download ${document.fileName || document.name}`}
                    >
                      <Download className="size-3.5" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
