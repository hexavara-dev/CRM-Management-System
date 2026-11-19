"use client";

import { useEffect } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorText } from "@/components/ui/error-text";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { HelperText } from "@/components/ui/helper-text";
import { LabelText } from "@/components/ui/label-text";
import { useSaveLeadLabel, type LeadLabel, type LeadLabelType } from "@/hooks/use-lead-labels";
import { cn } from "@/lib/utils";
import { LEAD_LABEL_ICONS, LabelBadge } from "./label-icons";
import { Toggle } from "./toggle";

const schema = z.object({
  name: z.string().trim().min(1, "Nama label wajib diisi").max(100, "Nama label maksimal 100 karakter"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Warna harus format hex, mis. #EF4444"),
  icon: z.string().min(1, "Pilih ikon"),
  description: z.string().max(500, "Deskripsi maksimal 500 karakter"),
  isActive: z.boolean(),
  isRequired: z.boolean(),
});
type FormData = z.infer<typeof schema>;

const TYPE_LABEL: Record<LeadLabelType, string> = { TEMPERATURE: "Temperature", TAG: "Tag" };

export function LabelDialog({
  open,
  type,
  label,
  onOpenChange,
}: {
  open: boolean;
  type: LeadLabelType;
  /** Label yang diedit; kosong untuk label baru. */
  label?: LeadLabel;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveLeadLabel();
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: label?.name ?? "",
      color: label?.color ?? "#3B82F6",
      icon: label?.icon ?? (type === "TEMPERATURE" ? "flame" : "tag"),
      description: label?.description ?? "",
      isActive: label?.isActive ?? true,
      isRequired: label?.isRequired ?? false,
    });
  }, [open, label, type, form]);

  const [name, color] = useWatch({ control: form.control, name: ["name", "color"] });
  const validColor = /^#[0-9A-Fa-f]{6}$/.test(color ?? "") ? color : "#3B82F6";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto p-4 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle>{label ? "Edit Label" : "Add Label"}</DialogTitle>
          <DialogDescription>{TYPE_LABEL[type]} untuk mengklasifikasikan Lead.</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(async (data) => {
              try {
                await save.mutateAsync({
                  id: label?.id,
                  type,
                  data: {
                    name: data.name,
                    color: data.color.toUpperCase(),
                    icon: data.icon,
                    description: data.description.trim() || null,
                    isActive: data.isActive,
                    ...(type === "TEMPERATURE" ? { isRequired: data.isRequired } : {}),
                  },
                });
                onOpenChange(false);
              } catch {
                // Pesan error ditampilkan oleh mutation.
              }
            })}
          >
            <FormInput name="name" label="Nama label" labelClassname="mb-2 block" placeholder="Contoh: Hot" />

            <div>
              <LabelText className="mb-2 block">Warna</LabelText>
              <Controller
                control={form.control}
                name="color"
                render={({ field, fieldState }) => (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Pilih warna"
                        value={validColor}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                      />
                      <input
                        aria-label="Kode warna hex"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value.trim())}
                        onBlur={field.onBlur}
                        maxLength={7}
                        placeholder="#EF4444"
                        className={cn(
                          "h-9 w-32 rounded-md border border-input bg-background px-3 font-mono text-sm uppercase shadow-sm outline-none focus:ring-1 focus:ring-ring",
                          fieldState.error && "border-destructive",
                        )}
                      />
                      {name?.trim() && <LabelBadge name={name.trim()} color={validColor} />}
                    </div>
                    {fieldState.error && <ErrorText className="mt-2">{fieldState.error.message}</ErrorText>}
                  </>
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
                    className="grid max-h-64 grid-cols-6 gap-2 overflow-y-auto rounded-lg border border-[#E4E4E7] p-3 sm:grid-cols-10"
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
                                  active ? "border-transparent" : "border-[#E4E4E7] text-[#6b6b6b] hover:bg-muted",
                                )}
                                style={
                                  active
                                    ? { backgroundColor: `${validColor}1A`, color: validColor, borderColor: validColor }
                                    : undefined
                                }
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
              placeholder="Jelaskan kapan label ini dipakai"
              rows={3}
            />

            <div className="space-y-3 rounded-lg border border-[#E4E4E7] p-3">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Toggle label="Active" description="Label nonaktif tidak dapat dipilih pada Lead." checked={field.value} onChange={field.onChange} />
                )}
              />
              {type === "TEMPERATURE" && (
                <Controller
                  control={form.control}
                  name="isRequired"
                  render={({ field }) => (
                    <Toggle
                      label="Wajib Diisi"
                      description="Wajib mengisi alasan saat Temperature ini dipilih pada Lead."
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              )}
            </div>
            <HelperText>Tipe label tidak dapat diubah setelah dibuat.</HelperText>

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
