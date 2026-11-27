"use client";

import {
  SECTION_GRID,
  fieldGrid,
  groupBySection,
  isFullRowField,
  isWideSection,
  sectionSpan,
} from "@/app/crm-configuration/form-template/form-preview";
import { LEAD_LABEL_ICONS } from "@/app/crm-configuration/leads-label/label-icons";
import { LeadLabelMultiSelect } from "@/app/leads/components/lead-label-multi-select";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { ErrorText } from "@/components/ui/error-text";
import { FormInput } from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { LabelText } from "@/components/ui/label-text";
import type { FormField } from "@/hooks/use-form-templates";
import { useLeadCampaigns } from "@/hooks/use-lead-campaigns";
import { useLeadForm, useSubmitLeadForm, type LeadFormDefinition, type LeadFormSubmission } from "@/hooks/use-lead-form";
import type { DealLeadOption } from "@/hooks/use-create-deal";
import { useLeadLabels } from "@/hooks/use-lead-labels";
import { useActiveLeadSources } from "@/hooks/use-lead-sources";
import { usePipelineStages } from "@/hooks/use-pipeline-stages";
import { errorMessage, useProject, useProjects } from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CircleDollarSign,
  Layers,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Save,
  Settings2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Controller, FormProvider, get, useForm, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type Values = Record<string, unknown>;

/** Lead yang masih berada di dialog; belum pernah ditulis ke database. */
export type PendingLeadDeal = {
  submission: LeadFormSubmission;
  preview: DealLeadOption;
  projectId?: string;
};

/** Gaya kartu, input, dan judul sama dengan dialog Add Lead sebelumnya. */
const CARD = "rounded-xl border border-[#D9E6FA] bg-white p-4 shadow-[0_2px_8px_rgba(44,95,180,0.04)]";
const CONTROL = "border-[#C9D9F3]";
const ICON = "pointer-events-none absolute bottom-2.5 left-3 z-10 size-4 text-[#5C78A9]";

const ARRAY_TYPES = new Set(["MULTISELECT", "LEAD_LABEL"]);
const INPUT_ICONS: Record<string, LucideIcon> = {
  name: UserRound,
  phone: Phone,
  email: Mail,
  lead_budget: CircleDollarSign,
};
const PHONE = /^\+?[0-9 ()-]{6,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AGE = 120;

const dataFields = (fields: FormField[]) =>
  fields.filter((field): field is FormField & { key: string } => field.type !== "SECTION" && !!field.key);

const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && !value.trim()) ||
  (Array.isArray(value) && value.length === 0);

const labelOf = (field: FormField) => `${field.label}${field.required ? " *" : ""}`;

/** Aturan wajib dan format mengikuti template; backend tetap memvalidasi ulang. */
function buildSchema(fields: FormField[]) {
  return z.record(z.string(), z.unknown()).superRefine((values, ctx) => {
    for (const field of dataFields(fields)) {
      const value = values[field.key];
      const issue = (message: string) => ctx.addIssue({ code: "custom", path: [field.key], message });
      if (isEmpty(value)) {
        // Assigned Sales kosong = pembuat Lead.
        if (field.required && field.key !== "assigned_sales") issue(`${field.label} wajib diisi`);
        continue;
      }
      const text = typeof value === "string" ? value.trim() : "";
      switch (field.type) {
        case "EMAIL":
          if (!EMAIL.test(text)) issue(`${field.label} tidak valid`);
          break;
        case "PHONE":
          if (!PHONE.test(text)) issue(`${field.label} tidak valid`);
          break;
        case "NUMBER": {
          const number = Number(value);
          if (!Number.isFinite(number)) issue(`${field.label} harus berupa angka`);
          else if (field.key === "customer_age" && (!Number.isInteger(number) || number < 0 || number > MAX_AGE)) {
            issue(`${field.label} harus bilangan bulat 0–${MAX_AGE}`);
          }
          break;
        }
        case "TEXT":
          if (text.length > (field.key === "name" ? 150 : 255)) issue(`${field.label} terlalu panjang`);
          break;
      }
    }
  });
}

function defaultsOf(fields: FormField[], userId: string | undefined, previous: Values | null): Values {
  return Object.fromEntries(
    dataFields(fields).map((field) => {
      const kept = previous?.[field.key];
      if (kept !== undefined) return [field.key, kept];
      if (field.key === "assigned_sales") return [field.key, userId ?? ""];
      return [field.key, ARRAY_TYPES.has(field.type) ? [] : ""];
    }),
  );
}

/** Isian form menjadi nilai API; field kosong tidak dikirim. */
function toPayload(fields: FormField[], values: Values, isOwner: boolean): Values {
  const payload: Values = {};
  for (const field of dataFields(fields)) {
    const value = values[field.key];
    if (isEmpty(value)) continue;
    // Server selalu meng-assign Lead milik non-owner ke pembuatnya.
    if (field.key === "assigned_sales" && !isOwner) continue;
    if (field.type === "NUMBER" || field.type === "CURRENCY") payload[field.key] = Number(value);
    else if (field.type === "BOOLEAN") payload[field.key] = value === "true";
    else if (Array.isArray(value)) payload[field.key] = value;
    else payload[field.key] = String(value).trim();
  }
  return payload;
}

function FieldError({ name }: { name: string }) {
  const {
    formState: { errors },
  } = useFormContext();
  const error = get(errors, name);
  return error ? <ErrorText>{error.message?.toString()}</ErrorText> : null;
}

function HelpText({ field }: { field: FormField }) {
  return field.helpText ? <p className="mt-1 text-xs text-[#667085]">{field.helpText}</p> : null;
}

/** Radio, Ya/Tidak, atau checkbox untuk custom field pilihan. */
function ChoiceGroup({ field, options, multiple }: { field: FormField & { key: string }; options: { value: string; label: string }[]; multiple?: boolean }) {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={field.key}
      render={({ field: input }) => {
        const selected: string[] = multiple ? (Array.isArray(input.value) ? input.value : []) : [String(input.value ?? "")];
        const toggle = (value: string) =>
          input.onChange(
            multiple ? (selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]) : value,
          );
        return (
          <div>
            <LabelText>{labelOf(field)}</LabelText>
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
              {options.length === 0 && <span className="text-sm text-muted-foreground">Belum ada pilihan.</span>}
              {options.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-[#344054]">
                  <input
                    type={multiple ? "checkbox" : "radio"}
                    name={field.key}
                    className="size-4 accent-[#0B63F6]"
                    checked={selected.includes(option.value)}
                    onChange={() => toggle(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <FieldError name={field.key} />
          </div>
        );
      }}
    />
  );
}

function ProjectField({ field }: { field: FormField & { key: string } }) {
  const { setValue } = useFormContext();
  const projectsQuery = useProjects({ page: 1, limit: 100, isActive: true });
  const options = (projectsQuery.data?.data ?? []).map((project) => ({ value: project.id, label: project.name }));
  return (
    <FormSelect
      name={field.key}
      label={labelOf(field)}
      placeholder={projectsQuery.isLoading ? "Memuat project..." : options.length ? field.placeholder || "Pilih project" : "Belum ada project aktif"}
      options={options}
      isLoading={projectsQuery.isLoading}
      disabled={options.length === 0}
      // Tipe rumah mengikuti project yang dipilih.
      onValueChange={() => setValue("interest_types", "")}
      className={CONTROL}
    />
  );
}

function ProjectTypeField({ field }: { field: FormField & { key: string } }) {
  const projectId = useWatch({ name: "interest_projects" }) as string | undefined;
  const projectQuery = useProject(projectId || undefined);
  const options = (projectQuery.data?.variants ?? []).map((variant) => ({ value: variant.id, label: variant.name }));
  return (
    <FormSelect
      name={field.key}
      label={labelOf(field)}
      placeholder={
        !projectId
          ? "Pilih project dahulu"
          : projectQuery.isLoading
            ? "Memuat tipe rumah..."
            : options.length
              ? field.placeholder || "Pilih tipe rumah"
              : "Project belum memiliki tipe"
      }
      options={options}
      isLoading={!!projectId && projectQuery.isLoading}
      disabled={!projectId || options.length === 0}
      className={CONTROL}
    />
  );
}

function SourceField({ field }: { field: FormField & { key: string } }) {
  const { setValue } = useFormContext();
  const { sources } = useActiveLeadSources();
  return (
    <FormSelect
      name={field.key}
      label={labelOf(field)}
      placeholder={sources.length ? field.placeholder || "Pilih sumber lead" : "Belum ada sumber lead aktif"}
      options={sources.map((source) => ({ value: source.id, label: source.name }))}
      disabled={sources.length === 0}
      // Campaign mengikuti sumber yang dipilih.
      onValueChange={() => setValue("lead_campaign", "")}
      className={CONTROL}
    />
  );
}

function CampaignField({ field }: { field: FormField & { key: string } }) {
  const sourceId = useWatch({ name: "lead_source" }) as string | undefined;
  const campaignsQuery = useLeadCampaigns(sourceId || undefined);
  const campaigns = (campaignsQuery.data ?? []).filter((campaign) => campaign.isActive);
  return (
    <FormSelect
      name={field.key}
      label={labelOf(field)}
      placeholder={
        !sourceId
          ? "Pilih sumber dahulu"
          : campaigns.length
            ? field.placeholder || "Pilih campaign"
            : campaignsQuery.isLoading
              ? "Memuat campaign..."
              : "Belum ada campaign aktif"
      }
      options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name || "Campaign tanpa nama" }))}
      isLoading={!!sourceId && campaignsQuery.isLoading}
      disabled={!sourceId || campaigns.length === 0}
      className={CONTROL}
    />
  );
}

function SalesField({ field, isOwner }: { field: FormField & { key: string }; isOwner: boolean }) {
  const { user } = useAuth();
  const { users } = useUsers();
  const people = isOwner ? users : user ? [user] : [];
  return (
    <FormSelect
      name={field.key}
      label={labelOf(field)}
      placeholder={field.placeholder || "Pilih sales"}
      options={people.map((sales) => ({ value: sales.id, label: sales.name || sales.email || "User" }))}
      disabled={!isOwner || users.length === 0}
      className={CONTROL}
    />
  );
}

function StageField({ field }: { field: FormField & { key: string } }) {
  const stagesQuery = usePipelineStages("lead");
  const stages = (stagesQuery.data ?? []).filter((stage) => stage.isActive);
  return (
    <FormSelect
      name={field.key}
      label={labelOf(field)}
      placeholder={field.placeholder || "Tahapan default"}
      options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
      isLoading={stagesQuery.isLoading}
      disabled={stages.length === 0}
      className={CONTROL}
    />
  );
}

function LabelsField({ field }: { field: FormField & { key: string } }) {
  const labelsQuery = useLeadLabels(undefined, 1, 100);
  const labels = (labelsQuery.data?.data ?? []).filter((label) => label.isActive);
  return (
    <div>
      <LeadLabelMultiSelect name={field.key} label={labelOf(field)} className="col-span-full" labels={labels} isLoading={labelsQuery.isLoading} />
      <FieldError name={field.key} />
    </div>
  );
}

function withIcon(field: FormField & { key: string }, control: ReactNode) {
  const Icon = INPUT_ICONS[field.key];
  if (!Icon) return control;
  return (
    <div className="relative">
      <Icon className={ICON} />
      {control}
    </div>
  );
}

/** Kontrol yang dapat diisi sesuai tipe field template. */
function LeadFormControl({ field, isOwner }: { field: FormField & { key: string }; isOwner: boolean }) {
  const label = labelOf(field);
  const placeholder = field.placeholder ?? undefined;
  const iconClass = cn(CONTROL, INPUT_ICONS[field.key] && "pl-9");
  switch (field.type) {
    case "PROJECT":
      return <ProjectField field={field} />;
    case "PROJECT_TYPE":
      return <ProjectTypeField field={field} />;
    case "LEAD_SOURCE":
      return <SourceField field={field} />;
    case "CAMPAIGN":
      return <CampaignField field={field} />;
    case "USER":
      return <SalesField field={field} isOwner={isOwner} />;
    case "STAGE":
      return <StageField field={field} />;
    case "LEAD_LABEL":
      return <LabelsField field={field} />;
    case "GENDER":
      return (
        <FormSelect
          name={field.key}
          label={label}
          placeholder={placeholder || "Pilih jenis kelamin"}
          options={[
            { value: "male", label: field.options?.[0] || "Laki-laki" },
            { value: "female", label: field.options?.[1] || "Perempuan" },
          ]}
          className={CONTROL}
        />
      );
    case "SELECT":
      return (
        <FormSelect
          name={field.key}
          label={label}
          placeholder={placeholder || "Pilih salah satu"}
          options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
          className={CONTROL}
        />
      );
    case "RADIO":
      return <ChoiceGroup field={field} options={(field.options ?? []).map((option) => ({ value: option, label: option }))} />;
    case "MULTISELECT":
      return (
        <ChoiceGroup field={field} multiple options={(field.options ?? []).map((option) => ({ value: option, label: option }))} />
      );
    case "BOOLEAN":
      return (
        <ChoiceGroup
          field={field}
          options={[
            { value: "true", label: "Ya" },
            { value: "false", label: "Tidak" },
          ]}
        />
      );
    case "TEXTAREA":
      return <FormTextarea name={field.key} label={label} placeholder={placeholder} rows={2} className={CONTROL} />;
    case "CURRENCY":
      return withIcon(
        field,
        <FormInput name={field.key} label={label} currency placeholder={placeholder || "Contoh: Rp 550.000.000"} className={iconClass} />,
      );
    case "NUMBER":
      return (
        <FormInput
          name={field.key}
          label={label}
          type="number"
          inputMode="numeric"
          {...(field.key === "customer_age" ? { min: 0, max: MAX_AGE } : {})}
          placeholder={placeholder || (field.key === "customer_age" ? "Contoh: 30" : "0")}
          className={CONTROL}
        />
      );
    case "DATE":
      return <FormInput name={field.key} label={label} type="date" className={CONTROL} />;
    case "EMAIL":
      return withIcon(
        field,
        <FormInput name={field.key} label={label} type="email" placeholder={placeholder || "Masukkan email..."} className={iconClass} />,
      );
    case "PHONE":
      return withIcon(
        field,
        <FormInput name={field.key} label={label} type="tel" placeholder={placeholder || "Contoh: 812 3456 7890"} className={iconClass} />,
      );
    default:
      return withIcon(
        field,
        <FormInput
          name={field.key}
          label={label}
          placeholder={placeholder || (field.key === "name" ? "Masukkan nama lengkap..." : undefined)}
          className={iconClass}
        />,
      );
  }
}

/** Badan dialog + footer yang sama untuk state memuat, gagal, dan form. */
function FormFrame({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
      <DialogFooter className="mt-auto shrink-0 -mx-0 -mb-0 rounded-none border-[#DCE7F8] bg-white px-5 py-3 sm:px-6">
        {footer}
      </DialogFooter>
    </div>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" className="border-[#C9D9F3]" onClick={onClick}>
      Cancel
    </Button>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3 lg:grid-cols-2" aria-busy="true" aria-label="Memuat form">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className={cn(CARD, index === 2 && "lg:col-span-2")}>
          <div className="mb-4 h-4 w-40 animate-pulse rounded bg-[#EAF2FF]" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-[#EEF2F6]" />
                <div className="h-9 animate-pulse rounded-md bg-[#F2F6FC]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DynamicLeadForm({
  form,
  previous,
  onDone,
  onConflict,
  onDealRequested,
}: {
  form: LeadFormDefinition;
  previous: Values | null;
  onDone: () => void;
  onConflict: (values: Values) => void;
  onDealRequested: (lead: PendingLeadDeal) => void;
}) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const schema = useMemo(() => buildSchema(form.fields), [form.fields]);
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaultsOf(form.fields, user?.id, previous),
  });
  const submitMutation = useSubmitLeadForm();
  const [createDealAfterSave, setCreateDealAfterSave] = useState(false);
  const groups = groupBySection(form.fields).filter((group) => group.fields.length > 0);

  const onSubmit = async (values: Values) => {
    const submission = {
      templateVersionId: form.versionId,
      values: toPayload(form.fields, values, isOwner),
    };
    if (createDealAfterSave) {
      onDealRequested({
        submission,
        preview: {
          id: "__new_lead__",
          name: String(submission.values.name ?? "Lead baru"),
          email: typeof submission.values.email === "string" ? submission.values.email : null,
          phone: typeof submission.values.phone === "string" ? submission.values.phone : null,
          project: null,
          labels: [],
        },
        projectId: typeof submission.values.interest_projects === "string" ? submission.values.interest_projects : undefined,
      });
      return;
    }
    try {
      await submitMutation.mutateAsync(submission);
      onDone();
    } catch (error) {
      const message = errorMessage(error, "Gagal menyimpan Lead.");
      if (/form has changed/i.test(message)) {
        toast.info("Form Add Lead baru saja diperbarui. Form dimuat ulang; periksa isian lalu simpan kembali.");
        onConflict(methods.getValues());
        return;
      }
      toast.error(message);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} noValidate className="flex h-full min-h-0 flex-col overflow-hidden">
        <FormFrame
          footer={
            <>
              {form.showDealCreationOption ? (
                <label className="mr-auto flex cursor-pointer items-start gap-3 text-left">
                  <Checkbox
                    checked={createDealAfterSave}
                    onCheckedChange={(checked) => setCreateDealAfterSave(checked === true)}
                    aria-label="Buat Deal Sekaligus"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#142047]">Buat Deal Sekaligus</span>
                    <span className="block text-xs text-[#667085]">Langsung buat peluang penjualan (Deal) dari Lead ini.</span>
                  </span>
                </label>
              ) : (
                <p className="mr-auto text-xs text-[#667085]">Deal dapat dibuat setelah Lead tersimpan melalui halaman Detail Lead.</p>
              )}
              <CancelButton onClick={onDone} />
              <Button type="submit" className="bg-[#0B63F6] px-5 hover:bg-[#0755D6]" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Lead
              </Button>
            </>
          }
        >
          <div className={SECTION_GRID}>
            {groups.map((group, index) => {
              const wide = isWideSection(group.fields.length);
              const Icon = (group.section?.icon && LEAD_LABEL_ICONS[group.section.icon]) || Layers;
              return (
                <section key={group.section?.key ?? `group-${index}`} className={cn(CARD, sectionSpan(wide))}>
                  {group.section && (
                    <div className="mb-3">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-[#142047]">
                        <Icon className="size-4 text-[#0B63F6]" />
                        {group.section.label}
                      </h3>
                      {group.section.helpText && <p className="mt-0.5 text-xs text-[#667085]">{group.section.helpText}</p>}
                    </div>
                  )}
                  <div className={cn("grid gap-3", fieldGrid(wide))}>
                    {dataFields(group.fields).map((field) => (
                      <div key={field.key} className={cn("min-w-0", isFullRowField(field) && "col-span-full")}>
                        <LeadFormControl field={field} isOwner={isOwner} />
                        {field.type !== "LEAD_LABEL" && <HelpText field={field} />}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </FormFrame>
      </form>
    </FormProvider>
  );
}

/** Isi dialog Add Lead dari template default (CRM Configuration → Form Template). */
export function AddLeadForm({ onDone, onDealRequested }: { onDone: () => void; onDealRequested: (lead: PendingLeadDeal) => void }) {
  const formQuery = useLeadForm(true);
  // Isian yang dipertahankan saat form dimuat ulang karena template berubah.
  const [previous, setPrevious] = useState<Values | null>(null);

  if (formQuery.isPending) {
    return (
      <FormFrame footer={<CancelButton onClick={onDone} />}>
        <LoadingState />
      </FormFrame>
    );
  }

  if (formQuery.isError || !formQuery.data) {
    const message = errorMessage(formQuery.error, "Form Add Lead tidak dapat dimuat.");
    const noTemplate = /default form template not found/i.test(message);
    return (
      <FormFrame footer={<CancelButton onClick={onDone} />}>
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#C9D9F3] bg-white p-8 text-center">
          <AlertCircle className="size-8 text-[#0B63F6]" />
          <div>
            <p className="font-semibold text-[#142047]">
              {noTemplate ? "Belum ada template form default" : "Form Add Lead tidak dapat dimuat"}
            </p>
            <p className="mt-1 max-w-md text-sm text-[#667085]">
              {noTemplate
                ? "Aktifkan atau tetapkan satu template sebagai default di CRM Configuration → Form Template agar Lead dapat ditambahkan."
                : message}
            </p>
          </div>
          {noTemplate ? (
            <Button asChild variant="outline" className="border-[#C9D9F3]">
              <Link href="/crm-configuration/form-template">
                <Settings2 className="size-4" />
                Buka Form Template
              </Link>
            </Button>
          ) : (
            <Button type="button" variant="outline" className="border-[#C9D9F3]" onClick={() => void formQuery.refetch()}>
              <RefreshCw className="size-4" />
              Coba lagi
            </Button>
          )}
        </div>
      </FormFrame>
    );
  }

  return (
    <DynamicLeadForm
      key={formQuery.data.versionId}
      form={formQuery.data}
      previous={previous}
      onDone={onDone}
      onDealRequested={onDealRequested}
      onConflict={(values) => {
        setPrevious(values);
        void formQuery.refetch();
      }}
    />
  );
}
