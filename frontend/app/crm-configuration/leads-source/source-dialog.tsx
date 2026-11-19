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
import { LabelText } from "@/components/ui/label-text";
import { useSaveLeadSource, type LeadSource } from "@/hooks/use-lead-sources";
import { cn } from "@/lib/utils";
import { Toggle } from "../leads-label/toggle";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_COLOR = "#3B82F6";

const schema = z.object({
  name: z.string().trim().min(1, "Nama leads source wajib diisi").max(255, "Nama maksimal 255 karakter"),
  description: z.string().max(500, "Deskripsi maksimal 500 karakter"),
  color: z.string().regex(HEX, "Warna harus format hex, mis. #3B82F6"),
  isActive: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export function SourceDialog({
  open,
  source,
  onOpenChange,
}: {
  open: boolean;
  /** Source yang diedit; kosong untuk source baru. */
  source?: LeadSource;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveLeadSource();
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: source?.name ?? "",
      description: source?.description ?? "",
      color: source?.color ?? DEFAULT_COLOR,
      isActive: source?.isActive ?? true,
    });
  }, [open, source, form]);

  const color = useWatch({ control: form.control, name: "color" });
  const validColor = HEX.test(color ?? "") ? color : DEFAULT_COLOR;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>{source ? "Edit Leads Source" : "Tambah Leads Source"}</DialogTitle>
          <DialogDescription>Sumber dari mana prospek diperoleh.</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(async (data) => {
              try {
                await save.mutateAsync({
                  id: source?.id,
                  data: {
                    name: data.name,
                    description: data.description.trim() || null,
                    color: data.color.toUpperCase(),
                    isActive: data.isActive,
                  },
                });
                onOpenChange(false);
              } catch {
                // Pesan error ditampilkan oleh mutation.
              }
            })}
          >
            <FormInput name="name" label="Nama leads source" labelClassname="mb-2 block" placeholder="Contoh: Website" />
            <FormTextarea
              name="description"
              label="Deskripsi"
              labelClassname="mb-2 block"
              placeholder="Contoh: Leads dari form di website resmi perusahaan."
              rows={3}
            />
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
                        placeholder="#3B82F6"
                        className={cn(
                          "h-9 w-32 rounded-md border border-input bg-background px-3 font-mono text-sm uppercase shadow-sm outline-none focus:ring-1 focus:ring-ring",
                          fieldState.error && "border-destructive",
                        )}
                      />
                    </div>
                    {fieldState.error && <ErrorText className="mt-2">{fieldState.error.message}</ErrorText>}
                  </>
                )}
              />
            </div>
            <div className="rounded-lg border border-[#E4E4E7] p-3">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Toggle
                    label="Aktif"
                    description="Source nonaktif tetap tersimpan pada Lead yang sudah memakainya."
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
