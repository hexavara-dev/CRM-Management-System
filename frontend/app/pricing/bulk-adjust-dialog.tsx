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
  formatSigned,
  useBulkAdjustment,
  type UnitPriceRow,
} from "@/hooks/use-unit-prices";
import { cn } from "@/lib/utils";
import {
  AmountField,
  Section,
  adjustmentSchema,
  todayJakarta,
  type AdjustmentFormData,
} from "./unit-price-dialogs";

/** Ubah harga jual banyak unit dari satu project sekaligus. */
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
    defaultValues: { direction: "increase", amount: "", reason: "", effectiveDate: todayJakarta() },
  });
  const [direction, digits, effectiveDate] = useWatch({
    control: form.control,
    name: ["direction", "amount", "effectiveDate"],
  });
  const amount = (direction === "decrease" ? -1 : 1) * Number(digits || 0);
  const preview = units.map((unit) => {
    const after = unit.sellingPrice + amount;
    return { unit, after, belowMin: unit.variant.minPrice !== null && after < unit.variant.minPrice };
  });
  const belowMinCount = preview.filter((p) => p.belowMin).length;
  const negativeCount = preview.filter((p) => p.after < 0).length;

  return (
    <FormProvider {...form}>
      <form
        className="grid gap-5 md:grid-cols-2"
        onSubmit={form.handleSubmit(async (data) => {
          try {
            await bulk.mutateAsync({
              unitIds: units.map((u) => u.unitId),
              amount: (data.direction === "decrease" ? -1 : 1) * Number(data.amount),
              reason: data.reason,
              effectiveDate: data.effectiveDate,
            });
            onSaved();
          } catch {
            // Pesan error ditampilkan oleh mutation.
          }
        })}
      >
        <Section title="Sesuaikan harga">
          <div className="space-y-5">
            <AmountField />
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
              placeholder="Contoh: kenaikan harga kuartal 4"
              rows={4}
            />
            <Button
              type="submit"
              disabled={bulk.isPending || negativeCount > 0}
              className="h-10 w-full rounded-lg bg-[#1980C0] text-white hover:bg-[#166ea6]"
            >
              {bulk.isPending ? "Menyimpan..." : `Simpan untuk ${units.length} unit`}
            </Button>
          </div>
        </Section>

        <Section title="Pratinjau harga">
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6b6b6b]">
            <span>
              Perubahan per unit:{" "}
              <span
                className={cn(
                  "font-medium",
                  amount > 0 ? "text-[#1E9E55]" : amount < 0 ? "text-[#D64545]" : "text-[#1f1f1f]",
                )}
              >
                {amount === 0 ? "-" : formatSigned(amount)}
              </span>
            </span>
            <span>
              Total perubahan:{" "}
              <span className="font-medium text-[#1f1f1f]">
                {amount === 0 ? "-" : formatSigned(amount * units.length)}
              </span>
            </span>
          </div>
          {(belowMinCount > 0 || negativeCount > 0) && (
            <div className="mb-3 rounded-lg bg-[#FFF1E0] px-3 py-2 text-xs text-[#D9822B]">
              {negativeCount > 0
                ? `${negativeCount} unit harganya menjadi di bawah Rp 0.`
                : `${belowMinCount} unit di bawah harga minimum${PRICE_APPROVAL_ENABLED ? ", perlu approval" : ""}.`}
            </div>
          )}
          <ul className="max-h-80 divide-y divide-[#EDEDED] overflow-y-auto rounded-lg border border-[#E4E4E7]">
            {preview.map(({ unit, after, belowMin }) => (
              <li key={unit.unitId} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-[#1f1f1f]">{unit.code}</p>
                  <p className="truncate text-xs text-[#6b6b6b]">
                    {unit.variant.name} · {unit.location.name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-[#6b6b6b]">{formatPrice(unit.sellingPrice)}</p>
                  <p className={cn("font-semibold", belowMin || after < 0 ? "text-[#D9822B]" : "text-[#1f1f1f]")}>
                    {formatPrice(after)}
                  </p>
                  {belowMin && unit.variant.minPrice !== null && (
                    <p className="text-[10px] text-[#D9822B]">min {formatPrice(unit.variant.minPrice)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <HelperText className="mt-2">Dihitung dari harga jual hari ini.</HelperText>
        </Section>
      </form>
    </FormProvider>
  );
}
