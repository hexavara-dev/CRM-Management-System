import { CalendarDays, ChevronDown } from "lucide-react";
import type { FormField, FormFieldType } from "@/hooks/use-form-templates";
import { cn } from "@/lib/utils";

/** Field standar Lead bawaan; dapat digeser dan diatur per template, tipenya tetap. */
export const STANDARD_FIELDS: FormField[] = [
  { key: "name", label: "Nama Lengkap", type: "TEXT", required: true, placeholder: "Masukkan nama lengkap", helpText: null, options: null, standard: true },
  { key: "phone", label: "Nomor HP", type: "PHONE", required: true, placeholder: "812-3456-7890", helpText: null, options: null, standard: true },
  { key: "email", label: "Email", type: "EMAIL", required: false, placeholder: "contoh@email.com", helpText: null, options: null, standard: true },
];

/** Tipe yang memakai lebar penuh di form dua kolom. */
export const FULL_WIDTH_TYPES: FormFieldType[] = ["TEXTAREA", "MULTISELECT", "RADIO"];

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

/** Kontrol tampilan (tidak dapat diisi) sesuai tipe field. */
export function FieldControl({ field }: { field: Pick<FormField, "type" | "placeholder" | "options"> }) {
  const placeholder = field.placeholder ?? "";
  const options = field.options?.length ? field.options : ["Opsi 1", "Opsi 2"];
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

/** Pratinjau form Add Lead (dua kolom di layar lebar): field standar lalu custom field. */
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
      <div className={cn("grid gap-x-6 gap-y-4", !compact && "sm:grid-cols-2")}>
        {(fields.some((f) => f.standard) ? fields : [...STANDARD_FIELDS, ...fields]).map(
          (field, index) => (
            <div key={`${field.label}-${index}`} className={cn(!compact && FULL_WIDTH_TYPES.includes(field.type) && "sm:col-span-2")}>
              <FieldLabel field={field} />
              <FieldControl field={field} />
              {field.helpText && <p className="mt-1 text-xs text-[#6b6b6b]">{field.helpText}</p>}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
