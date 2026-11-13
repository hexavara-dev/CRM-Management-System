"use client";

import { useState, type ReactNode } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/projects/section-card";
import { errorMessage } from "@/hooks/use-projects";
import {
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

const todayJakarta = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

const adjustmentSchema = z.object({
  amount: z.coerce.number({ invalid_type_error: "Nominal harus angka" }).int("Nominal harus bilangan bulat"),
  reason: z.string().trim().min(3, "Alasan minimal 3 karakter").max(500, "Alasan maksimal 500 karakter"),
  effectiveDate: z
    .string()
    .min(1, "Tanggal efektif wajib diisi")
    .refine((value) => value >= todayJakarta(), "Tanggal efektif tidak boleh sebelum hari ini"),
});
type AdjustmentFormData = z.infer<typeof adjustmentSchema>;

type DialogProps = { unitId: string | undefined; onOpenChange: (open: boolean) => void };

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-xs">
      <span className="text-[#6b6b6b]">{label}</span>
      <span className={cn("text-[#1f1f1f]", strong && "text-sm font-semibold")}>{value}</span>
    </div>
  );
}

function HistoryItem({ item }: { item: PriceAdjustment }) {
  return (
    <div className="space-y-1 rounded-lg border border-[#E4E4E7] p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[#1f1f1f]">
          {formatPrice(item.priceBefore)} → {formatPrice(item.priceAfter)}
        </span>
        <AdjustmentStatusBadge status={item.status} />
      </div>
      <p className="text-[#6b6b6b]">
        Efektif {item.effectiveDate.slice(0, 10)} · {formatSigned(item.amount)}
      </p>
      <p className="text-[#1f1f1f]">{item.reason}</p>
      <p className="text-[#6b6b6b]">
        Diajukan {item.requestedBy?.name ?? "-"}
        {item.approvedBy && ` · ${item.status === "REJECTED" ? "Ditolak" : "Disetujui"} ${item.approvedBy.name ?? "-"}`}
      </p>
      {item.reviewNote && <p className="text-[#D64545]">Catatan: {item.reviewNote}</p>}
    </div>
  );
}

/** Dialog yang memuat data unit lalu merender isi sesuai kebutuhan. */
function UnitDialog({
  unitId,
  onOpenChange,
  title,
  children,
}: DialogProps & { title: string; children: (detail: UnitPriceDetail) => ReactNode }) {
  const detail = useUnitPrice(unitId);
  const d = detail.data;
  return (
    <Dialog open={!!unitId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{d ? `${title} ${d.code}` : title}</DialogTitle>
          <DialogDescription>
            {d ? `${d.product.name} · ${d.variant.name} · ${d.location.name}` : "Memuat data unit"}
          </DialogDescription>
        </DialogHeader>
        {detail.isLoading ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : detail.isError || !d ? (
          <p className="text-xs text-[#D64545]">{errorMessage(detail.error, "Gagal memuat data unit.")}</p>
        ) : (
          <div className="space-y-3">{children(d)}</div>
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
    defaultValues: { amount: 0, reason: "", effectiveDate: todayJakarta() },
  });
  const amount = Number(useWatch({ control: form.control, name: "amount" }) || 0);
  const preview = basis + (Number.isFinite(amount) ? amount : 0);
  const belowMin = minPrice !== null && preview < minPrice;

  return (
    <FormProvider {...form}>
      <form
        className="space-y-3"
        onSubmit={form.handleSubmit(async (data) => {
          try {
            await create.mutateAsync(data);
            onSaved();
          } catch {
            // Pesan error ditampilkan oleh mutation.
          }
        })}
      >
        <FormInput
          name="amount"
          type="number"
          step="1"
          label="Nominal penyesuaian (Rp)"
          helperText="Isi negatif untuk menurunkan harga. Menggantikan penyesuaian sebelumnya."
        />
        <FormInput name="effectiveDate" type="date" label="Tanggal efektif" min={todayJakarta()} />
        <FormTextarea name="reason" label="Alasan perubahan" placeholder="Contoh: posisi hook" rows={3} />
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-xs",
            belowMin ? "bg-[#FFF1E0] text-[#D9822B]" : "bg-[#E5F1FA] text-[#1980C0]",
          )}
        >
          Harga jual menjadi <span className="font-semibold">{formatPrice(preview)}</span>
          {belowMin && ` · di bawah minimum ${formatPrice(minPrice)}, perlu approval`}
        </div>
        <Button
          type="submit"
          disabled={create.isPending}
          className="h-9 w-full rounded-lg bg-[#1980C0] text-white hover:bg-[#166ea6]"
        >
          {create.isPending ? "Menyimpan..." : belowMin ? "Ajukan approval" : "Simpan penyesuaian"}
        </Button>
      </form>
    </FormProvider>
  );
}

/** Rincian harga dan form penyesuaian (CRM-52). */
export function AdjustPriceDialog({ unitId, onOpenChange }: DialogProps) {
  return (
    <UnitDialog unitId={unitId} onOpenChange={onOpenChange} title="Atur harga unit">
      {(d) => {
        const blocked =
          d.status === "SOLD"
            ? "Unit sudah terjual, harga tidak bisa diubah."
            : d.pendingAdjustment
              ? "Unit ini masih punya pengajuan yang menunggu approval."
              : undefined;
        return (
          <>
            <SectionCard title={`Rincian harga per ${d.date}`}>
              <div className="mb-2">
                <UnitStatusBadge status={d.status} />
              </div>
              <Row label="Harga dasar" value={formatPrice(d.basePrice)} />
              {d.priceLogs.map((log) => (
                <Row key={log.id} label={log.reason} value={formatSigned(log.adjustmentPrice)} />
              ))}
              <Row
                label={d.activeAdjustment ? `Penyesuaian unit: ${d.activeAdjustment.reason}` : "Penyesuaian unit"}
                value={formatSigned(d.adjustment)}
              />
              <hr className="my-1 border-[#EDEDED]" />
              <Row label="Harga jual" value={formatPrice(d.sellingPrice)} strong />
              <Row
                label="Harga minimum"
                value={d.variant.minPrice === null ? "Tidak ada" : formatPrice(d.variant.minPrice)}
              />
            </SectionCard>

            {d.pendingAdjustment && (
              <SectionCard title="Menunggu approval">
                <HistoryItem item={d.pendingAdjustment} />
              </SectionCard>
            )}

            <SectionCard title="Sesuaikan harga">
              {blocked ? (
                <p className="text-xs text-[#6b6b6b]">{blocked}</p>
              ) : (
                <AdjustmentForm
                  key={d.unitId}
                  unitId={d.unitId}
                  basis={d.basePrice + d.priceLogTotal}
                  minPrice={d.variant.minPrice}
                  onSaved={() => onOpenChange(false)}
                />
              )}
            </SectionCard>
          </>
        );
      }}
    </UnitDialog>
  );
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
    >
      {(d) => (
        <>
          <Row label={`Harga jual saat ini (${d.date})`} value={formatPrice(d.sellingPrice)} strong />
          {history.isLoading ? (
            <Skeleton className="h-20 rounded-lg" />
          ) : history.isError ? (
            <p className="text-xs text-[#D64545]">{errorMessage(history.error, "Gagal memuat riwayat.")}</p>
          ) : !history.data?.data.length ? (
            <p className="rounded-lg border border-dashed border-[#E4E4E7] py-8 text-center text-xs text-[#6b6b6b]">
              Belum ada perubahan harga.
            </p>
          ) : (
            <div className="space-y-2">
              {history.data.data.map((item) => (
                <HistoryItem key={item.id} item={item} />
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-[#6b6b6b]">
                  <span>
                    Halaman {page} dari {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Riwayat sebelumnya"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Riwayat berikutnya"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
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
