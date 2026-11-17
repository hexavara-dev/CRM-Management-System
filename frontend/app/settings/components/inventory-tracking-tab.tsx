"use client";

import { useState } from "react";
import { Boxes, Check, Layers, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useInventoryTracking,
  useUpdateInventoryTracking,
  type TrackingMode,
} from "@/hooks/use-inventory-tracking";
import { errorMessage } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";

const OPTIONS: { value: TrackingMode; title: string; description: string; example: string; icon: LucideIcon }[] = [
  {
    value: "QUANTITY",
    title: "Quantity-Based Only",
    description: "Stok dicatat sebagai jumlah per produk, tanpa nomor unit.",
    example: "Contoh: material bangunan, aksesori.",
    icon: Boxes,
  },
  {
    value: "UNIT",
    title: "Unit-Based Only",
    description: "Setiap unit dicatat satu per satu dengan kode, status, dan harga sendiri.",
    example: "Contoh: rumah A-01, apartemen 12B.",
    icon: Package,
  },
  {
    value: "BOTH",
    title: "Both Methods",
    description: "Pencatatan berbasis jumlah dan berbasis unit dapat dipakai bersamaan.",
    example: "Contoh: unit rumah dan material pendukungnya.",
    icon: Layers,
  },
];

export function InventoryTrackingTab() {
  const { user } = useAuth();
  const canWrite = user?.role === "owner";
  const tracking = useInventoryTracking();
  const update = useUpdateInventoryTracking();
  const [choice, setChoice] = useState<TrackingMode>();

  const current = tracking.data?.mode;
  const selected = choice ?? current;
  const unitCount = tracking.data?.unitCount ?? 0;
  const quantityBlocked = unitCount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Tracking Method</CardTitle>
        <p className="text-sm text-muted-foreground">
          Metode pencatatan inventory yang berlaku untuk seluruh sistem.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {tracking.isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : tracking.isError ? (
          <p className="text-sm text-destructive">
            {errorMessage(tracking.error, "Gagal memuat pengaturan inventory tracking.")}
          </p>
        ) : (
          <>
            {!canWrite && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Hanya owner yang dapat mengubah pengaturan ini.
              </p>
            )}
            <div role="radiogroup" aria-label="Metode inventory tracking" className="grid gap-3 md:grid-cols-3">
              {OPTIONS.map(({ value, title, description, example, icon: Icon }) => {
                const blocked = value === "QUANTITY" && quantityBlocked && current !== "QUANTITY";
                const disabled = !canWrite || blocked;
                const active = selected === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={disabled}
                    onClick={() => setChoice(value)}
                    className={cn(
                      "relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
                      active ? "border-[#1980C0] bg-[#E5F1FA]" : "border-[#E4E4E7] hover:bg-muted/50",
                      disabled && "cursor-not-allowed",
                      blocked && "opacity-60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "flex size-9 items-center justify-center rounded-lg",
                          active ? "bg-[#1980C0] text-white" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      {current === value && (
                        <span className="flex items-center gap-1 rounded-full bg-[#E6F6EC] px-2 py-0.5 text-[10px] font-medium text-[#1E9E55]">
                          <Check className="size-3" />
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-[#1f1f1f]">{title}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                    <p className="text-xs text-muted-foreground">{example}</p>
                    {blocked && (
                      <p className="text-xs text-[#D9822B]">
                        Tidak tersedia: masih ada {unitCount} unit di {tracking.data?.projectCount ?? 0} project.
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
            {canWrite && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                {choice && choice !== current && (
                  <Button type="button" variant="outline" onClick={() => setChoice(undefined)} disabled={update.isPending}>
                    Batal
                  </Button>
                )}
                <Button
                  type="button"
                  disabled={!selected || selected === current || update.isPending}
                  onClick={() =>
                    selected &&
                    update.mutate(selected, {
                      onSuccess: () => setChoice(undefined),
                    })
                  }
                  className="bg-[#1980C0] text-white hover:bg-[#166ea6]"
                >
                  {update.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
