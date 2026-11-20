"use client";

import { useEffect } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { useSaveLeadCampaign, type LeadCampaign } from "@/hooks/use-lead-campaigns";
import { Toggle } from "../leads-label/toggle";

const schema = z
  .object({
    name: z.string().trim().min(1, "Nama campaign wajib diisi").max(255, "Nama maksimal 255 karakter"),
    description: z.string().max(500, "Deskripsi maksimal 500 karakter"),
    startDate: z.string(),
    endDate: z.string(),
    isActive: z.boolean(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    path: ["endDate"],
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
  });
type FormData = z.infer<typeof schema>;

export function CampaignDialog({
  open,
  sourceId,
  sourceName,
  campaign,
  onOpenChange,
}: {
  open: boolean;
  sourceId: string;
  sourceName: string;
  /** Campaign yang diedit; kosong untuk campaign baru. */
  campaign?: LeadCampaign;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveLeadCampaign();
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: campaign?.name ?? "",
      description: campaign?.description ?? "",
      startDate: campaign?.startDate ?? "",
      endDate: campaign?.endDate ?? "",
      isActive: campaign?.isActive ?? true,
    });
  }, [open, campaign, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "Tambah Campaign"}</DialogTitle>
          <DialogDescription>Campaign pada sumber &quot;{sourceName}&quot;.</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(async (data) => {
              try {
                await save.mutateAsync({
                  id: campaign?.id,
                  sourceId,
                  data: {
                    name: data.name,
                    description: data.description.trim() || null,
                    startDate: data.startDate || null,
                    endDate: data.endDate || null,
                    isActive: data.isActive,
                  },
                });
                onOpenChange(false);
              } catch {
                // Pesan error ditampilkan oleh mutation.
              }
            })}
          >
            <FormInput name="name" label="Nama campaign" labelClassname="mb-2 block" placeholder="Contoh: Promo Oktober" />
            <FormTextarea
              name="description"
              label="Deskripsi"
              labelClassname="mb-2 block"
              placeholder="Contoh: Iklan Meta Ads untuk launching cluster baru."
              rows={3}
            />
            <div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput name="startDate" type="date" label="Tanggal mulai" labelClassname="mb-2 block" />
                <FormInput name="endDate" type="date" label="Tanggal selesai" labelClassname="mb-2 block" />
              </div>
              <p className="mt-2 text-xs text-[#6b6b6b]">
                Opsional. Kosongkan bila jadwal belum pasti; campaign di luar periode tidak muncul di form Add Lead.
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E4E7] p-3">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Toggle
                    label="Aktif"
                    description="Campaign nonaktif tidak dapat dipilih pada Lead baru."
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
