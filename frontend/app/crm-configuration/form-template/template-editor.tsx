"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  AtSign,
  Banknote,
  Calendar,
  ChevronDown,
  CircleDot,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Hash,
  Heading,
  Info,
  Lock,
  type LucideIcon,
  Monitor,
  MousePointerClick,
  Phone,
  Plus,
  Save,
  Settings2,
  Smartphone,
  SquareCheck,
  ToggleLeft,
  Trash2,
  Type,
  Database,
} from "lucide-react";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorText } from "@/components/ui/error-text";
import { LabelText } from "@/components/ui/label-text";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  CHOICE_TYPES,
  SYSTEM_FIELD_KEYS,
  isSystemKey,
  systemDefinition,
  systemField,
  useSaveFormTemplate,
  type CustomFieldType,
  type FormField,
  type FormFieldType,
  type FormTemplate,
  type SystemFieldKey,
} from "@/hooks/use-form-templates";
import { cn } from "@/lib/utils";
import { LEAD_LABEL_ICONS, LabelIcon } from "../leads-label/label-icons";
import { Switch } from "../leads-label/toggle";
import { DEFAULT_TEMPLATE_FIELDS, FULL_WIDTH_TYPES, FieldControl, FieldLabel, FormPreview, SectionHeader } from "./form-preview";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_COLOR = "#3B82F6";
/** Termasuk section dan field sistem. */
const MAX_FIELDS = 60;
const MAX_OPTIONS = 50;
const LIST_URL = "/crm-configuration/form-template";
const PALETTE_MIME = "application/x-form-field-type";
const SYSTEM_PREFIX = "system:";

/** Palet tipe custom field. File menyusul. */
const PALETTE: { type: CustomFieldType; label: string; icon: LucideIcon }[] = [
  { type: "TEXT", label: "Teks Singkat", icon: Type },
  { type: "TEXTAREA", label: "Teks Panjang", icon: AlignLeft },
  { type: "SELECT", label: "Dropdown", icon: ChevronDown },
  { type: "RADIO", label: "Pilihan Ganda", icon: CircleDot },
  { type: "MULTISELECT", label: "Checkbox", icon: SquareCheck },
  { type: "DATE", label: "Tanggal", icon: Calendar },
  { type: "NUMBER", label: "Angka", icon: Hash },
  { type: "CURRENCY", label: "Rupiah", icon: Banknote },
  { type: "BOOLEAN", label: "Ya / Tidak", icon: ToggleLeft },
  { type: "PHONE", label: "Telepon", icon: Phone },
  { type: "EMAIL", label: "Email", icon: AtSign },
];
const TYPE_META = Object.fromEntries(PALETTE.map((p) => [p.type, p])) as Record<
  CustomFieldType,
  (typeof PALETTE)[number]
>;

/** Field sistem opsional yang dapat ditambahkan dari palet. */
const OPTIONAL_SYSTEM_KEYS = SYSTEM_FIELD_KEYS.filter((key) => !systemDefinition(key).always);

const isSection = (field: { type: FormFieldType }) => field.type === "SECTION";
const systemKeyOf = (field: { key?: string; standard?: boolean }) =>
  field.standard && isSystemKey(field.key) ? field.key : null;

type EditorField = {
  uid: string;
  key?: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder: string;
  helpText: string;
  options: { uid: string; value: string }[];
  standard?: boolean;
  icon?: string;
};

type Info = { name: string; description: string; icon: string; color: string; isActive: boolean; isDefault: boolean };
type Errors = { name?: string; color?: string; form?: string; fields: Record<string, { label?: string; options?: string }> };

let counter = 0;
const uid = () => `f${Date.now().toString(36)}${(counter++).toString(36)}`;

const toEditor = (field: FormField): EditorField => ({
  uid: uid(),
  key: field.key,
  label: field.label,
  type: field.type,
  required: field.required,
  placeholder: field.placeholder ?? "",
  helpText: field.helpText ?? "",
  options: (field.options ?? []).map((value) => ({ uid: uid(), value })),
  standard: field.standard,
  ...(field.type === "SECTION" ? { icon: field.icon ?? "info" } : {}),
});

const toField = (field: EditorField): FormField => ({
  ...(field.key ? { key: field.key } : {}),
  label: field.label.trim(),
  type: field.type,
  required: field.required,
  placeholder: field.placeholder.trim() || null,
  helpText: field.helpText.trim() || null,
  options:
    CHOICE_TYPES.includes(field.type) || field.type === "GENDER"
      ? field.options.map((o) => o.value.trim()).filter(Boolean)
      : null,
  ...(field.standard ? { standard: true } : {}),
  ...(field.type === "SECTION" ? { icon: field.icon ?? null } : {}),
});

/** Payload API: penanda `standard` tidak dikirim; field standar dikenali dari kuncinya. */
const toPayloadField = ({ standard: _standard, ...field }: FormField): FormField => field;

function newSection(existing: EditorField[]): EditorField {
  const taken = new Set(existing.filter(isSection).map((f) => f.label.trim().toLowerCase()));
  let label = "Section Baru";
  for (let n = 2; taken.has(label.toLowerCase()); n += 1) label = `Section Baru ${n}`;
  return { uid: uid(), label, type: "SECTION", required: false, placeholder: "", helpText: "", options: [], icon: "info" };
}

function newField(type: CustomFieldType, existing: EditorField[]): EditorField {
  const base = TYPE_META[type].label;
  const taken = new Set(existing.filter((f) => !isSection(f)).map((f) => f.label.trim().toLowerCase()));
  let label = base;
  for (let n = 2; taken.has(label.toLowerCase()); n += 1) label = `${base} ${n}`;
  return {
    uid: uid(),
    label,
    type,
    required: false,
    placeholder: "",
    helpText: "",
    options: CHOICE_TYPES.includes(type) ? ["Opsi 1", "Opsi 2"].map((value) => ({ uid: uid(), value })) : [],
  };
}

function validate(info: Info, fields: EditorField[]): Errors {
  const errors: Errors = { fields: {} };
  if (!info.name.trim()) errors.name = "Nama template wajib diisi";
  else if (info.name.trim().length > 150) errors.name = "Nama maksimal 150 karakter";
  if (!HEX.test(info.color)) errors.color = "Warna harus format hex, mis. #3B82F6";
  if (fields.length > MAX_FIELDS) errors.form = `Maksimal ${MAX_FIELDS} field`;
  const seen = new Map<string, string>();
  for (const field of fields) {
    const fieldErrors: { label?: string; options?: string } = {};
    const label = field.label.trim().toLowerCase();
    // Label section dan label field diperiksa terpisah.
    const seenKey = `${isSection(field) ? "s" : "f"}:${label}`;
    if (!label) fieldErrors.label = isSection(field) ? "Judul section wajib diisi" : "Label wajib diisi";
    else if (field.label.trim().length > 100) fieldErrors.label = "Label maksimal 100 karakter";
    else if (seen.has(seenKey)) fieldErrors.label = isSection(field) ? "Judul sudah dipakai section lain" : "Label sudah dipakai field lain";
    seen.set(seenKey, field.uid);
    if (CHOICE_TYPES.includes(field.type)) {
      const options = field.options.map((o) => o.value.trim()).filter(Boolean);
      if (options.length === 0) fieldErrors.options = "Isi minimal satu pilihan";
      else if (options.length > MAX_OPTIONS) fieldErrors.options = `Maksimal ${MAX_OPTIONS} pilihan`;
      else if (options.some((o) => o.length > 100)) fieldErrors.options = "Pilihan maksimal 100 karakter";
      else if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) fieldErrors.options = "Pilihan tidak boleh sama";
    }
    if (fieldErrors.label || fieldErrors.options) errors.fields[field.uid] = fieldErrors;
  }
  return errors;
}

const hasErrors = (e: Errors) => !!(e.name || e.color || e.form || Object.keys(e.fields).length);

function Card({ icon: Icon, title, actions, children, className }: { icon: LucideIcon; title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-[#E4E4E7] bg-white", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-[#EDEDED] bg-[#F8FAFC] px-3 py-2.5">
        <h2 className="flex items-center gap-2 font-semibold text-[#1f1f1f]">
          <Icon className="size-5" />
          {title}
        </h2>
        {actions}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

const inputClass = (error?: string) =>
  cn(
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-60",
    error && "border-destructive",
  );

/** Field custom di kanvas: dapat dipilih, digeser, diduplikat, dan dihapus. */
function CanvasField({
  field,
  selected,
  invalid,
  editable,
  compact,
  onSelect,
  onDuplicate,
  onRemove,
}: {
  field: EditorField;
  selected: boolean;
  invalid: boolean;
  editable: boolean;
  compact: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.uid, disabled: !editable });
  const preview = toField(field);
  const systemKey = systemKeyOf(field);
  const removable = !systemKey || !systemDefinition(systemKey).always;
  const section = isSection(field);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      className={cn(
        "group relative flex cursor-pointer gap-2 rounded-lg border p-3 transition-colors",
        selected ? "border-[#1980C0] bg-[#E5F1FA]/60" : invalid ? "border-[#D64545]/60" : "border-transparent hover:border-[#E4E4E7] hover:bg-[#F8FAFC]",
        !compact && FULL_WIDTH_TYPES.includes(field.type) && "sm:col-span-2",
        section && "mt-3 border-b-[#E4E4E7] first:mt-0",
        isDragging && "z-10 bg-white shadow-lg",
      )}
    >
      {editable && (
        <button
          type="button"
          aria-label={`Geser ${field.label || "field"}`}
          onClick={(e) => e.stopPropagation()}
          className={cn("shrink-0 cursor-grab text-[#9ca3af] active:cursor-grabbing", section ? "mt-1" : "mt-7")}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {section ? (
          <SectionHeader field={preview} />
        ) : (
          <>
            <FieldLabel field={preview} className={selected ? "text-[#1980C0]" : undefined} />
            <FieldControl field={preview} />
            {preview.helpText && <p className="mt-1 text-xs text-[#6b6b6b]">{preview.helpText}</p>}
          </>
        )}
      </div>
      {editable && (
        <div className={cn("absolute right-2 top-2 flex gap-1", selected ? "flex" : "hidden group-hover:flex")}>
          {!field.standard && !section && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Duplikat ${field.label}`} onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="text-[#1980C0] hover:text-[#1980C0]">
              <Copy className="size-4" />
            </Button>
          )}
          {removable && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Hapus ${field.label}`} onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-[#D64545] hover:text-[#D64545]">
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function OptionRow({ id, value, editable, onChange, onRemove }: { id: string; value: string; editable: boolean; onChange: (v: string) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled: !editable });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex items-center gap-2">
      <button type="button" aria-label="Geser pilihan" className="cursor-grab text-[#9ca3af]" {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <input value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} className={inputClass()} aria-label="Pilihan" />
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus pilihan" disabled={!editable} onClick={onRemove} className="text-[#D64545] hover:text-[#D64545]">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

/** Pengaturan section: judul, deskripsi, dan ikon. */
function SectionSettings({ field, error, onChange }: { field: EditorField; error?: string; onChange: (patch: Partial<EditorField>) => void }) {
  return (
    <>
      <p className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs text-[#475467]">
        Section mengelompokkan field di bawahnya sampai section berikutnya. Tidak menyimpan data.
      </p>
      <div>
        <LabelText className="mb-1.5 block">
          Judul Section <span className="text-[#D64545]">*</span>
        </LabelText>
        <input value={field.label} maxLength={100} onChange={(e) => onChange({ label: e.target.value })} className={inputClass(error)} />
        {error && <ErrorText className="mt-1">{error}</ErrorText>}
      </div>
      <div>
        <LabelText className="mb-1.5 block">Deskripsi</LabelText>
        <input value={field.helpText} maxLength={200} onChange={(e) => onChange({ helpText: e.target.value })} placeholder="Opsional" className={inputClass()} />
      </div>
      <div>
        <LabelText className="mb-1.5 block">Ikon</LabelText>
        <div role="radiogroup" aria-label="Pilih ikon section" className="grid max-h-48 grid-cols-7 gap-1.5 overflow-y-auto rounded-lg border border-[#E4E4E7] p-2">
          {Object.entries(LEAD_LABEL_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={field.icon === key}
              aria-label={key}
              title={key}
              onClick={() => onChange({ icon: key })}
              className={cn("flex aspect-square items-center justify-center rounded-md border", field.icon === key ? "border-[#1980C0] bg-[#E5F1FA] text-[#1980C0]" : "border-[#E4E4E7] text-[#6b6b6b] hover:bg-muted")}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/** Editor template form 3 kolom: informasi & palet, kanvas preview, pengaturan field. */
export function TemplateEditor({ template, canWrite }: { template?: FormTemplate; canWrite: boolean }) {
  const router = useRouter();
  const save = useSaveFormTemplate();

  const initialInfo = useMemo<Info>(
    () => ({
      name: template?.name ?? "",
      description: template?.description ?? "",
      icon: template?.icon ?? "home",
      color: template?.color ?? DEFAULT_COLOR,
      isActive: template?.isActive ?? true,
      isDefault: template?.isDefault ?? false,
    }),
    [template],
  );
  const initialFields = useMemo(() => (template ? template.fields : DEFAULT_TEMPLATE_FIELDS).map(toEditor), [template]);
  const [info, setInfo] = useState<Info>(initialInfo);
  const [fields, setFields] = useState<EditorField[]>(initialFields);
  const [selected, setSelected] = useState<string | null>(initialFields[0]?.uid ?? null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [infoOpen, setInfoOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const saved = useRef(JSON.stringify({ info: initialInfo, fields: initialFields.map(toField) }));

  const snapshot = JSON.stringify({ info, fields: fields.map(toField) });
  const dirty = snapshot !== saved.current;
  const errors = validate(info, fields);
  const shown: Errors = submitted ? errors : { fields: {} };
  const current = fields.find((f) => f.uid === selected);
  const compact = device === "mobile";

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const patchField = (id: string, patch: Partial<EditorField>) =>
    setFields((list) => list.map((f) => (f.uid === id ? { ...f, ...patch } : f)));

  const usedSystemKeys = new Set(fields.map(systemKeyOf).filter(Boolean));
  const canAddSystem = (key: SystemFieldKey) => {
    const requires = systemDefinition(key).requires as SystemFieldKey | undefined;
    return !usedSystemKeys.has(key) && (!requires || systemDefinition(requires).always || usedSystemKeys.has(requires));
  };

  const append = (field: EditorField) => {
    setFields((list) => [...list, field]);
    setSelected(field.uid);
  };

  /** Dari palet: tipe custom field, "SECTION", atau "system:<kunci>". */
  const addFromPalette = (value: string) => {
    if (!canWrite || fields.length >= MAX_FIELDS) return;
    if (value === "SECTION") return append(newSection(fields));
    if (value.startsWith(SYSTEM_PREFIX)) {
      const key = value.slice(SYSTEM_PREFIX.length);
      if (isSystemKey(key) && canAddSystem(key)) append(toEditor(systemField(key)));
      return;
    }
    if (value in TYPE_META) append(newField(value as CustomFieldType, fields));
  };

  const duplicateField = (field: EditorField) => {
    // Salinan memakai kunci baru (key dikosongkan) agar tidak bentrok dengan field asal.
    const taken = new Set(fields.map((f) => f.label.trim().toLowerCase()));
    let label = `${field.label} (Salinan)`;
    for (let n = 2; taken.has(label.toLowerCase()); n += 1) label = `${field.label} (Salinan ${n})`;
    const copy = { ...field, uid: uid(), key: undefined, label, options: field.options.map((o) => ({ uid: uid(), value: o.value })) };
    setFields((list) => {
      const index = list.findIndex((f) => f.uid === field.uid);
      const next = [...list];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setSelected(copy.uid);
  };

  const removeField = (id: string) => {
    setFields((list) => {
      const removed = list.find((f) => f.uid === id);
      const key = removed ? systemKeyOf(removed) : null;
      // Field yang bergantung (mis. Tipe Rumah pada Project Diminati) ikut dihapus.
      const dependents = new Set(
        list.filter((f) => { const k = systemKeyOf(f); return !!key && !!k && systemDefinition(k).requires === key; }).map((f) => f.uid),
      );
      return list.filter((f) => f.uid !== id && !dependents.has(f.uid));
    });
    if (selected === id) setSelected(null);
  };

  const onFieldDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setFields((list) => arrayMove(list, list.findIndex((f) => f.uid === active.id), list.findIndex((f) => f.uid === over.id)));
  };

  const onOptionDragEnd = ({ active, over }: DragEndEvent) => {
    if (!current || !over || active.id === over.id) return;
    const options = current.options;
    patchField(current.uid, {
      options: arrayMove(options, options.findIndex((o) => o.uid === active.id), options.findIndex((o) => o.uid === over.id)),
    });
  };

  const leave = () => {
    if (dirty && !window.confirm("Perubahan belum disimpan. Tinggalkan halaman ini?")) return;
    router.push(LIST_URL);
  };

  const submit = async () => {
    setSubmitted(true);
    if (hasErrors(errors)) {
      const firstInvalid = fields.find((f) => errors.fields[f.uid]);
      if (firstInvalid) setSelected(firstInvalid.uid);
      return;
    }
    try {
      const result = await save.mutateAsync({
        id: template?.id,
        data: {
          name: info.name.trim(),
          description: info.description.trim() || null,
          icon: info.icon,
          color: info.color.toUpperCase(),
          isActive: info.isActive,
          isDefault: info.isDefault,
          fields: fields.map(toField).map(toPayloadField),
        },
      });
      saved.current = snapshot;
      router.push(template ? LIST_URL : `${LIST_URL}/${result.id}`);
    } catch {
      // Pesan error ditampilkan oleh mutation.
    }
  };

  const title = template ? "Edit Form Template" : "Tambah Form Template";

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3 empty:hidden">
          <SidebarOpenTrigger />
        </header>
        <div className="space-y-4 p-4">
          <Breadcrumb>
            <BreadcrumbList className="gap-1 text-sm sm:gap-1.5">
              <BreadcrumbItem>
                <span className="text-[#1980C0]">CRM Configuration</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="[&>svg]:size-3.5" />
              <BreadcrumbItem>
                <Link href={LIST_URL} onClick={(e) => { e.preventDefault(); leave(); }} className="text-[#1980C0] hover:underline">
                  Konfigurasi Form Template
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="[&>svg]:size-3.5" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium text-[#1f1f1f]">{template ? "Edit Template" : "Tambah Template"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#E5F1FA] text-[#1980C0] sm:size-14">
                <FileText className="size-6 sm:size-7" />
              </span>
              <div>
                <h1 className="type-h3 text-[#1f1f1f]">{title}</h1>
                <p className="text-sm text-[#475467]">Atur dan susun field pada form sesuai kebutuhan pengumpulan data Lead.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)} className="text-[#1980C0] hover:text-[#1980C0]">
                <Eye className="size-4" />
                Preview
              </Button>
              <Button type="button" variant="outline" onClick={leave} disabled={save.isPending}>
                Batal
              </Button>
              {canWrite && (
                <Button type="button" onClick={submit} disabled={save.isPending} className="bg-[#1980C0] text-white hover:bg-[#166ea6]">
                  <Save className="size-4" />
                  {save.isPending ? "Menyimpan..." : template ? "Simpan Perubahan" : "Simpan"}
                </Button>
              )}
            </div>
          </div>

          {template && (
            <p className="flex items-start gap-2 rounded-lg bg-[#E5F1FA] px-3 py-2 text-sm text-[#1980C0]">
              <Info className="mt-0.5 size-4 shrink-0" />
              {template.versionLocked
                ? `Versi ${template.version} sudah dipakai Lead. Menyimpan perubahan field akan membuat versi baru; Lead yang sudah ada tetap memakai versi ${template.version}.`
                : `Versi ${template.version}. Belum dipakai Lead, perubahan field langsung memperbarui versi ini.`}
            </p>
          )}
          {submitted && hasErrors(errors) && (
            <p className="rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#D64545]">
              {errors.form ?? "Masih ada isian yang belum benar. Periksa field yang ditandai merah."}
            </p>
          )}

          <div className="grid items-start gap-4 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
            {/* Kolom kiri: informasi template dan palet field */}
            <div className="space-y-4">
              <Card
                icon={FileText}
                title="Informasi Template"
                actions={
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Buka/tutup informasi template" onClick={() => setInfoOpen(!infoOpen)}>
                    <ChevronDown className={cn("size-4 transition-transform", infoOpen && "rotate-180")} />
                  </Button>
                }
              >
                {infoOpen ? (
                  <fieldset disabled={!canWrite} className="space-y-4">
                    <div>
                      <LabelText className="mb-1.5 block">
                        Nama Template <span className="text-[#D64545]">*</span>
                      </LabelText>
                      <input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} maxLength={150} placeholder="Contoh: Form Lead Properti" className={inputClass(shown.name)} />
                      {shown.name && <ErrorText className="mt-1">{shown.name}</ErrorText>}
                    </div>
                    <div>
                      <LabelText className="mb-1.5 block">Deskripsi</LabelText>
                      <textarea
                        value={info.description}
                        onChange={(e) => setInfo({ ...info, description: e.target.value })}
                        maxLength={500}
                        rows={3}
                        placeholder="Kapan template ini dipakai"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="grid grid-cols-[auto_1fr] items-end gap-3">
                      <div>
                        <LabelText className="mb-1.5 block">Ikon</LabelText>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" aria-label="Pilih ikon" className="rounded-lg">
                              <LabelIcon icon={info.icon} color={HEX.test(info.color) ? info.color : DEFAULT_COLOR} className="flex size-10 items-center justify-center rounded-lg" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="z-[999] w-80 p-2">
                            <div role="radiogroup" aria-label="Pilih ikon" className="grid max-h-56 grid-cols-8 gap-1.5 overflow-y-auto">
                              {Object.entries(LEAD_LABEL_ICONS).map(([key, Icon]) => (
                                <button
                                  key={key}
                                  type="button"
                                  role="radio"
                                  aria-checked={info.icon === key}
                                  aria-label={key}
                                  title={key}
                                  onClick={() => setInfo({ ...info, icon: key })}
                                  className={cn("flex aspect-square items-center justify-center rounded-md border", info.icon === key ? "border-[#1980C0] bg-[#E5F1FA] text-[#1980C0]" : "border-[#E4E4E7] text-[#6b6b6b] hover:bg-muted")}
                                >
                                  <Icon className="size-4" />
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <LabelText className="mb-1.5 block">Warna</LabelText>
                        <div className="flex items-center gap-2">
                          <input type="color" aria-label="Pilih warna" value={HEX.test(info.color) ? info.color : DEFAULT_COLOR} onChange={(e) => setInfo({ ...info, color: e.target.value.toUpperCase() })} className="h-10 w-11 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1" />
                          <input aria-label="Kode warna hex" value={info.color} onChange={(e) => setInfo({ ...info, color: e.target.value.trim() })} maxLength={7} className={cn(inputClass(shown.color), "font-mono uppercase")} />
                        </div>
                      </div>
                    </div>
                    {shown.color && <ErrorText>{shown.color}</ErrorText>}
                    <div className="space-y-3">
                      <div>
                        <LabelText className="mb-1.5 block">Status</LabelText>
                        <div className="flex items-center gap-3">
                          <Switch label="Status aktif" checked={info.isActive} disabled={!canWrite || info.isDefault} onChange={(isActive) => setInfo({ ...info, isActive })} />
                          <span className="text-sm text-[#1f1f1f]">{info.isActive ? "Active" : "Inactive"}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <Switch
                            label="Template default"
                            checked={info.isDefault}
                            disabled={!canWrite || !!template?.isDefault}
                            onChange={(isDefault) => setInfo({ ...info, isDefault, isActive: isDefault ? true : info.isActive })}
                          />
                          <span className="text-sm text-[#1f1f1f]">Template default</span>
                        </div>
                        <p className="mt-1 text-xs text-[#6b6b6b]">
                          {template?.isDefault ? "Untuk memindahkan, jadikan template lain sebagai default." : "Dipakai otomatis saat menambah Lead."}
                        </p>
                      </div>
                    </div>
                  </fieldset>
                ) : (
                  <p className="truncate text-sm text-[#475467]">{info.name || "Belum ada nama"}</p>
                )}
              </Card>

              {canWrite && (
                <Card icon={MousePointerClick} title="Tambah Field">
                  <p className="mb-3 text-sm text-[#475467]">Klik atau drag & drop field ke form di samping.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PALETTE.map(({ type, label, icon: Icon }) => (
                      <button
                        key={label}
                        type="button"
                        disabled={fields.length >= MAX_FIELDS}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData(PALETTE_MIME, type)}
                        onClick={() => addFromPalette(type)}
                        title={`Tambah ${label}`}
                        className="relative flex flex-col items-center gap-1 rounded-lg border border-[#E4E4E7] px-1.5 py-2 text-xs text-[#1f1f1f] transition-colors hover:border-[#1980C0] hover:bg-[#E5F1FA]/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#E4E4E7] disabled:hover:bg-transparent"
                      >
                        <Icon className="size-4" />
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={fields.length >= MAX_FIELDS}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData(PALETTE_MIME, "SECTION")}
                      onClick={() => addFromPalette("SECTION")}
                      title="Tambah section untuk mengelompokkan field"
                      className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#1980C0]/60 px-1.5 py-2 text-xs text-[#1980C0] transition-colors hover:bg-[#E5F1FA]/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Heading className="size-4" />
                      Section
                    </button>
                  </div>
                </Card>
              )}

              {canWrite && (
                <Card icon={Database} title="Field Sistem">
                  <p className="mb-3 text-sm text-[#475467]">Terhubung ke data CRM. Masing-masing hanya dapat dipakai sekali.</p>
                  <div className="space-y-1.5">
                    {OPTIONAL_SYSTEM_KEYS.map((key) => {
                      const def = systemDefinition(key);
                      const used = usedSystemKeys.has(key);
                      const blocked = !used && !canAddSystem(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={used || blocked || fields.length >= MAX_FIELDS}
                          draggable={!used && !blocked}
                          onDragStart={(e) => e.dataTransfer.setData(PALETTE_MIME, `${SYSTEM_PREFIX}${key}`)}
                          onClick={() => addFromPalette(`${SYSTEM_PREFIX}${key}`)}
                          title={
                            used
                              ? "Sudah ada di form"
                              : blocked && def.requires
                                ? `Tambahkan ${systemDefinition(def.requires as SystemFieldKey).label} terlebih dahulu`
                                : `Tambah ${def.label}`
                          }
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#E4E4E7] px-2.5 py-1.5 text-left text-xs text-[#1f1f1f] transition-colors hover:border-[#1980C0] hover:bg-[#E5F1FA]/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#E4E4E7] disabled:hover:bg-transparent"
                        >
                          <span className="truncate">{def.label}</span>
                          {used ? <span className="shrink-0 text-[#1E9E55]">Dipakai</span> : <Plus className="size-3.5 shrink-0 text-[#1980C0]" />}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>

            {/* Kolom tengah: kanvas preview & susun form */}
            <Card
              icon={Monitor}
              title="Preview & Susun Form"
              actions={
                <div className="flex gap-1 rounded-lg border border-[#E4E4E7] bg-white p-0.5">
                  {(
                    [
                      ["desktop", "Desktop", Monitor],
                      ["mobile", "Mobile", Smartphone],
                    ] as const
                  ).map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={device === value}
                      onClick={() => setDevice(value)}
                      className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm", device === value ? "bg-[#E5F1FA] text-[#1980C0]" : "text-[#475467]")}
                    >
                      <Icon className="size-4" />
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              <div
                onDragOver={(e) => {
                  if (!canWrite || !e.dataTransfer.types.includes(PALETTE_MIME)) return;
                  e.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={(e) => {
                  setDropActive(false);
                  const value = e.dataTransfer.getData(PALETTE_MIME);
                  if (value) addFromPalette(value);
                }}
                className={cn("mx-auto rounded-xl border border-[#EDEDED] p-3 transition-colors sm:p-4", compact ? "max-w-sm" : "max-w-none", dropActive && "border-dashed border-[#1980C0] bg-[#E5F1FA]/40")}
              >
                <div className="mb-5">
                  <h3 className="text-xl font-semibold text-[#1f1f1f]">{info.name.trim() || "Nama template"}</h3>
                  <p className="text-sm text-[#475467]">Isi data prospek sesuai informasi yang tersedia.</p>
                </div>
                {fields.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#E4E4E7] py-8 text-center text-sm text-[#6b6b6b]">
                    {canWrite ? "Klik atau drag field dari panel Tambah Field untuk menambahkan field." : "Template ini belum punya field."}
                  </p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onFieldDragEnd}>
                    <SortableContext items={fields.map((f) => f.uid)} strategy={rectSortingStrategy}>
                      <div className={cn("grid gap-x-4 gap-y-1", !compact && "sm:grid-cols-2")}>
                        {fields.map((field) => (
                          <CanvasField
                            key={field.uid}
                            field={field}
                            selected={selected === field.uid}
                            invalid={!!shown.fields[field.uid]}
                            editable={canWrite}
                            compact={compact}
                            onSelect={() => setSelected(field.uid)}
                            onDuplicate={() => duplicateField(field)}
                            onRemove={() => removeField(field.uid)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </Card>

            {/* Kolom kanan: pengaturan field terpilih */}
            <Card icon={Settings2} title="Pengaturan Field" className="xl:sticky xl:top-4">
              {!current ? (
                <p className="py-8 text-center text-sm text-[#6b6b6b]">Pilih field atau section di form untuk mengatur label, tipe, dan pilihannya.</p>
              ) : (
                <fieldset disabled={!canWrite} className="space-y-4">
                  {isSection(current) ? (
                    <SectionSettings
                      field={current}
                      error={shown.fields[current.uid]?.label}
                      onChange={(patch) => patchField(current.uid, patch)}
                    />
                  ) : (
                  <>
                  {systemKeyOf(current) && (
                    <p className="flex gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs text-[#475467]">
                      <Lock className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Field sistem dari <strong>{systemDefinition(systemKeyOf(current) as SystemFieldKey).source}</strong>. Tipenya tetap
                        {systemDefinition(systemKeyOf(current) as SystemFieldKey).forceRequired ? " dan selalu wajib diisi" : ""}
                        {systemDefinition(systemKeyOf(current) as SystemFieldKey).always ? "; tidak dapat dihapus" : ""}.
                      </span>
                    </p>
                  )}
                  <div>
                    <LabelText className="mb-1.5 block">
                      Label Field <span className="text-[#D64545]">*</span>
                    </LabelText>
                    <input value={current.label} maxLength={100} onChange={(e) => patchField(current.uid, { label: e.target.value })} className={inputClass(shown.fields[current.uid]?.label)} />
                    {shown.fields[current.uid]?.label && <ErrorText className="mt-1">{shown.fields[current.uid]?.label}</ErrorText>}
                  </div>
                  {systemKeyOf(current) ? null : (
                  <div>
                    <LabelText className="mb-1.5 block">Tipe Field</LabelText>
                    <Select
                      disabled={!!current.standard}
                      value={current.type}
                      onValueChange={(value) => {
                        const type = value as FormFieldType;
                        patchField(current.uid, {
                          type,
                          options: CHOICE_TYPES.includes(type) && current.options.length === 0 ? ["Opsi 1", "Opsi 2"].map((v) => ({ uid: uid(), value: v })) : current.options,
                        });
                      }}
                    >
                      <SelectTrigger className="h-10 w-full" aria-label="Tipe field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PALETTE.map(({ type, label, icon: Icon }) => (
                          <SelectItem key={type} value={type}>
                            <span className="flex items-center gap-2">
                              <Icon className="size-4" />
                              {label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}

                  {CHOICE_TYPES.includes(current.type) && !current.standard && (
                    <div>
                      <LabelText className="mb-1.5 block">
                        Pilihan ({TYPE_META[current.type as CustomFieldType].label}) <span className="text-[#D64545]">*</span>
                      </LabelText>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onOptionDragEnd}>
                        <SortableContext items={current.options.map((o) => o.uid)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2">
                            {current.options.map((option) => (
                              <OptionRow
                                key={option.uid}
                                id={option.uid}
                                value={option.value}
                                editable={canWrite}
                                onChange={(value) => patchField(current.uid, { options: current.options.map((o) => (o.uid === option.uid ? { ...o, value } : o)) })}
                                onRemove={() => patchField(current.uid, { options: current.options.filter((o) => o.uid !== option.uid) })}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                      {shown.fields[current.uid]?.options && <ErrorText className="mt-1">{shown.fields[current.uid]?.options}</ErrorText>}
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canWrite || current.options.length >= MAX_OPTIONS}
                        onClick={() => patchField(current.uid, { options: [...current.options, { uid: uid(), value: "" }] })}
                        className="mt-2 w-full border-dashed text-[#1980C0] hover:text-[#1980C0]"
                      >
                        <Plus className="size-4" />
                        Tambah Pilihan
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-[#1f1f1f]">Wajib Diisi</span>
                    <Switch
                      label="Wajib diisi"
                      checked={current.required}
                      disabled={!canWrite || !!(systemKeyOf(current) && systemDefinition(systemKeyOf(current) as SystemFieldKey).forceRequired)}
                      onChange={(required) => patchField(current.uid, { required })}
                    />
                  </div>
                  <div>
                    <LabelText className="mb-1.5 block">Placeholder</LabelText>
                    <input value={current.placeholder} maxLength={200} onChange={(e) => patchField(current.uid, { placeholder: e.target.value })} placeholder="Opsional" className={inputClass()} />
                  </div>
                  <div>
                    <LabelText className="mb-1.5 block">Teks Bantuan</LabelText>
                    <input value={current.helpText} maxLength={200} onChange={(e) => patchField(current.uid, { helpText: e.target.value })} placeholder="Opsional, tampil di bawah field" className={inputClass()} />
                  </div>
                  </>
                  )}
                </fieldset>
              )}
            </Card>
          </div>
        </div>
      </SidebarInset>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto p-4 sm:max-w-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Preview Form</DialogTitle>
            <DialogDescription>Tampilan form saat sales menambah Lead (belum disimpan).</DialogDescription>
          </DialogHeader>
          <FormPreview title={info.name.trim() || "Nama template"} fields={fields.map(toField)} />
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
