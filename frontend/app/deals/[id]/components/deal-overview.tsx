"use client";

import { Button } from "@/components/ui/button";
import type { PipelineStage } from "@/hooks/use-pipeline-stages";
import { cn } from "@/lib/utils";
import type { Deal, DealHistory, DealPayment } from "@/types/deal";
import {
  BadgeInfo,
  Banknote,
  Check,
  Circle,
  Download,
  ExternalLink,
  FileText,
  Phone,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

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
  const byId = new Map<string, string>();
  for (const row of [...history].reverse()) {
    if (row.action !== "stage_changed") continue;
    const stageChange = row.changes?.stageId;
    if (!stageChange || typeof stageChange !== "object") continue;
    const next = (stageChange as { new?: unknown }).new;
    if (typeof next === "string" && !byId.has(next))
      byId.set(next, row.createdAt);
  }
  const first = stages[0];
  if (first && !byId.has(first.id)) byId.set(first.id, deal.createdAt);
  return byId;
}

function InfoRow({
  label,
  children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3 py-1.5 text-sm">
      <span className="text-[#667085]">{label}</span>
      <div className="min-w-0 font-medium text-[#101828]">
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
}: {
  deal: Deal;
  stages: PipelineStage[];
  history: DealHistory[];
  payments: DealPayment[];
  onAddPayment: () => void;
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
  const stageColor =
    configuredStageColor && /^#[0-9a-f]{6}$/i.test(configuredStageColor)
      ? configuredStageColor
      : "#F79009";
  const rgb = [1, 3, 5].map((offset) =>
    Number.parseInt(stageColor.slice(offset, offset + 2), 16),
  );
  const readableStageColor =
    (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 255000 > 0.82
      ? "#B54708"
      : stageColor;
  const project = deal.unit?.variant.product;
  const documents = deal.attachments ?? [];
  const groupedPayments = new Map<string, DealPayment[]>();
  for (const payment of payments) {
    groupedPayments.set(payment.type, [
      ...(groupedPayments.get(payment.type) ?? []),
      payment,
    ]);
  }
  const paymentRows = [
    ["ITJ", "ITJ"],
    ["DP", "DP"],
    ["SETTLEMENT", "Pelunasan"],
  ] as const;

  return (
    <div className="grid gap-3 p-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-3">
        <SectionCard title="Informasi Deals" icon={BadgeInfo}>
          <div className="grid gap-x-8 md:grid-cols-2 md:divide-x md:divide-[#EAECF0]">
            <div className="md:pr-6">
              <InfoRow label="Project">
                {project?.name ? (
                  <span className="inline-flex rounded-md bg-[#DCFCE7] px-2 py-0.5 text-xs text-[#15803D]">
                    {project.name}
                  </span>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow label="Unit">{deal.unit?.code || "—"}</InfoRow>
              <InfoRow label="Harga Deals">
                {rupiah(Number(deal.amount ?? deal.expectedAmount ?? 0))}
              </InfoRow>
              <InfoRow label="Jenis Pembayaran">
                {deal.paymentMethod ? paymentLabels[deal.paymentMethod] : "—"}
              </InfoRow>
              <InfoRow label="Bank">
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
            <div className="md:pl-6">
              <InfoRow label="Target Closing">
                {deal.expectedClosingDate
                  ? date(deal.expectedClosingDate)
                  : "—"}
              </InfoRow>
              <InfoRow label="Fase Deal">
                <span
                  className="inline-flex rounded-md px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: `${readableStageColor}20`,
                    color: readableStageColor,
                  }}
                >
                  {currentStage?.name || "Belum ada fase"}
                </span>
              </InfoRow>
              <InfoRow label="Last Activity">{date(latestActivity)}</InfoRow>
              <InfoRow label="Hari">
                <span className="rounded-md bg-[#FEF0C7] px-2 py-0.5 text-xs text-[#B54708]">
                  {daysSince} hari
                </span>
              </InfoRow>
              <InfoRow label="Assigned Sales">
                {deal.assignedUser?.name || "—"}
              </InfoRow>
              <InfoRow label="Sumber Lead">
                {deal.lead?.source?.name || "—"}
              </InfoRow>
            </div>
          </div>
        </SectionCard>

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
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max px-2 pt-2">
                {sortedStages.map((stage, index) => {
                  const completed = activeIndex >= 0 && index < activeIndex;
                  const current = index === activeIndex;
                  return (
                    <div key={stage.id} className="relative w-32 text-center">
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
                        {date(dates.get(stage.id))}
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
          title="Ringkasan Transaksi"
          icon={WalletCards}
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddPayment}
              className="h-7 text-xs text-[#1570EF]"
            >
              Tambah
            </Button>
          }
        >
          <div className="space-y-1">
            {paymentRows.map(([type, label]) => {
              const rows = groupedPayments.get(type) ?? [];
              const amount = rows.reduce(
                (sum, row) => sum + Number(row.amount),
                0,
              );
              const paidRows = rows.filter((row) => row.status === "PAID");
              const isPaid = rows.length > 0 && paidRows.length === rows.length;
              const latestPaid = paidRows.sort(
                (a, b) =>
                  new Date(b.paidAt || 0).getTime() -
                  new Date(a.paidAt || 0).getTime(),
              )[0];
              return (
                <div
                  key={type}
                  className="grid grid-cols-[90px_1fr_auto_auto] items-center gap-2 py-2 text-xs"
                >
                  <span className="flex items-center gap-2 text-[#344054]">
                    <Banknote className="size-4 text-[#667085]" /> {label}
                  </span>
                  <span className="font-semibold text-[#101828]">
                    {amount ? rupiah(amount) : "—"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5",
                      isPaid
                        ? "bg-[#DCFCE7] text-[#15803D]"
                        : "bg-[#F2F4F7] text-[#667085]",
                    )}
                  >
                    {isPaid ? "Lunas" : "—"}
                  </span>
                  <span className="w-20 text-right text-[#667085]">
                    {date(latestPaid?.paidAt)}
                  </span>
                </div>
              );
            })}
            <div className="mt-2 flex items-center justify-between rounded-lg bg-[#EFF8FF] px-3 py-2 text-sm font-semibold text-[#101828]">
              <span>∑ &nbsp; Total Harga Deals</span>
              <span>
                {rupiah(Number(deal.amount ?? deal.expectedAmount ?? 0))}
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Dokumen Penting"
          icon={FileText}
          action={
            <span className="text-xs font-medium text-[#1570EF]">
              Lihat Semua ({documents.length})
            </span>
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
                    <p className="break-words text-xs font-medium text-[#101828]">
                      {document.documentName ||
                        document.fileName ||
                        document.name}
                    </p>
                    {document.documentName && (
                      <p className="break-all text-[11px] text-[#475467]">
                        {document.fileName}
                      </p>
                    )}
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
                      aria-label={`Download ${document.documentName || document.fileName || document.name}`}
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
