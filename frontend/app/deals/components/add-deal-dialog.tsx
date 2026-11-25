"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, FileText, Flag, FolderOpen, Handshake, Mail, Phone, Save, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { LabelBadge } from "@/app/crm-configuration/leads-label/label-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorText } from "@/components/ui/error-text";
import { Input } from "@/components/ui/input";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateDeal, useDealLeadOptions, type DealLeadOption } from "@/hooks/use-create-deal";
import { useFinancingBanks } from "@/hooks/use-financing-banks";
import { usePipelineStages } from "@/hooks/use-pipeline-stages";
import { errorMessage, useProjects } from "@/hooks/use-projects";
import { useAvailableReservationUnits } from "@/hooks/use-reservations";
import { formatRupiah } from "@/lib/helper";
import { cn } from "@/lib/utils";
import type { Deal } from "@/types/deal";
import { DealDocumentsTable, dealDocuments } from "./deal-documents";

const PAYMENTS = [
  { value: "CASH", label: "Tunai" },
  { value: "KPR", label: "KPR" },
  { value: "KPR_SHARIA", label: "KPR Syariah" },
] as const;

const MAX_AMOUNT = 999_999_999_999;
/** Tanggal hari ini (WIB) sebagai YYYY-MM-DD, sama dengan backend. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

const schema = z
  .object({
    leadId: z.string().min(1, "Pilih Lead."),
    projectId: z.string().min(1, "Pilih project."),
    unitId: z.string().min(1, "Pilih unit."),
    amount: z
      .string()
      .min(1, "Harga deal wajib diisi.")
      .refine((value) => Number(value) <= MAX_AMOUNT, "Harga deal terlalu besar."),
    paymentMethod: z.enum(["CASH", "KPR", "KPR_SHARIA"]),
    financingBankId: z.string(),
    expectedClosingDate: z
      .string()
      .min(1, "Target closing wajib diisi.")
      .refine((value) => value >= today(), "Target closing tidak boleh sebelum hari ini."),
    notes: z.string().max(10000, "Catatan maksimal 10.000 karakter."),
  })
  .superRefine((data, context) => {
    if (data.paymentMethod !== "CASH" && !data.financingBankId) {
      context.addIssue({ code: "custom", path: ["financingBankId"], message: "Pilih bank pembiayaan." });
    }
  });
type FormData = z.infer<typeof schema>;

function Section({ icon: Icon, title, description, aside, children }: {
  icon: LucideIcon;
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-[#E4E4E7] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E5F1FA] text-[#1980C0]">
            <Icon className="size-5" />
          </span>
          <div>
            <h3 className="font-semibold text-[#1f1f1f]">{title}</h3>
            {description && <p className="text-sm text-[#475467]">{description}</p>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, required = true, error, hint, children }: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-sm font-medium text-[#1f1f1f]">
        {label} {required && <span className="text-[#D64545]">*</span>}
      </p>
      {children}
      {error ? <ErrorText className="mt-1">{error}</ErrorText> : hint && <p className="mt-1 text-xs text-[#6b6b6b]">{hint}</p>}
    </div>
  );
}

function LeadCard({ lead }: { lead: DealLeadOption }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E4E4E7] bg-[#F6FAFD] p-3 sm:flex-row sm:items-center">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#E5F1FA] text-[#1980C0]">
        <UserRound className="size-6" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#1f1f1f]">{lead.name}</span>
          {lead.labels.map((label) => (
            <LabelBadge key={label.id} name={label.name} color={label.color} icon={label.icon} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#475467]">
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-4" /> {lead.phone || "-"}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5 break-all">
            <Mail className="size-4 shrink-0" /> {lead.email || "-"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 border-[#E4E4E7] sm:border-l sm:pl-4">
        <Building2 className="size-5 shrink-0 text-[#1980C0]" />
        <div>
          <p className="text-xs text-[#6b6b6b]">Project Diminati</p>
          <p className="text-sm font-medium text-[#1f1f1f]">{lead.project?.name ?? "-"}</p>
        </div>
      </div>
    </div>
  );
}

/** Render hanya saat terbuka agar isinya selalu baru. */
export function AddDealDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (deal: Deal) => void;
}) {
  const leads = useDealLeadOptions();
  const projects = useProjects({ page: 1, limit: 100, isActive: true });
  const stages = usePipelineStages("deal");
  const banks = useFinancingBanks(true);
  const create = useCreateDeal();
  const [files, setFiles] = useState<Record<string, File>>({});
  const [showMissing, setShowMissing] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      leadId: "",
      projectId: "",
      unitId: "",
      amount: "",
      paymentMethod: "CASH",
      financingBankId: "",
      expectedClosingDate: "",
      notes: "",
    },
  });
  const [selectedLeadId, pickedProjectId, unitId, paymentMethod] = useWatch({
    control: form.control,
    name: ["leadId", "projectId", "unitId", "paymentMethod"],
  });
  const errors = form.formState.errors;
  const lead = leads.data?.find((item) => item.id === selectedLeadId);
  const projectOptions = projects.data?.data ?? [];
  const units = useAvailableReservationUnits(pickedProjectId || undefined);
  const unit = units.data?.find((item) => item.id === unitId);
  const stage = stages.data?.find((item) => item.isDefaultStage && item.isActive);
  const documents = dealDocuments(stage?.evidences ?? [], paymentMethod);
  const required = documents.filter((item) => item.isRequired);
  const completed = required.filter((item) => files[item.name]).length;
  const progress = required.length ? Math.round((completed / required.length) * 100) : 100;

  const pickProject = (id: string) => {
    form.setValue("projectId", id, { shouldValidate: form.formState.isSubmitted });
    form.setValue("unitId", "");
    form.setValue("amount", "");
  };
  const pickLead = (option: DealLeadOption | undefined) => {
    form.setValue("leadId", option?.id ?? "", { shouldValidate: form.formState.isSubmitted });
    if (option?.project && projectOptions.some((item) => item.id === option.project?.id)) pickProject(option.project.id);
  };

  const submit = form.handleSubmit(
    async (data) => {
      const minimum = Number(unit?.typeVariant.currentPrice ?? 0);
      if (Number(data.amount) < minimum) {
        form.setError("amount", { message: `Minimal harga jual resmi ${formatRupiah(minimum)}.` });
        return;
      }
      setShowMissing(true);
      if (completed < required.length) {
        toast.error("Lengkapi dokumen wajib terlebih dahulu.");
        return;
      }
      try {
        const deal = await create.mutateAsync({
          payload: {
            leadId: data.leadId,
            unitId: data.unitId,
            amount: Number(data.amount),
            paymentMethod: data.paymentMethod,
            financingBankId: data.paymentMethod === "CASH" ? null : data.financingBankId,
            expectedClosingDate: data.expectedClosingDate,
            notes: data.notes.trim() || null,
          },
          documents: documents.flatMap(({ name }) => (files[name] ? [{ name, file: files[name] }] : [])),
        });
        onCreated(deal);
      } catch {
        // Pesan error ditampilkan oleh mutation.
      }
    },
    () => setShowMissing(true),
  );

  const loading = leads.isLoading || stages.isLoading || projects.isLoading;
  const failed = leads.error ?? stages.error ?? projects.error;
  const blocked = failed
    ? errorMessage(failed, "Gagal memuat data form Deal.")
    : loading
      ? null
      : !leads.data?.length
        ? "Belum ada Lead yang dapat dibuatkan Deal."
        : !stage
          ? "Deals Pipeline belum memiliki tahapan default yang aktif."
          : null;

  return (
    <Dialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="flex-row items-center gap-4 border-b border-[#EDEDED] p-4 text-left sm:px-6">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#E5F1FA] text-[#1980C0]">
            <Handshake className="size-6" />
          </span>
          <div>
            <DialogTitle>Tambah Deal</DialogTitle>
            <DialogDescription>
              Buat data deal baru dari leads yang sudah ada dan lengkapi informasi serta dokumen persyaratannya.
            </DialogDescription>
          </div>
        </DialogHeader>

        {loading || blocked ? (
          <div className="p-10 text-center text-sm text-[#475467]">
            {blocked ?? "Memuat data..."}
            {!failed && !loading && !leads.data?.length && (
              <p className="mt-2">
                <Link href="/leads" className="font-medium text-[#1980C0] hover:underline">
                  Buka Daftar Leads
                </Link>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:px-6">
              <Section icon={UserRound} title="Pilih Lead">
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
                  <Field label="Lead" error={errors.leadId?.message}>
                    <SearchableSelect
                      value={lead?.id}
                      onChange={(id) => pickLead(leads.data?.find((item) => item.id === id))}
                      placeholder="Pilih Lead"
                      searchPlaceholder="Cari nama, telepon, atau email"
                      options={(leads.data ?? []).map((item) => ({
                        value: item.id,
                        label: item.name,
                        hint: [item.phone, item.email].filter(Boolean).join(" · "),
                      }))}
                      clearable={false}
                      invalid={!!errors.leadId}
                      triggerClassName="h-10 text-sm"
                    />
                  </Field>
                  {lead && <LeadCard lead={lead} />}
                </div>
              </Section>

              <Section icon={FileText} title="Informasi Deal">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Project" error={errors.projectId?.message}>
                    <SearchableSelect
                      value={pickedProjectId || undefined}
                      onChange={(id) => pickProject(id ?? "")}
                      placeholder="Pilih project"
                      options={projectOptions.map((item) => ({ value: item.id, label: item.name }))}
                      clearable={false}
                      invalid={!!errors.projectId}
                      triggerClassName="h-10 text-sm"
                    />
                  </Field>
                  <Field
                    label="Unit / Properti"
                    error={errors.unitId?.message ?? (units.isError ? errorMessage(units.error, "Gagal memuat unit.") : undefined)}
                    hint={pickedProjectId && units.data?.length === 0 ? "Tidak ada unit Available di project ini." : undefined}
                  >
                    <SearchableSelect
                      value={unitId || undefined}
                      onChange={(id) => {
                        const next = units.data?.find((item) => item.id === id);
                        form.setValue("unitId", id ?? "", { shouldValidate: form.formState.isSubmitted });
                        form.setValue("amount", next ? String(next.typeVariant.currentPrice) : "", { shouldValidate: form.formState.isSubmitted });
                      }}
                      placeholder="Pilih unit"
                      options={(units.data ?? []).map((item) => ({
                        value: item.id,
                        label: `${item.code} (${item.variant.name} - ${item.typeVariant.name})`,
                        hint: formatRupiah(Number(item.typeVariant.currentPrice)),
                      }))}
                      loading={units.isLoading}
                      disabled={!pickedProjectId}
                      disabledHint="Pilih project terlebih dahulu"
                      clearable={false}
                      invalid={!!errors.unitId}
                      triggerClassName="h-10 text-sm"
                    />
                  </Field>
                  <Field
                    label="Harga Deal"
                    error={errors.amount?.message}
                    hint={unit && `Minimal harga jual resmi ${formatRupiah(Number(unit.typeVariant.currentPrice))}.`}
                  >
                    <Controller
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <RupiahInput
                          ref={field.ref}
                          name={field.name}
                          aria-label="Harga Deal"
                          value={field.value}
                          onBlur={field.onBlur}
                          onValueChange={field.onChange}
                          className={cn("h-10", errors.amount && "border-destructive")}
                        />
                      )}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
                  <Field label="Jenis Pembayaran">
                    <Controller
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <div role="radiogroup" aria-label="Jenis Pembayaran" className="grid grid-cols-3 gap-2">
                          {PAYMENTS.map((payment) => (
                            <label
                              key={payment.value}
                              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm has-[:checked]:border-[#1980C0] has-[:checked]:bg-[#F6FAFD] has-[:checked]:font-medium has-[:checked]:text-[#1980C0]"
                            >
                              <input
                                type="radio"
                                name="paymentMethod"
                                className="accent-[#1980C0]"
                                checked={field.value === payment.value}
                                onChange={() => {
                                  field.onChange(payment.value);
                                  if (payment.value === "CASH") form.setValue("financingBankId", "");
                                  form.clearErrors("financingBankId");
                                }}
                              />
                              {payment.label}
                            </label>
                          ))}
                        </div>
                      )}
                    />
                  </Field>
                  <Field label="Target Closing" error={errors.expectedClosingDate?.message}>
                    <Input
                      type="date"
                      min={today()}
                      aria-label="Target Closing"
                      className={cn("h-10", errors.expectedClosingDate && "border-destructive")}
                      {...form.register("expectedClosingDate")}
                    />
                  </Field>
                  <Field label="Fase Deal" required={false} hint="Fase awal sesuai konfigurasi Deals Pipeline.">
                    <div className="flex min-h-10 items-center gap-2 rounded-md bg-[#E5F1FA] px-3 py-1.5 text-sm font-medium text-[#1980C0]">
                      <Flag className="size-4 shrink-0" />
                      {stage?.name} (Otomatis)
                    </div>
                  </Field>
                </div>
                {paymentMethod !== "CASH" && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field
                      label="Bank Pembiayaan"
                      error={errors.financingBankId?.message}
                      hint={banks.isSuccess && !banks.data.length ? "Belum ada bank aktif, Deal KPR belum dapat dibuat." : undefined}
                    >
                      <Controller
                        control={form.control}
                        name="financingBankId"
                        render={({ field }) => (
                          <SearchableSelect
                            value={field.value || undefined}
                            onChange={(id) => field.onChange(id ?? "")}
                            placeholder="Pilih bank"
                            options={(banks.data ?? []).map((bank) => ({ value: bank.id, label: bank.name }))}
                            loading={banks.isLoading}
                            clearable={false}
                            invalid={!!errors.financingBankId}
                            triggerClassName="h-10 text-sm"
                          />
                        )}
                      />
                    </Field>
                  </div>
                )}
                <Field label="Catatan" required={false} error={errors.notes?.message}>
                  <Textarea rows={2} aria-label="Catatan" placeholder="Catatan awal Deal (opsional)" {...form.register("notes")} />
                </Field>
              </Section>

              <Section
                icon={FolderOpen}
                title="Dokumen Persyaratan"
                description={`Lengkapi dokumen sesuai tahapan deal (${stage?.name}) dan jenis pembayaran (${PAYMENTS.find((p) => p.value === paymentMethod)?.label}).`}
                aside={
                  <div className="w-full shrink-0 sm:w-56">
                    <p className="mb-1 text-sm">
                      Dokumen wajib {completed}/{required.length} lengkap
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5F1FA]">
                        <div className="h-full bg-[#1980C0]" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-sm">{progress}%</span>
                    </div>
                  </div>
                }
              >
                <DealDocumentsTable
                  documents={documents}
                  files={files}
                  showMissing={showMissing}
                  onChange={(name, file) =>
                    setFiles((current) => {
                      const next = { ...current };
                      if (file) next[name] = file;
                      else delete next[name];
                      return next;
                    })
                  }
                />
              </Section>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-[#EDEDED] p-4 sm:flex-row sm:justify-between sm:px-6">
              <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
                Batal
              </Button>
              <Button type="submit" disabled={create.isPending} className="bg-[#1980C0] text-white hover:bg-[#166ea6]">
                <Save className="size-4" />
                {create.isPending ? "Menyimpan..." : "Simpan Deal"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
