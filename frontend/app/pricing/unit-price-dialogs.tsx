"use client";

import { useState, type ReactNode } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorText } from "@/components/ui/error-text";
import { FormInput } from "@/components/ui/form-input";
import { HelperText } from "@/components/ui/helper-text";
import { LabelText } from "@/components/ui/label-text";
import { FormTextarea } from "@/components/ui/form-textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/hooks/use-projects";
import {
  PRICE_APPROVAL_ENABLED,
  formatDay,
  formatPrice,
  formatSigned,
  useCreateAdjustment,
  useUnitPrice,
  useUnitPriceHistory,
  type PriceAdjustment,
  type UnitPriceDetail,
} from "@/hooks/use-unit-prices";
import { cn } from "@/lib/utils";
import { AdjustmentStatusBadge, UnitStatusBadge } from "./status-badge";

export const todayJakarta = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );

const MAX_PRICE = Number.MAX_SAFE_INTEGER;

export const adjustmentSchema = z.object({
  /** Harga jual final, berupa digit saja. */
  price: z
    .string()
    .regex(/^\d+$/, "Harga jual baru wajib diisi")
    .refine((value) => Number(value) <= MAX_PRICE, "Harga terlalu besar"),
  reason: z
    .string()
    .trim()
    .min(3, "Alasan minimal 3 karakter")
    .max(500, "Alasan maksimal 500 karakter"),
  effectiveDate: z
    .string()
    .min(1, "Tanggal efektif wajib diisi")
    .refine(
      (value) => value >= todayJakarta(),
      "Tanggal efektif tidak boleh sebelum hari ini",
    ),
});
export type AdjustmentFormData = z.infer<typeof adjustmentSchema>;

const groupDigits = (digits: string) =>
  digits ? Number(digits).toLocaleString("id-ID") : "";

/** Input harga jual final dengan prefix Rp dan pemisah ribuan. */
export function PriceField({ helper }: { helper: string }) {
  const {
    control,
    formState: { errors },
  } = useFormContext<AdjustmentFormData>();
  const error = errors.price?.message;
  return (
    <div>
      <LabelText className="mb-2 block">Harga jual baru</LabelText>
      <Controller
        control={control}
        name="price"
        render={({ field }) => (
          <div
            className={cn(
              "flex h-9 items-center rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring",
              error && "border-destructive",
            )}
          >
            <span className="pl-3 text-sm text-[#6b6b6b]">Rp</span>
            <input
              inputMode="numeric"
              aria-label="Harga jual baru dalam rupiah"
              value={groupDigits(field.value)}
              onChange={(event) =>
                field.onChange(
                  event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""),
                )
              }
              onBlur={field.onBlur}
              placeholder="0"
              className="h-full w-full bg-transparent px-2 text-sm outline-none"
            />
          </div>
        )}
      />
      {error ? (
        <ErrorText className="mt-2">{error}</ErrorText>
      ) : (
        <HelperText className="mt-2">{helper}</HelperText>
      )}
    </div>
  );
}

/** Selisih harga final terhadap harga sekarang, berwarna sesuai arah. */
export function PriceChange({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "font-medium",
        value > 0 ? "text-[#1E9E55]" : value < 0 ? "text-[#D64545]" : "text-[#6b6b6b]",
      )}
    >
      {value === 0 ? "tidak berubah" : formatSigned(value)}
    </span>
  );
}

type DialogProps = {
  unitId: string | undefined;
  onOpenChange: (open: boolean) => void;
};

/** Kotak bagian di dalam modal, dengan ruang yang lebih lega dari SectionCard. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E4E4E7] p-4 sm:p-5">
      <h4 className="mb-4 text-sm font-semibold text-[#1f1f1f]">{title}</h4>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-[#6b6b6b]">{label}</span>
      <span className={cn("text-[#1f1f1f]", strong && "text-sm font-semibold")}>
        {value}
      </span>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-[#6b6b6b]">{label}</dt>
      <dd className="min-w-0 text-[#1f1f1f]">{children}</dd>
    </>
  );
}

function HistoryItem({ item, number }: { item: PriceAdjustment; number?: number }) {
  const change = item.priceAfter - item.priceBefore;
  const changeColor = change > 0 ? "text-[#1E9E55]" : change < 0 ? "text-[#D64545]" : "text-[#1f1f1f]";
  const content = (
    <div className="min-w-0 flex-1 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[#1f1f1f]">
          {formatPrice(item.priceBefore)} → {formatPrice(item.priceAfter)}
        </span>
        <AdjustmentStatusBadge status={item.status} />
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-y-1.5 [&>dd]:mb-2 sm:[&>dd]:mb-0">
        <Detail label="Perubahan harga">
          <span className={cn("font-medium", changeColor)}>
            {change === 0 ? "Tidak berubah" : `${formatSigned(change)} (${change > 0 ? "naik" : "turun"})`}
          </span>
        </Detail>
        <Detail label="Total penyesuaian unit">
          {formatSigned(item.amount)}
          <span className="ml-1 text-xs text-[#6b6b6b]">terhadap harga dasar dan kenaikan tipe</span>
        </Detail>
        <Detail label="Tanggal efektif">{formatDay(item.effectiveDate)}</Detail>
        <Detail label="Alasan penyesuaian">{item.reason}</Detail>
        <Detail label="Diajukan oleh">{item.requestedBy?.name ?? "-"}</Detail>
        {item.approvedBy && (
          <Detail label={item.status === "REJECTED" ? "Ditolak oleh" : "Disetujui oleh"}>
            {item.approvedBy.name ?? "-"}
          </Detail>
        )}
        {item.reviewNote && (
          <Detail label="Catatan approver">
            <span className="text-[#D64545]">{item.reviewNote}</span>
          </Detail>
        )}
      </dl>
    </div>
  );

  return (
    <div className="flex gap-3 rounded-lg border border-[#E4E4E7] p-3 text-sm sm:gap-4 sm:p-4">
      {number !== undefined && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E5F1FA] text-xs font-semibold text-[#1980C0]">
          {number}
        </span>
      )}
      {content}
    </div>
  );
}

/** Dialog yang memuat data unit lalu merender isi sesuai kebutuhan. */
function UnitDialog({
  unitId,
  onOpenChange,
  title,
  size = "md",
  children,
}: DialogProps & {
  title: string;
  size?: "md" | "lg" | "xl";
  children: (detail: UnitPriceDetail) => ReactNode;
}) {
  const detail = useUnitPrice(unitId);
  const d = detail.data;
  return (
    <Dialog open={!!unitId} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] gap-5 overflow-y-auto p-4 sm:p-6",
          { md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-4xl" }[size],
        )}
      >
        <DialogHeader>
          <DialogTitle>{d ? `${title} ${d.code}` : title}</DialogTitle>
          <DialogDescription>
            {d
              ? `${d.product.name} · ${d.variant.name} · ${d.location.name}`
              : "Memuat data unit"}
          </DialogDescription>
        </DialogHeader>
        {detail.isLoading ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : detail.isError || !d ? (
          <p className="text-xs text-[#D64545]">
            {errorMessage(detail.error, "Gagal memuat data unit.")}
          </p>
        ) : (
          <div className="space-y-4">{children(d)}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentForm({
  unitId,
  basis,
  minPrice,
  onSaved,
}: {
  unitId: string;
  basis: number;
  minPrice: number | null;
  onSaved: () => void;
}) {
  const create = useCreateAdjustment(unitId);
  const form = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      price: "",
      reason: "",
      effectiveDate: todayJakarta(),
    },
  });
  const [digits, effectiveDate] = useWatch({
    control: form.control,
    name: ["price", "effectiveDate"],
  });
  const filled = digits !== "";
  const preview = Number(digits || 0);
  const change = filled ? preview - basis : 0;
  const belowMin = filled && minPrice !== null && preview < minPrice;

  return (
    <FormProvider {...form}>
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit(async (data) => {
          try {
            await create.mutateAsync({
              price: Number(data.price),
              reason: data.reason,
              effectiveDate: data.effectiveDate,
            });
            onSaved();
          } catch {
            // Pesan error ditampilkan oleh mutation.
          }
        })}
      >
        <PriceField helper={`Harga jual saat ini ${formatPrice(basis)}. Isi harga final yang diinginkan.`} />
        <div>
          <FormInput
            name="effectiveDate"
            type="date"
            label="Tanggal efektif"
            labelClassname="mb-2 block"
            min={todayJakarta()}
          />
          {effectiveDate && (
            <HelperText className="mt-2">
              Berlaku mulai {formatDay(effectiveDate)}
            </HelperText>
          )}
        </div>
        <FormTextarea
          name="reason"
          label="Alasan perubahan"
          labelClassname="mb-2 block"
          placeholder="Contoh: posisi hook"
          rows={4}
        />
        <div
          className={cn(
            "rounded-lg px-4 py-3 text-sm",
            belowMin
              ? "bg-[#FFF1E0] text-[#D9822B]"
              : "bg-[#E5F1FA] text-[#1980C0]",
          )}
        >
          {filled ? (
            <>
              Harga jual {formatPrice(basis)} →{" "}
              <span className="font-semibold">{formatPrice(preview)}</span>{" "}
              (<PriceChange value={change} />)
            </>
          ) : (
            "Isi harga jual baru untuk melihat perubahannya."
          )}
          {belowMin &&
            ` · di bawah harga minimum ${formatPrice(minPrice)}${PRICE_APPROVAL_ENABLED ? ", perlu approval" : ""}`}
        </div>
        <Button
          type="submit"
          disabled={create.isPending || (filled && change === 0)}
          className="h-10 w-full rounded-lg bg-[#1980C0] text-white hover:bg-[#166ea6]"
        >
          {create.isPending
            ? "Menyimpan..."
            : PRICE_APPROVAL_ENABLED && belowMin
              ? "Ajukan approval"
              : "Simpan penyesuaian"}
        </Button>
      </form>
    </FormProvider>
  );
}

/** Rincian harga dan form penyesuaian (CRM-52). */
export function AdjustPriceDialog({ unitId, onOpenChange }: DialogProps) {
  return (
    <UnitDialog
      unitId={unitId}
      onOpenChange={onOpenChange}
      title="Atur harga unit"
      size="xl"
    >
      {(d) => {
        const blocked =
          d.status === "SOLD"
            ? "Unit sudah terjual, harga tidak bisa diubah."
            : PRICE_APPROVAL_ENABLED && d.pendingAdjustment
              ? "Unit ini masih punya pengajuan yang menunggu approval."
              : undefined;
        return (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <Section title={`Rincian harga per ${formatDay(d.date)}`}>
                <div className="mb-3">
                  <UnitStatusBadge status={d.status} />
                </div>
                <Row label="Harga dasar" value={formatPrice(d.basePrice)} />
                {d.priceLogs.map((log) => (
                  <Row
                    key={log.id}
                    label={log.reason}
                    value={formatSigned(log.adjustmentPrice)}
                  />
                ))}
                <Row
                  label={
                    d.activeAdjustment
                      ? `Penyesuaian unit: ${d.activeAdjustment.reason}`
                      : "Penyesuaian unit"
                  }
                  value={formatSigned(d.adjustment)}
                />
                <hr className="my-2 border-[#EDEDED]" />
                <Row
                  label="Harga jual"
                  value={formatPrice(d.sellingPrice)}
                  strong
                />
                <Row
                  label="Harga minimum"
                  value={
                    d.variant.minPrice === null
                      ? "Tidak ada"
                      : formatPrice(d.variant.minPrice)
                  }
                />
              </Section>

              {PRICE_APPROVAL_ENABLED && d.pendingAdjustment && (
                <Section title="Menunggu approval">
                  <HistoryItem item={d.pendingAdjustment} />
                </Section>
              )}
            </div>

            <Section title="Sesuaikan harga">
              {blocked ? (
                <p className="text-xs text-[#6b6b6b]">{blocked}</p>
              ) : (
                <AdjustmentForm
                  key={d.unitId}
                  unitId={d.unitId}
                  basis={d.sellingPrice}
                  minPrice={d.variant.minPrice}
                  onSaved={() => onOpenChange(false)}
                />
              )}
            </Section>
          </div>
        );
      }}
    </UnitDialog>
  );
}

/** Nomor halaman yang ditampilkan: awal, akhir, dan sekitar halaman aktif. */
function pageItems(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const items: (number | "gap")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(totalPages - 1, page + 1);
  if (from > 2) items.push("gap");
  for (let p = from; p <= to; p += 1) items.push(p);
  if (to < totalPages - 1) items.push("gap");
  items.push(totalPages);
  return items;
}

/** Riwayat perubahan harga satu unit (CRM-53). */
export function PriceHistoryDialog({ unitId, onOpenChange }: DialogProps) {
  const [page, setPage] = useState(1);
  const history = useUnitPriceHistory(unitId, page);
  const totalPages = history.data?.meta.totalPages ?? 1;

  return (
    <UnitDialog
      unitId={unitId}
      onOpenChange={(open) => {
        if (!open) setPage(1);
        onOpenChange(open);
      }}
      title="Riwayat harga"
      size="lg"
    >
      {(d) => (
        <>
          <div className="grid grid-cols-1 gap-3 rounded-xl bg-[#E5F1FA] p-4 sm:grid-cols-3 sm:gap-4 sm:p-5">
            <div>
              <p className="text-xs text-[#6b6b6b]">Harga dasar</p>
              <p className="mt-1 text-sm font-medium text-[#1f1f1f]">{formatPrice(d.basePrice)}</p>
            </div>
            <div>
              <p className="text-xs text-[#6b6b6b]">Harga jual saat ini</p>
              <p className="mt-1 text-base font-semibold text-[#1980C0]">{formatPrice(d.sellingPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-[#6b6b6b]">Jumlah perubahan</p>
              <p className="mt-1 text-sm font-medium text-[#1f1f1f]">{history.data?.meta.total ?? 0} perubahan</p>
            </div>
          </div>

          {history.isLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : history.isError ? (
            <p className="text-sm text-[#D64545]">{errorMessage(history.error, "Gagal memuat riwayat.")}</p>
          ) : !history.data?.data.length ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#E4E4E7] py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-[#F3F3F3] text-[#6b6b6b]">
                <History className="size-5" />
              </span>
              <p className="text-sm text-[#6b6b6b]">Belum ada perubahan harga untuk unit ini.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <ol className="space-y-3">
                {history.data.data.map((item, index) => (
                  <li key={item.id}>
                    {/* Nomor urut dari perubahan pertama; yang terbaru mendapat nomor terbesar. */}
                    <HistoryItem
                      item={item}
                      number={history.data.meta.total - (page - 1) * history.data.meta.limit - index}
                    />
                  </li>
                ))}
              </ol>
              {totalPages > 1 && (
                <div className="flex flex-col gap-3 border-t border-[#EDEDED] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#6b6b6b]">
                    Menampilkan{" "}
                    <span className="font-medium text-[#1f1f1f]">
                      {(page - 1) * history.data.meta.limit + 1}–
                      {Math.min(page * history.data.meta.limit, history.data.meta.total)}
                    </span>{" "}
                    dari <span className="font-medium text-[#1f1f1f]">{history.data.meta.total}</span> perubahan
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg px-2.5 text-xs"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="size-3.5" />
                      Sebelumnya
                    </Button>
                    {pageItems(page, totalPages).map((item, index) =>
                      item === "gap" ? (
                        <span key={`gap-${index}`} className="px-1 text-xs text-[#6b6b6b]">
                          …
                        </span>
                      ) : (
                        <Button
                          key={item}
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Halaman ${item}`}
                          aria-current={item === page ? "page" : undefined}
                          onClick={() => setPage(item)}
                          className={cn(
                            "size-8",
                            item === page &&
                              "border-[#1980C0] bg-[#1980C0] text-white hover:bg-[#166ea6] hover:text-white",
                          )}
                        >
                          {item}
                        </Button>
                      ),
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg px-2.5 text-xs"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Berikutnya
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </UnitDialog>
  );
}
