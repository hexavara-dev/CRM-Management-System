"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FIELD_LABEL, INPUT } from "@/app/projects/create/form-styles";
import { PhotoPicker } from "@/components/projects/photo-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { newVariant, SPEC_FIELDS, specSummary, type VariantDraft } from "@/lib/unit-specs";
import { cn } from "@/lib/utils";

/** Batas stok per varian, sama dengan validasi backend. */
const MAX_STOCK = 1000;
const clampStock = (value: string) => (value !== "" && Number(value) > MAX_STOCK ? String(MAX_STOCK) : value);

/** Ukuran modal tipe: lebar, tinggi tetap, isi di-scroll per panel. */
export const TYPE_DIALOG_CLASS =
  "flex h-[min(92dvh,760px)] w-[calc(100%-2rem)] max-w-none flex-col overflow-hidden sm:max-w-7xl";
export const TYPE_FORM_CLASS = "flex min-h-0 flex-1 flex-col gap-4";

const isComplete = (variant: VariantDraft) =>
  !!variant.name.trim() && variant.stock !== "" && variant.basePrice !== "" &&
  SPEC_FIELDS.every(({ code }) => variant.specs[code] !== "");

/** Dua panel: info tipe dan daftar varian di kiri, form varian terpilih di kanan. */
export function VariantEditor({
  variants,
  onChange,
  createdUnits,
  children,
}: {
  variants: VariantDraft[];
  onChange: (update: (variants: VariantDraft[]) => VariantDraft[]) => void;
  /** Jumlah unit yang sudah dibuat; varian yang punya unit tidak dapat dihapus. */
  createdUnits: (variant: VariantDraft) => number;
  /** Info tipe (nama, gambar) di atas daftar varian. */
  children: ReactNode;
}) {
  const [selectedKey, setSelectedKey] = useState(variants[0]?.key);
  const active = variants.find((item) => item.key === selectedKey) ?? variants[0];

  // Gulir daftarnya saja (bukan modal) agar varian terpilih terlihat.
  const listRef = useRef<HTMLUListElement>(null);
  const activeKey = active?.key;
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>("[aria-current='true']");
    if (!activeKey || !list || !item) return;
    const listBox = list.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    if (itemBox.top < listBox.top) list.scrollTop -= listBox.top - itemBox.top + 8;
    else if (itemBox.bottom > listBox.bottom) list.scrollTop += itemBox.bottom - listBox.bottom + 8;
  }, [activeKey]);

  const update = (key: string, patch: Partial<VariantDraft>) =>
    onChange((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const add = () => {
    const variant = newVariant("", active);
    onChange((current) => [...current, variant]);
    setSelectedKey(variant.key);
  };
  const remove = (key: string) => {
    const index = variants.findIndex((item) => item.key === key);
    if (key === active?.key) setSelectedKey((variants[index + 1] ?? variants[index - 1])?.key);
    onChange((current) => current.filter((item) => item.key !== key));
  };

  // Browser tidak dapat menampilkan pesan untuk form varian yang tersembunyi, jadi variannya dipilih dulu.
  const revealInvalid = (event: FormEvent<HTMLDivElement>, key: string) => {
    if (key === active?.key) return;
    event.preventDefault();
    const input = event.target as HTMLInputElement;
    if (input !== input.form?.querySelector("input:invalid")) return;
    setSelectedKey(key);
    setTimeout(() => input.reportValidity(), 50);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:grid md:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
      <div className="flex shrink-0 flex-col gap-4 md:min-h-0">
        {children}
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-[#E4E4E7]">
          <div className="flex items-center justify-between gap-2 border-b border-[#E4E4E7] px-3 py-2">
            <p className="text-sm font-semibold text-[#1f1f1f]">Varian ({variants.length})</p>
            <Button type="button" variant="outline" className="h-8 text-xs" onClick={add} title="Spesifikasi disalin dari varian terpilih">
              <Plus className="mr-1 size-3.5" />
              Tambah
            </Button>
          </div>
          <ul ref={listRef} className="max-h-48 min-h-28 flex-1 space-y-1 overflow-y-auto p-2 md:max-h-none">
            {variants.map((variant, index) => {
              const selected = variant.key === active?.key;
              const created = createdUnits(variant);
              const label = variant.name.trim() || `Varian ${index + 1}`;
              return (
                <li
                  key={variant.key}
                  className={cn(
                    "flex items-center rounded-lg border border-transparent",
                    selected ? "border-[#1980C0] bg-[#E8F3FA]" : "hover:bg-[#F4F4F5]",
                  )}
                >
                  <button
                    type="button"
                    aria-current={selected}
                    onClick={() => setSelectedKey(variant.key)}
                    className="min-w-0 flex-1 cursor-pointer px-3 py-2 text-left"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm font-semibold", selected ? "text-[#1980C0]" : "text-[#1f1f1f]")}>{label}</span>
                      <span className="shrink-0 text-xs text-[#667085]">{variant.stock || 0} unit</span>
                    </span>
                    <span className={cn("block text-[11px] leading-4", isComplete(variant) ? "text-[#667085]" : "text-[#B54708]")}>
                      {isComplete(variant) ? specSummary(variant.specs) : "Belum lengkap"}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus varian ${label}`}
                    title={created > 0 ? `${created} unit sudah dibuat dari varian ini` : "Hapus varian"}
                    disabled={variants.length === 1 || created > 0}
                    onClick={() => remove(variant.key)}
                    className="mr-1 size-8 shrink-0 text-[#D64545] hover:bg-[#FDECEC] hover:text-[#B42318]"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="shrink-0 rounded-lg border border-[#E4E4E7] p-4 md:min-h-0 md:overflow-y-auto">
        {variants.map((variant, index) => {
          const created = createdUnits(variant);
          return (
            <div
              key={variant.key}
              onInvalidCapture={(event) => revealInvalid(event, variant.key)}
              className={cn("space-y-5", variant.key !== active?.key && "hidden")}
            >
              <div>
                <p className="text-base font-semibold text-[#1f1f1f]">{variant.name.trim() || `Varian ${index + 1}`}</p>
                <p className="text-xs text-[#667085]">
                  {created > 0 ? `${created} unit sudah dibuat dari varian ini.` : "Stok, harga, dan spesifikasi unit untuk varian ini."}
                </p>
              </div>
              <div className="grid gap-x-4 gap-y-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,1.2fr)]">
                <label>
                  <span className={FIELD_LABEL}>Nama varian</span>
                  <Input
                    required
                    maxLength={150}
                    value={variant.name}
                    placeholder="Contoh: Standard"
                    className={INPUT}
                    onChange={(event) => update(variant.key, { name: event.target.value })}
                  />
                </label>
                <label>
                  <span className={FIELD_LABEL}>Stock</span>
                  <Input
                    type="number"
                    required
                    min={created}
                    max={MAX_STOCK}
                    value={variant.stock}
                    placeholder="0"
                    className={INPUT}
                    onChange={(event) => update(variant.key, { stock: clampStock(event.target.value) })}
                  />
                </label>
                <label>
                  <span className={FIELD_LABEL}>Harga dasar</span>
                  <RupiahInput
                    required
                    value={variant.basePrice}
                    placeholder="0"
                    // Tanpa padding pembungkus agar harga miliaran tidak terpotong.
                    className={cn(INPUT, "px-0")}
                    onValueChange={(basePrice) => update(variant.key, { basePrice })}
                  />
                </label>
              </div>
              <div>
                <p className="mb-3 border-t border-[#EDEDED] pt-4 text-sm font-semibold text-[#1f1f1f]">Spesifikasi unit</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                  {SPEC_FIELDS.map((field) => (
                    <label key={field.code}>
                      <span className={FIELD_LABEL}>
                        {field.name}
                        {"unit" in field ? ` (${field.unit})` : ""}
                      </span>
                      <Input
                        type="number"
                        required
                        min={0}
                        value={variant.specs[field.code]}
                        placeholder="0"
                        className={INPUT}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) =>
                          update(variant.key, { specs: { ...variant.specs, [field.code]: event.target.value } })
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="border-t border-[#EDEDED] pt-4">
                <PhotoPicker
                  label="Foto varian"
                  photos={variant.photos}
                  onChange={(change) =>
                    onChange((current) =>
                      current.map((item) => (item.key === variant.key ? { ...item, photos: change(item.photos) } : item)),
                    )
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Pesan bila nama varian kembar; null bila aman. */
export function duplicateVariantName(variants: VariantDraft[]): string | null {
  const names = variants.map((item) => item.name.trim().toLocaleLowerCase("id-ID"));
  return new Set(names).size === names.length ? null : "Nama varian dalam satu tipe tidak boleh sama.";
}
