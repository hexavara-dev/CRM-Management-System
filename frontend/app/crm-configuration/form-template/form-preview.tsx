import { CalendarDays, ChevronDown, Layers, User } from "lucide-react";
import { systemField, type FormField, type FormFieldType } from "@/hooks/use-form-templates";
import { cn } from "@/lib/utils";
import { LEAD_LABEL_ICONS } from "../leads-label/label-icons";

const section = (key: string, label: string, icon: string): FormField => ({
  key,
  label,
  type: "SECTION",
  required: false,
  placeholder: null,
  helpText: null,
  options: null,
  icon,
});

/** Susunan awal template baru, mengikuti mockup form Add Lead. */
export const DEFAULT_TEMPLATE_FIELDS: FormField[] = [
  section("section_informasi_personal", "Informasi Personal", "user"),
  systemField("name"),
  systemField("customer_gender"),
  systemField("customer_age"),
  section("section_informasi_kontak", "Informasi Kontak", "phone"),
  systemField("phone"),
  systemField("email"),
  systemField("customer_address"),
  section("section_minat_kebutuhan", "Minat & Kebutuhan", "home"),
  systemField("interest_projects"),
  systemField("interest_types"),
  systemField("lead_budget"),
  systemField("lead_notes"),
  section("section_sumber_lead", "Sumber Lead", "target"),
  systemField("lead_source"),
  systemField("lead_campaign"),
  section("section_penugasan_status", "Penugasan & Pipeline", "users"),
  systemField("assigned_sales"),
  systemField("lead_stage"),
  systemField("lead_temperature"),
];

/** Tipe yang memakai lebar penuh di form dua kolom. */
export const FULL_WIDTH_TYPES: FormFieldType[] = ["TEXTAREA", "MULTISELECT", "RADIO", "SECTION"];

/*
 * Tata letak dialog Add Lead. Dipakai bersama oleh dialog Add Lead (halaman Leads) dan pratinjau
 * template agar yang terlihat saat menyusun template sama dengan yang dilihat sales.
 */
/** Section dengan field data sebanyak ini atau lebih memakai lebar penuh dialog (isi tiga kolom). */
export const WIDE_SECTION_FIELDS = 4;
const FULL_ROW_TYPES: FormFieldType[] = ["TEXTAREA", "MULTISELECT", "RADIO", "LEAD_LABEL"];
export const isWideSection = (dataFieldCount: number) => dataFieldCount >= WIDE_SECTION_FIELDS;
/** Field yang mengambil satu baris penuh di dalam kartunya. */
export const isFullRowField = (field: Pick<FormField, "type" | "key">) =>
  FULL_ROW_TYPES.includes(field.type) || field.key === "name";
/** Kelas grid kartu dan isinya. */
export const SECTION_GRID = "grid gap-3 lg:grid-cols-2";
export const sectionSpan = (wide: boolean) => (wide ? "lg:col-span-2" : "");
export const fieldGrid = (wide: boolean) => (wide ? "md:grid-cols-3" : "sm:grid-cols-2");
/** Lebar dialog Add Lead; dipakai juga oleh dialog pratinjau. */
export const ADD_LEAD_DIALOG_WIDTH = "w-[calc(100vw-2rem)] max-w-none sm:w-[calc(100vw-4rem)] sm:max-w-[1280px]";

/** Teks bawaan kontrol pilihan data CRM. */
const RELATION_PLACEHOLDERS: Partial<Record<FormFieldType, string>> = {
  PROJECT: "Pilih project",
  PROJECT_TYPE: "Pilih tipe rumah",
  LEAD_SOURCE: "Pilih sumber lead",
  CAMPAIGN: "Pilih campaign (opsional)",
  USER: "Pilih sales",
  LEAD_LABEL: "Pilih satu atau beberapa label",
  GENDER: "Pilih jenis kelamin",
  STAGE: "Tahapan default",
};

// Satu baris; teks yang terlalu panjang terpotong agar tinggi kontrol tetap.
const box = "flex h-10 w-full min-w-0 items-center overflow-hidden whitespace-nowrap rounded-md border border-[#E4E4E7] bg-white px-3 text-sm text-[#9ca3af]";

export function FieldLabel({ field, className }: { field: Pick<FormField, "label" | "required">; className?: string }) {
  return (
    <p className={cn("mb-1.5 flex items-center gap-1 text-sm font-medium text-[#1f1f1f]", className)}>
      {field.label || <span className="text-[#9ca3af]">Tanpa label</span>}
      {field.required && <span className="text-[#D64545]">*</span>}
    </p>
  );
}

/** Judul section dengan ikon dan deskripsi. */
export function SectionHeader({ field, className }: { field: Pick<FormField, "label" | "helpText" | "icon">; className?: string }) {
  const Icon = (field.icon && LEAD_LABEL_ICONS[field.icon]) || Layers;
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <Icon className="mt-0.5 size-5 shrink-0 text-[#1980C0]" />
      <div className="min-w-0">
        <p className="font-semibold text-[#1f1f1f]">{field.label || <span className="text-[#9ca3af]">Tanpa judul</span>}</p>
        {field.helpText && <p className="text-sm text-[#475467]">{field.helpText}</p>}
      </div>
    </div>
  );
}

/** Kontrol tampilan (tidak dapat diisi) sesuai tipe field. */
export function FieldControl({ field }: { field: Pick<FormField, "type" | "placeholder" | "options"> }) {
  const placeholder = field.placeholder ?? "";
  const options = field.options?.length ? field.options : ["Opsi 1", "Opsi 2"];
  const relation = RELATION_PLACEHOLDERS[field.type];
  if (relation) {
    return (
      <div className={cn(box, "justify-between gap-2")}>
        <span className="flex min-w-0 items-center gap-2">
          {field.type === "USER" && <User className="size-4 shrink-0 text-[#6b6b6b]" />}
          {field.type === "LEAD_LABEL" && <span className="size-2.5 shrink-0 rounded-full bg-[#D64545]" />}
          <span className="truncate">{placeholder || relation}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-[#1f1f1f]" />
      </div>
    );
  }
  switch (field.type) {
    case "TEXTAREA":
      return <div className={cn(box, "h-24 items-start whitespace-normal py-2")}>{placeholder || "Tulis di sini..."}</div>;
    case "CURRENCY":
      return (
        <div className={box}>
          <span className="mr-2 text-[#6b6b6b]">Rp</span>
          {placeholder || "0"}
        </div>
      );
    case "DATE":
      return (
        <div className={box}>
          <CalendarDays className="mr-2 size-4 text-[#6b6b6b]" />
          {placeholder || "Pilih tanggal"}
        </div>
      );
    case "SELECT":
      return (
        <div className={cn(box, "justify-between")}>
          <span className="truncate">{placeholder || "Pilih salah satu"}</span>
          <ChevronDown className="size-4 shrink-0 text-[#1f1f1f]" />
        </div>
      );
    case "PHONE":
      return (
        <div className="flex min-w-0 gap-2">
          <div className={cn(box, "w-[72px] shrink-0 justify-between gap-1 px-2.5 text-[#1f1f1f]")}>
            +62
            <ChevronDown className="size-3.5 shrink-0" />
          </div>
          <div className={cn(box, "min-w-0")}>
            <span className="truncate whitespace-nowrap">{placeholder || "812-3456-7890"}</span>
          </div>
        </div>
      );
    case "MULTISELECT":
    case "RADIO":
      return (
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          {options.map((option) => (
            <span key={option} className="flex items-center gap-2 text-sm text-[#475467]">
              <span className={cn("size-4 border border-[#9ca3af]", field.type === "RADIO" ? "rounded-full" : "rounded")} />
              {option}
            </span>
          ))}
        </div>
      );
    case "BOOLEAN":
      return (
        <div className="flex gap-5 pt-1 text-sm text-[#475467]">
          {["Ya", "Tidak"].map((option) => (
            <span key={option} className="flex items-center gap-2">
              <span className="size-4 rounded-full border border-[#9ca3af]" />
              {option}
            </span>
          ))}
        </div>
      );
    default:
      return <div className={box}>{placeholder || (field.type === "NUMBER" ? "0" : "")}</div>;
  }
}

/** Field dikelompokkan per section; field sebelum section pertama tidak berjudul. */
export function groupBySection(fields: FormField[]) {
  const groups: { section: FormField | null; fields: FormField[] }[] = [];
  for (const field of fields) {
    if (field.type === "SECTION") groups.push({ section: field, fields: [] });
    else if (groups.length === 0) groups.push({ section: null, fields: [field] });
    else groups[groups.length - 1]?.fields.push(field);
  }
  return groups;
}

/** Pratinjau form Add Lead: section sebagai kartu, field dua kolom di layar lebar. */
export function FormPreview({
  fields,
  title,
  compact,
}: {
  fields: FormField[];
  title?: string;
  /** Satu kolom, mis. tampilan mobile. */
  compact?: boolean;
}) {
  return (
    <div className="space-y-5">
      {title && (
        <div>
          <h3 className="text-xl font-semibold text-[#1f1f1f]">{title}</h3>
          <p className="text-sm text-[#475467]">Isi data prospek sesuai informasi yang tersedia.</p>
        </div>
      )}
      <div className={compact ? "grid gap-3" : SECTION_GRID}>
        {groupBySection(fields).map((group, groupIndex) => {
          // Sama dengan dialog Add Lead; mode compact (mobile) tetap satu kolom.
          const wide = !compact && isWideSection(group.fields.length);
          const grid = (
            <div className={cn("grid gap-x-4 gap-y-4", !compact && fieldGrid(wide))}>
              {group.fields.map((field, index) => (
                <div key={`${field.key ?? field.label}-${index}`} className={cn("min-w-0", !compact && isFullRowField(field) && "col-span-full")}>
                  <FieldLabel field={field} />
                  <FieldControl field={field} />
                  {field.helpText && <p className="mt-1 text-xs text-[#6b6b6b]">{field.helpText}</p>}
                </div>
              ))}
            </div>
          );
          if (!group.section) {
            return (
              <div key={`group-${groupIndex}`} className={cn("rounded-xl border border-[#E4E4E7] p-4", sectionSpan(wide))}>
                {grid}
              </div>
            );
          }
          return (
            <section key={group.section.key ?? groupIndex} className={cn("overflow-hidden rounded-xl border border-[#E4E4E7]", sectionSpan(wide))}>
              <SectionHeader field={group.section} className="border-b border-[#EDEDED] bg-[#F8FAFC] px-4 py-3" />
              <div className="p-4">
                {group.fields.length === 0 ? <p className="text-sm text-[#9ca3af]">Belum ada field di section ini.</p> : grid}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
