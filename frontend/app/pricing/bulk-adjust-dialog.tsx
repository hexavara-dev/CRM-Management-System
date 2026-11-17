"use client";

import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { HelperText } from "@/components/ui/helper-text";
import {
  PRICE_APPROVAL_ENABLED,
  formatDay,
  formatPrice,
  useBulkAdjustment,
  type UnitPriceRow,
} from "@/hooks/use-unit-prices";
import { cn } from "@/lib/utils";
import {
  PriceChange,
  PriceField,
  Section,
  adjustmentSchema,
  todayJakarta,
  type AdjustmentFormData,
} from "./unit-price-dialogs";

/** Menetapkan harga jual final yang sama untuk banyak unit dari satu project. */
export function BulkAdjustDialog({
  units,
  open,
  onOpenChange,
  onSaved,
}: {
  units: UnitPriceRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const project = units[0]?.product.name;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto p-4 sm:max-w-4xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Ubah harga massal</DialogTitle>
          <DialogDescription>
            {units.length} unit{project ? ` · ${project}` : ""}
          </DialogDescription>
        </DialogHeader>
        {open && units.length > 0 && <BulkAdjustForm units={units} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function BulkAdjustForm({ units, onSaved }: { units: UnitPriceRow[]; onSaved: () => void }) {
  const bulk = useBulkAdjustment();
  const form = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { price: "", reason: "", effectiveDate: todayJakarta() },
  });
  const [digits, effectiveDate] = useWatch({ control: form.control, name: ["price", "effectiveDate"] });
  const filled = digits !== "";
  const price = Number(digits || 0);
  const preview = units.map((unit) => ({
    unit,
    change: filled ? price - unit.sellingPrice : 0,
    belowMin: filled && unit.variant.minPrice !== null && price < unit.variant.minPrice,
  }));
  const changedCount = preview.filter((p) => p.change !== 0).length;
  const belowMinCount = preview.filter((p) => p.belowMin).length;
  const totalChange = preview.reduce((sum, p) => sum + p.change, 0);

  return (
    <FormProvider {...form}>
      <form
        className="grid gap-5 md:grid-cols-2"
        onSubmit={form.handleSubmit(async (data) => {
          try {
            await bulk.mutateAsync({
              unitIds: units.map((u) => u.unitId),
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
        <Section title="Harga baru">
          <div className="space-y-5">
            <PriceField helper="Semua unit terpilih akan memakai harga jual ini." />
            <div>
              <FormInput
                name="effectiveDate"
                type="date"
                label="Tanggal efektif"
                labelClassname="mb-2 block"
                min={todayJakarta()}
              />
              {effectiveDate && <HelperText className="mt-2">Berlaku mulai {formatDay(effectiveDate)}</HelperText>}
            </div>
            <FormTextarea
              name="reason"
              label="Alasan perubahan"
              labelClassname="mb-2 block"
              placeholder="Contoh: harga baru kuartal 4"
              rows={4}
            />
            <Button
              type="submit"
              disabled={bulk.isPending || (filled && changedCount === 0)}
              className="h-10 w-full rounded-lg bg-[#1980C0] text-white hover:bg-[#166ea6]"
            >
              {bulk.isPending ? "Menyimpan..." : `Simpan untuk ${filled ? changedCount : units.length} unit`}
            </Button>
          </div>
        </Section>

        <Section title="Pratinjau harga">
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6b6b6b]">
            <span>
              Harga baru:{" "}
              <span className="font-medium text-[#1f1f1f]">{filled ? formatPrice(price) : "-"}</span>
            </span>
            <span>
              Total selisih: {filled ? <PriceChange value={totalChange} /> : "-"}
            </span>
          </div>
          {filled && (belowMinCount > 0 || changedCount < units.length) && (
            <div className="mb-3 space-y-1 rounded-lg bg-[#FFF1E0] px-3 py-2 text-xs text-[#D9822B]">
              {belowMinCount > 0 && (
                <p>
                  {belowMinCount} unit di bawah harga minimum{PRICE_APPROVAL_ENABLED ? ", perlu approval" : ""}.
                </p>
              )}
              {changedCount < units.length && (
                <p>{units.length - changedCount} unit sudah seharga ini dan akan dilewati.</p>
              )}
            </div>
          )}
          <ul className="max-h-80 divide-y divide-[#EDEDED] overflow-y-auto rounded-lg border border-[#E4E4E7]">
            {preview.map(({ unit, change, belowMin }) => (
              <li key={unit.unitId} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-[#1f1f1f]">{unit.code}</p>
                  <p className="truncate text-xs text-[#6b6b6b]">
                    {unit.variant.name} · {unit.location.name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-[#6b6b6b]">{formatPrice(unit.sellingPrice)}</p>
                  <p className={cn("font-semibold", belowMin ? "text-[#D9822B]" : "text-[#1f1f1f]")}>
                    {filled ? formatPrice(price) : "-"}
                  </p>
                  {filled && (
                    <p className="text-[10px]">
                      <PriceChange value={change} />
                    </p>
                  )}
                  {belowMin && unit.variant.minPrice !== null && (
                    <p className="text-[10px] text-[#D9822B]">min {formatPrice(unit.variant.minPrice)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </form>
    </FormProvider>
  );
}
