"use client";

import { useEffect } from "react";
import { Controller, FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, Eye, Info, Layers, Paperclip, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorText } from "@/components/ui/error-text";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { LabelText } from "@/components/ui/label-text";
import {
  EVIDENCE_FILE_TYPES,
  useSavePipelineStage,
  type EvidenceFileType,
  type PipelineEntity,
  type PipelineStage,
} from "@/hooks/use-pipeline-stages";
import { cn } from "@/lib/utils";
import { Switch } from "../leads-label/toggle";
import { StageChevron } from "./stage-chevron";
import { PIPELINE_COPY } from "./copy";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_COLOR = "#3B82F6";
const MAX_EVIDENCES = 20;

const schema = z.object({
  name: z.string().trim().min(1, "Nama tahapan wajib diisi").max(100, "Nama maksimal 100 karakter"),
  description: z.string().max(500, "Deskripsi maksimal 500 karakter"),
  color: z.string().regex(HEX, "Warna harus format hex, mis. #F59E0B"),
  probability: z
    .string()
    .regex(/^\d{1,3}$/, "Probabilitas wajib diisi")
    .refine((value) => Number(value) <= 100, "Probabilitas maksimal 100"),
  isDefaultStage: z.boolean(),
  isTerminalStage: z.boolean(),
  isWonStage: z.boolean(),
  evidences: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Nama evidence wajib diisi").max(150, "Maksimal 150 karakter"),
        fileTypes: z.array(z.enum(["PDF", "DOC", "IMAGE", "SHEET"])).min(1, "Pilih minimal satu tipe file"),
        isRequired: z.boolean(),
      }),
    )
    .max(MAX_EVIDENCES)
    .refine(
      (items) => new Set(items.map((e) => e.name.trim().toLowerCase())).size === items.length,
      "Nama evidence tidak boleh sama",
    ),
});
type FormData = z.infer<typeof schema>;

/** Toggle tahapan default/akhir; hanya satu per pipeline, tidak bisa dilepas langsung. */
function FlagToggle({
  label,
  description,
  checked,
  locked,
  lockedNote,
  replaces,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  /** Tahapan ini sudah memegang tanda; lepas dengan memilih tahapan lain. */
  locked: boolean;
  lockedNote: string;
  /** Nama tahapan yang saat ini memegang tanda (akan digantikan). */
  replaces?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#1f1f1f]">{label}</p>
        <p className="text-xs text-[#6b6b6b]">{description}</p>
        {locked ? (
          <p className="mt-1 text-xs text-[#6b6b6b]">{lockedNote}</p>
        ) : (
          checked &&
          replaces && <p className="mt-1 text-xs text-[#D9822B]">Menggantikan &quot;{replaces}&quot;.</p>
        )}
      </div>
      <Switch label={label} checked={checked} disabled={locked} onChange={onChange} />
    </div>
  );
}

const typeLabel = (types: EvidenceFileType[]) =>
  types.length === 0
    ? "Pilih tipe file"
    : EVIDENCE_FILE_TYPES.filter((t) => types.includes(t.value))
        .map((t) => t.label)
        .join(", ");

export function StageDialog({
  open,
  entity,
  stage,
  stages,
  onOpenChange,
}: {
  open: boolean;
  entity: PipelineEntity;
  /** Tahapan yang diedit; kosong untuk tahapan baru. */
  stage?: PipelineStage;
  /** Semua tahapan pipeline, untuk menampilkan tahapan default/akhir saat ini. */
  stages: PipelineStage[];
  onOpenChange: (open: boolean) => void;
}) {
  const copy = PIPELINE_COPY[entity];
  const currentDefault = stages.find((s) => s.isDefaultStage && s.id !== stage?.id);
  const currentTerminal = stages.find((s) => s.isTerminalStage && s.id !== stage?.id);
  const currentWon = stages.find((s) => s.isWonStage && s.id !== stage?.id);
  const isDeal = entity === "deal";
  const save = useSavePipelineStage(entity);
  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  const evidences = useFieldArray({ control: form.control, name: "evidences" });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: stage?.name ?? "",
      description: stage?.description ?? "",
      color: stage?.color ?? DEFAULT_COLOR,
      probability: String(stage?.probability ?? 0),
      isDefaultStage: stage?.isDefaultStage ?? false,
      isTerminalStage: stage?.isTerminalStage ?? false,
      isWonStage: stage?.isWonStage ?? false,
      evidences: stage?.evidences.map(({ name, fileTypes, isRequired }) => ({ name, fileTypes, isRequired })) ?? [],
    });
  }, [open, stage, form]);

  const [name, color, probability] = useWatch({ control: form.control, name: ["name", "color", "probability"] });
  const validColor = HEX.test(color ?? "") ? color : DEFAULT_COLOR;
  const evidenceError = form.formState.errors.evidences?.root?.message ?? form.formState.errors.evidences?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-5xl">
        <DialogHeader className="flex-row items-center gap-4 border-b border-[#EDEDED] p-4 text-left sm:p-6">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#E5F1FA] text-[#1980C0]">
            <Layers className="size-6" />
          </span>
          <div>
            <DialogTitle>{stage ? "Edit Tahapan Pipeline" : "Tambah Tahapan Pipeline"}</DialogTitle>
            <DialogDescription>
              {stage ? `Ubah pengaturan tahapan dalam alur proses ${copy.items}.` : `Tambah tahapan baru dalam alur proses ${copy.items}.`}
            </DialogDescription>
          </div>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(async (data) => {
              try {
                await save.mutateAsync({
                  id: stage?.id,
                  data: {
                    name: data.name,
                    description: data.description.trim() || null,
                    color: data.color.toUpperCase(),
                    probability: Number(data.probability),
                    isDefaultStage: data.isDefaultStage,
                    isTerminalStage: data.isTerminalStage,
                    ...(isDeal ? { isWonStage: data.isWonStage } : {}),
                    evidences: data.evidences.map((e) => ({ ...e, name: e.name.trim() })),
                  },
                });
                onOpenChange(false);
              } catch {
                // Pesan error ditampilkan oleh mutation.
              }
            })}
          >
            <div className="space-y-6 p-4 sm:p-6">
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 font-semibold text-[#1f1f1f]">
                  <Info className="size-5" />
                  Informasi Tahapan
                </h3>
                <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
                  <FormInput name="name" label="Nama Tahapan" labelClassname="mb-2 block" placeholder="Contoh: Follow Up" />
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
                              className={cn(
                                "h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm uppercase shadow-sm outline-none focus:ring-1 focus:ring-ring",
                                fieldState.error && "border-destructive",
                              )}
                            />
                          </div>
                          {fieldState.error && <ErrorText className="mt-2">{fieldState.error.message}</ErrorText>}
                        </>
                      )}
                    />
                  </div>
                  <FormTextarea
                    name="description"
                    label="Deskripsi"
                    labelClassname="mb-2 block"
                    placeholder="Contoh: Proses tindak lanjut dan pendalaman kebutuhan prospek."
                    rows={3}
                  />
                  <div>
                    <LabelText className="mb-2 block">Probabilitas</LabelText>
                    <Controller
                      control={form.control}
                      name="probability"
                      render={({ field, fieldState }) => (
                        <>
                          <div
                            className={cn(
                              "flex h-9 items-center rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring",
                              fieldState.error && "border-destructive",
                            )}
                          >
                            <input
                              inputMode="numeric"
                              aria-label="Probabilitas dalam persen"
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
                              onBlur={field.onBlur}
                              className="h-full w-full bg-transparent px-3 text-sm outline-none"
                            />
                            <span className="border-l border-input bg-muted px-3 py-2 text-sm text-[#6b6b6b]">%</span>
                          </div>
                          {fieldState.error ? (
                            <ErrorText className="mt-2">{fieldState.error.message}</ErrorText>
                          ) : (
                            <p className="mt-2 text-xs text-[#6b6b6b]">{copy.probabilityHint}</p>
                          )}
                        </>
                      )}
                    />
                  </div>
                </div>

                <div className={cn("grid gap-3 rounded-lg border border-[#E4E4E7] p-3 md:grid-cols-2", isDeal && "lg:grid-cols-3")}>
                  <Controller
                    control={form.control}
                    name="isDefaultStage"
                    render={({ field }) => (
                      <FlagToggle
                        label="Jadikan tahapan default"
                        description={copy.defaultHint}
                        checked={field.value}
                        locked={!!stage?.isDefaultStage}
                        lockedNote="Untuk memindahkan, jadikan tahapan lain sebagai default."
                        replaces={currentDefault?.name}
                        onChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue("isTerminalStage", false);
                            form.setValue("isWonStage", false);
                          }
                        }}
                      />
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="isTerminalStage"
                    render={({ field }) => (
                      <FlagToggle
                        label="Jadikan tahapan akhir"
                        description={copy.terminalHint}
                        checked={field.value}
                        locked={!!stage?.isTerminalStage}
                        lockedNote="Untuk memindahkan, jadikan tahapan lain sebagai tahapan akhir."
                        replaces={currentTerminal?.name}
                        onChange={(checked) => {
                          field.onChange(checked);
                          if (checked) form.setValue("isDefaultStage", false);
                        }}
                      />
                    )}
                  />
                  {isDeal && (
                    <Controller
                      control={form.control}
                      name="isWonStage"
                      render={({ field }) => (
                        <FlagToggle
                          label="Hitung sebagai Won Deals"
                          description="Deal di tahapan ini dihitung sebagai Won Deals pada dashboard. Hanya satu tahapan."
                          checked={field.value}
                          locked={false}
                          lockedNote=""
                          replaces={currentWon?.name}
                          onChange={(checked) => {
                            field.onChange(checked);
                            if (checked) form.setValue("isDefaultStage", false);
                          }}
                        />
                      )}
                    />
                  )}
                </div>
              </section>

              <hr className="border-[#EDEDED]" />

              <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                <section className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold text-[#1f1f1f]">
                        <Paperclip className="size-5" />
                        Evidence & Persyaratan
                      </h3>
                      <p className="text-sm text-[#475467]">
                        Dokumen, file, atau bukti yang wajib diunggah ketika {copy.item} dipindahkan ke tahapan ini.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={evidences.fields.length >= MAX_EVIDENCES}
                      onClick={() => evidences.append({ name: "", fileTypes: ["PDF"], isRequired: true })}
                      className="text-[#1980C0] hover:text-[#1980C0]"
                    >
                      <Plus className="size-4" />
                      Tambah Evidence
                    </Button>
                  </div>

                  {evidences.fields.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#E4E4E7] py-6 text-center text-sm text-[#6b6b6b]">
                      Belum ada evidence. Tahapan ini dapat dimasuki tanpa unggahan.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-[#E4E4E7]">
                      <div className="grid min-w-[560px] grid-cols-[1fr_200px_64px_40px] gap-3 bg-[#F8FAFC] px-3 py-2 text-sm font-medium text-[#1f1f1f]">
                        <span>Nama Evidence</span>
                        <span>Tipe File</span>
                        <span>Wajib</span>
                        <span>
                          <span className="sr-only">Aksi</span>
                        </span>
                      </div>
                      {evidences.fields.map((item, index) => {
                        const nameError = form.formState.errors.evidences?.[index]?.name?.message;
                        const typeError = form.formState.errors.evidences?.[index]?.fileTypes?.message;
                        return (
                          <div
                            key={item.id}
                            className="grid min-w-[560px] grid-cols-[1fr_200px_64px_40px] items-start gap-3 border-t border-[#EDEDED] px-3 py-2"
                          >
                            <div>
                              <input
                                {...form.register(`evidences.${index}.name`)}
                                aria-label={`Nama evidence ${index + 1}`}
                                placeholder="Contoh: Foto Kunjungan"
                                className={cn(
                                  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring",
                                  nameError && "border-destructive",
                                )}
                              />
                              {nameError && <ErrorText className="mt-1">{nameError}</ErrorText>}
                            </div>
                            <Controller
                              control={form.control}
                              name={`evidences.${index}.fileTypes`}
                              render={({ field }) => (
                                <div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className={cn(
                                          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-sm",
                                          typeError && "border-destructive",
                                        )}
                                      >
                                        <span className="truncate">{typeLabel(field.value ?? [])}</span>
                                        <ChevronDown className="size-4 shrink-0 opacity-50" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="min-w-48">
                                      {EVIDENCE_FILE_TYPES.map((type) => (
                                        <DropdownMenuCheckboxItem
                                          key={type.value}
                                          checked={field.value?.includes(type.value)}
                                          onSelect={(e) => e.preventDefault()}
                                          onCheckedChange={(checked) =>
                                            field.onChange(
                                              checked
                                                ? [...(field.value ?? []), type.value]
                                                : (field.value ?? []).filter((v) => v !== type.value),
                                            )
                                          }
                                        >
                                          {type.label}
                                        </DropdownMenuCheckboxItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {typeError && <ErrorText className="mt-1">{typeError}</ErrorText>}
                                </div>
                              )}
                            />
                            <Controller
                              control={form.control}
                              name={`evidences.${index}.isRequired`}
                              render={({ field }) => (
                                <div className="pt-1.5">
                                  <Switch label={`Wajib evidence ${index + 1}`} checked={field.value} onChange={field.onChange} />
                                </div>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Hapus evidence ${index + 1}`}
                              className="mt-0.5 text-[#D64545] hover:text-[#D64545]"
                              onClick={() => evidences.remove(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {evidenceError && <ErrorText>{evidenceError}</ErrorText>}
                </section>

                <aside className="h-fit space-y-4 rounded-xl bg-[#F8FAFC] p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-[#1f1f1f]">
                    <Eye className="size-5 text-[#1980C0]" />
                    Preview Tahapan
                  </h3>
                  <StageChevron name={name?.trim() || "Nama tahapan"} color={validColor} first />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#475467]">Probabilitas</span>
                    <span className="rounded-md bg-[#E5F1FA] px-2 py-0.5 font-medium text-[#1980C0]">
                      {Number(probability || 0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#475467]">Warna</span>
                    <span className="inline-flex items-center gap-2 font-mono">
                      <span className="size-5 rounded" style={{ backgroundColor: validColor }} />
                      {validColor.toUpperCase()}
                    </span>
                  </div>
                </aside>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#EDEDED] p-4 sm:flex-row sm:justify-end sm:p-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
                Batal
              </Button>
              <Button type="submit" disabled={save.isPending} className="bg-[#1980C0] px-8 text-white hover:bg-[#166ea6]">
                {save.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
