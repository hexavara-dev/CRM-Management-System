"use client";

import { useEffect } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { LabelText } from "@/components/ui/label-text";
import {
  ACTIVITY_COLORS,
  activityColor,
  useSaveLeadActivityType,
  type ActivityColor,
  type LeadActivityType,
} from "@/hooks/use-lead-activity-types";
import { cn } from "@/lib/utils";
import { LEAD_LABEL_ICONS } from "../leads-label/label-icons";
import { Toggle } from "../leads-label/toggle";

const COLOR_KEYS = Object.keys(ACTIVITY_COLORS) as [ActivityColor, ...ActivityColor[]];

const schema = z.object({
  name: z.string().trim().min(1, "Nama aktivitas wajib diisi").max(100, "Nama maksimal 100 karakter"),
  icon: z.string().min(1, "Pilih ikon"),
  color: z.enum(COLOR_KEYS),
  description: z.string().max(255, "Deskripsi maksimal 255 karakter"),
  isActive: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export function ActivityDialog({
  open,
  type,
  onOpenChange,
}: {
  open: boolean;
  /** Jenis yang diedit; kosong untuk jenis baru. */
  type?: LeadActivityType;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveLeadActivityType();
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: type?.name ?? "",
      icon: type?.icon ?? "phone",
      color: (type?.color as ActivityColor) ?? "blue",
      description: type?.description ?? "",
      isActive: type?.isActive ?? true,
    });
  }, [open, type, form]);

  const color = activityColor(useWatch({ control: form.control, name: "color" }) ?? "blue");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto p-4 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle>{type ? "Edit Aktivitas" : "Tambah Aktivitas"}</DialogTitle>
          <DialogDescription>Jenis aktivitas yang dapat dipilih Sales saat mencatat interaksi dengan Lead.</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(async (data) => {
              try {
                await save.mutateAsync({
                  id: type?.id,
                  data: {
                    name: data.name,
                    icon: data.icon,
                    color: data.color,
                    description: data.description.trim() || null,
                    isActive: data.isActive,
                  },
                });
                onOpenChange(false);
              } catch {
                // Pesan error ditampilkan oleh mutation.
              }
            })}
          >
            <FormInput name="name" label="Nama aktivitas" labelClassname="mb-2 block" placeholder="Contoh: Follow Up (FU)" />

            <div>
              <LabelText className="mb-2 block">Warna</LabelText>
              <Controller
                control={form.control}
                name="color"
                render={({ field }) => (
                  <div role="radiogroup" aria-label="Pilih warna" className="flex flex-wrap gap-2">
                    {COLOR_KEYS.map((key) => {
                      const preset = ACTIVITY_COLORS[key];
                      const active = field.value === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => field.onChange(key)}
                          className={cn(
                            "rounded-md border px-3 py-1 text-sm font-medium transition-shadow",
                            active ? "ring-2 ring-offset-1" : "border-transparent",
                          )}
                          style={{
                            backgroundColor: preset.bg,
                            color: preset.text,
                            borderColor: active ? preset.text : undefined,
                            ["--tw-ring-color" as string]: preset.text,
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            <div>
              <LabelText className="mb-2 block">Ikon</LabelText>
              <Controller
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <div
                    role="radiogroup"
                    aria-label="Pilih ikon"
                    className="grid max-h-56 grid-cols-6 gap-2 overflow-y-auto rounded-lg border border-[#E4E4E7] p-3 sm:grid-cols-10"
                  >
                    {Object.entries(LEAD_LABEL_ICONS).map(([key, Icon]) => {
                      const active = field.value === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={key}
                          title={key}
                          onClick={() => field.onChange(key)}
                          className={cn(
                            "flex aspect-square items-center justify-center rounded-lg border transition-colors",
                            active ? "" : "border-[#E4E4E7] text-[#6b6b6b] hover:bg-muted",
                          )}
                          style={active ? { backgroundColor: color.bg, color: color.text, borderColor: color.text } : undefined}
                        >
                          <Icon className="size-4" />
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            <FormTextarea
              name="description"
              label="Deskripsi"
              labelClassname="mb-2 block"
              placeholder="Contoh: Tindak lanjut komunikasi dengan prospek."
              rows={3}
            />

            <div className="rounded-lg border border-[#E4E4E7] p-3">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Toggle
                    label="Aktif"
                    description="Aktivitas nonaktif tidak muncul di Form Tambah Aktivitas."
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
                Batal
              </Button>
              <Button type="submit" disabled={save.isPending} className="bg-[#1980C0] text-white hover:bg-[#166ea6]">
                {save.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
