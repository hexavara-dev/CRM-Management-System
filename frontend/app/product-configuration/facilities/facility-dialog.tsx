"use client";

import { useEffect } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { LabelText } from "@/components/ui/label-text";
import {
  useSaveProjectFacility,
  type ProjectFacility,
} from "@/hooks/use-project-facilities";
import { cn } from "@/lib/utils";
import { FACILITY_ICONS } from "@/components/projects/facility-icon";
import { Toggle } from "@/app/crm-configuration/leads-label/toggle";

const schema = z.object({
  name: z.string().trim().min(1, "Nama fasilitas wajib diisi").max(150, "Nama maksimal 150 karakter"),
  iconKey: z.string().min(1, "Pilih ikon"),
  description: z.string().max(255, "Deskripsi maksimal 255 karakter"),
  isActive: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export function FacilityDialog({
  open,
  facility,
  onOpenChange,
}: {
  open: boolean;
  /** Fasilitas yang diedit; kosong untuk fasilitas baru. */
  facility?: ProjectFacility;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveProjectFacility();
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: facility?.name ?? "",
      iconKey: facility?.iconKey ?? "house",
      description: facility?.description ?? "",
      isActive: facility?.isActive ?? true,
    });
  }, [open, facility, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto p-4 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle>{facility ? "Edit Fasilitas" : "Tambah Fasilitas"}</DialogTitle>
          <DialogDescription>Fasilitas yang dapat dipilih saat membuat atau mengedit project.</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(async (data) => {
              try {
                await save.mutateAsync({
                  id: facility?.id,
                  data: {
                    name: data.name,
                    iconKey: data.iconKey,
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
            <FormInput name="name" label="Nama fasilitas" labelClassname="mb-2 block" placeholder="Contoh: Gym" />

            <div>
              <LabelText className="mb-2 block">Ikon</LabelText>
              <Controller
                control={form.control}
                name="iconKey"
                render={({ field }) => (
                  <div
                    role="radiogroup"
                    aria-label="Pilih ikon"
                    className="grid max-h-56 grid-cols-6 gap-2 overflow-y-auto rounded-lg border border-[#E4E4E7] p-3 sm:grid-cols-10"
                  >
                    {Object.entries(FACILITY_ICONS).map(([key, { icon: Icon, label }]) => {
                      const active = field.value === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={label}
                          title={label}
                          onClick={() => field.onChange(key)}
                          className={cn(
                            "flex aspect-square items-center justify-center rounded-lg border transition-colors",
                            active
                              ? "border-[#1980C0] bg-[#E5F1FA] text-[#1980C0]"
                              : "border-[#E4E4E7] text-[#6b6b6b] hover:bg-muted",
                          )}
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
              placeholder="Contoh: Pusat kebugaran untuk penghuni."
              rows={3}
            />

            <div className="rounded-lg border border-[#E4E4E7] p-3">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Toggle
                    label="Aktif"
                    description="Fasilitas nonaktif tidak muncul saat membuat project baru."
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
