"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { id as idLocale } from "date-fns/locale";
import { Building2, CalendarDays, ChevronDown, Coins, FileText, Flag, FolderOpen, Handshake, House, Info, Landmark, Mail, Phone, Save, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { LabelBadge } from "@/app/crm-configuration/leads-label/label-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorText } from "@/components/ui/error-text";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  { value: "CASH", label: "Tunai", icon: Coins },
  { value: "KPR", label: "KPR", icon: Landmark },
  { value: "KPR_SHARIA", label: "KPR Syariah", icon: Landmark },
] as const;

const MAX_AMOUNT = 999_999_999_999;
/** Tanggal hari ini (WIB) sebagai YYYY-MM-DD, sama dengan backend. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
/** YYYY-MM-DD <-> Date lokal tanpa pergeseran zona waktu. */
const toDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
};
const toValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(toDate(value));

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
            <h3 className="text-lg font-bold text-[#1f1f1f]">{title}</h3>
            {description && <p className="text-sm text-[#475467]">{description}</p>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, required = true, info, error, hint, children }: {
  label: string;
  /** Penjelasan singkat, tampil saat ikon info disorot. */
  info?: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-[#1f1f1f]">
        {label} {required && <span className="text-[#D64545]">*</span>}
        {info && (
          <span title={info} aria-label={info} className="inline-flex text-[#1980C0]">
            <Info className="size-4" />
          </span>
        )}
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
          <span className="text-lg font-bold text-[#1f1f1f]">{lead.name}</span>
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
          <p className="text-sm font-semibold text-[#1f1f1f]">{lead.project?.name ?? "-"}</p>
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
  const [closingOpen, setClosingOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
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
    },
  });
  const [selectedLeadId, pickedProjectId, unitId, paymentMethod, closingDate] = useWatch({
    control: form.control,
    name: ["leadId", "projectId", "unitId", "paymentMethod", "expectedClosingDate"],
  });
  const errors = form.formState.errors;
  const lead = leads.data?.find((item) => item.id === selectedLeadId);
  const projectOptions = projects.data?.data ?? [];
  const units = useAvailableReservationUnits(pickedProjectId || undefined);
  const unit = units.data?.find((item) => item.id === unitId);
  const stage = stages.data?.find((item) => item.isDefaultStage && item.isActive);
  const documents = dealDocuments(stage?.evidences ?? [], paymentMethod);
  const required = documents.filter((item) => item.isRequired);
  const missingRequired = required.filter((item) => !files[item.name]).length;
  const uploaded = documents.filter((item) => files[item.name]).length;
  const progress = documents.length ? Math.round((uploaded / documents.length) * 100) : 100;
  const paymentLabel = PAYMENTS.find((p) => p.value === paymentMethod)?.label;

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
      if (missingRequired > 0) {
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
            notes: null,
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
      <DialogContent ref={contentRef} className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="flex-row items-center gap-4 border-b border-[#EDEDED] p-4 text-left sm:px-6">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#E5F1FA] text-[#1980C0]">
            <Handshake className="size-7" />
          </span>
          <div>
            <DialogTitle className="text-lg font-bold">Tambah Deal</DialogTitle>
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
              <Section icon={FileText} title="Pilih Lead">
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
                  <Field label="Lead" error={errors.leadId?.message}>
                    <SearchableSelect
                      value={lead?.id}
                      onChange={(id) => pickLead(leads.data?.find((item) => item.id === id))}
                      placeholder="Pilih Lead"
                      icon={UserRound}
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
                      icon={Building2}
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
                      icon={House}
                      options={(units.data ?? []).map((item) => ({
                        value: item.id,
                        label: `${item.code} (${item.variant.name})`,
                        hint: `${item.typeVariant.name} · ${formatRupiah(Number(item.typeVariant.currentPrice))}`,
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
                          leading={
                            <>
                              <Coins className="size-4 text-[#6b6b6b]" />
                              <span className="text-[#1f1f1f]">Rp</span>
                            </>
                          }
                          className={cn("h-10", errors.amount && "border-destructive")}
                        />
                      )}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <Field label="Jenis Pembayaran">
                    <Controller
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <div role="radiogroup" aria-label="Jenis Pembayaran" className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1.3fr]">
                          {PAYMENTS.map((payment) => (
                            <label
                              key={payment.value}
                              className="flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-input px-3 text-sm has-[:checked]:border-[#1980C0] has-[:checked]:bg-[#F6FAFD] has-[:checked]:font-medium has-[:checked]:text-[#1980C0]"
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
                              <payment.icon aria-hidden="true" className="size-4 shrink-0" />
                              {payment.label}
                            </label>
                          ))}
                        </div>
                      )}
                    />
                  </Field>
                  <Field label="Target Closing" error={errors.expectedClosingDate?.message}>
                    <Popover open={closingOpen} onOpenChange={setClosingOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Target Closing"
                          aria-invalid={!!errors.expectedClosingDate || undefined}
                          className={cn(
                            "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive",
                            !closingDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-[#6b6b6b]" />
                          <span className="flex-1 text-left">{closingDate ? dateLabel(closingDate) : "Pilih tanggal"}</span>
                          <ChevronDown className="size-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      {/* Dirender di dalam dialog agar kalender bisa diklik. */}
                      <PopoverContent align="start" portalContainer={contentRef.current} className="z-[999] w-auto p-0">
                        <Calendar
                          mode="single"
                          locale={idLocale}
                          selected={closingDate ? toDate(closingDate) : undefined}
                          defaultMonth={closingDate ? toDate(closingDate) : undefined}
                          disabled={{ before: toDate(today()) }}
                          onSelect={(date) => {
                            form.setValue("expectedClosingDate", date ? toValue(date) : "", { shouldValidate: form.formState.isSubmitted });
                            setClosingOpen(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>
                  <Field
                    label="Fase Deal"
                    required={false}
                    info="Fase awal deal diambil otomatis dari tahapan pertama Deals Pipeline."
                    hint="Fase awal deal sesuai pengaturan pipeline deal."
                  >
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
                            icon={Landmark}
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
              </Section>

              <Section
                icon={FolderOpen}
                title="Dokumen Persyaratan"
                description={`Lengkapi dokumen sesuai dengan tahapan deal (${stage?.name}) dan jenis pembayaran (${paymentLabel}).`}
                aside={
                  <div className="w-full shrink-0 sm:w-80">
                    <p className="mb-1 text-sm">
                      Dokumen {uploaded}/{documents.length} lengkap
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5F1FA]">
                        <div className="h-full bg-[#1980C0]" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-sm font-semibold">{progress}%</span>
                    </div>
                  </div>
                }
              >
                <DealDocumentsTable
                  documents={documents}
                  files={files}
                  showMissing={showMissing}
                  stageName={stage?.name}
                  paymentLabel={paymentLabel}
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
              <Button type="button" variant="outline" size="lg" className="px-6" onClick={onClose} disabled={create.isPending}>
                Batal
              </Button>
              <Button type="submit" size="lg" disabled={create.isPending} className="bg-[#1980C0] px-6 text-white hover:bg-[#166ea6]">
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
