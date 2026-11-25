"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronLeft, ChevronRight, ImagePlus, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { duplicateVariantName, TYPE_DIALOG_CLASS, TYPE_FORM_CLASS, VariantEditor } from "@/components/projects/variant-editor";
import { newVariant, SPEC_FIELDS, type VariantDraft } from "@/lib/unit-specs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FIELD_LABEL, INPUT } from "./form-styles";
import { compressImage, PHOTO_MAX_EDGE } from "@/lib/compress-image";
import { ImageProcessingOverlay } from "./image-processing-overlay";
import type { UnitItem } from "./hierarchy-step";

export type UnitType = {
  id?: string;
  image?: File;
  imageUrl?: string;
  imagePreviewUrl?: string;
  name: string;
  variants: UnitTypeVariant[];
};

export type UnitTypeVariant = VariantDraft;

const PAGE_SIZE = 6;
const emptyType = (): UnitType => ({ name: "", variants: [newVariant("Default")] });

const idr = (v: string) => `Rp ${Number(v).toLocaleString("id-ID")}`;

export function UnitTypeStep({ items, units, onChange, onRename, onVariantRename }: { items: UnitType[]; units: UnitItem[]; onChange: (items: UnitType[]) => void; onRename?: (oldName: string, newName: string) => void; onVariantRename?: (key: string, name: string) => void }) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [draft, setDraft] = useState<UnitType>(() => emptyType());
  const [processing, setProcessing] = useState(false);
  const previewUrls = useRef<string[]>([]);
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const start = (current - 1) * PAGE_SIZE;
  const visible = items.slice(start, start + PAGE_SIZE);

  const open = (index: number) => {
    setDraft(index >= 0 ? items[index] : emptyType());
    setEditing(index);
  };

  const toggleExpanded = (index: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing === null) return;
    if (!draft.variants.length) return toast.error("Tambahkan minimal satu varian.");
    const duplicate = duplicateVariantName(draft.variants);
    if (duplicate) return toast.error(duplicate);
    for (const option of draft.variants) {
      const created = units.filter((unit) => unit.typeVariantKey === option.key).length;
      if ((Number(option.stock) || 0) < created) {
        toast.error(`Stock ${draft.name} / ${option.name} tidak boleh kurang dari ${created} unit yang sudah dibuat.`);
        return;
      }
    }
    if (editing >= 0 && items[editing]?.name !== draft.name) onRename?.(items[editing].name, draft.name);
    if (editing >= 0) draft.variants.forEach((option) => {
      const old = items[editing]?.variants.find((item) => item.key === option.key);
      if (old && old.name !== option.name) onVariantRename?.(option.key, option.name);
    });
    onChange(editing >= 0 ? items.map((it, i) => (i === editing ? draft : it)) : [...items, draft]);
    setEditing(null);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#1f1f1f]">List Unit Type</h3>
          <p className="text-xs text-[#6b6b6b]">Below is the list of project types</p>
        </div>
        <Button type="button" variant="outline" onClick={() => open(-1)} className="h-9 gap-1.5 rounded-lg border-[#1980C0] bg-[#E8F3FA] px-4 text-xs text-[#1980C0] hover:bg-[#d6eaf6]">
          <Plus className="size-3.5" />
          Add Unit Type
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#E4E4E7]">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              {["Type", "Gambar", "Varian", "Total Stock", "Mulai Harga", "Action"].map((h) => (
                <TableHead key={h} className="h-10 whitespace-nowrap text-xs font-medium text-[#1f1f1f]">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-[#9CA3AF]">
                  Belum ada unit type. Klik “Add Unit Type” untuk menambahkan.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((u, i) => (
                <Fragment key={start + i}>
                <TableRow>
                  <TableCell className="whitespace-nowrap">
                    <button
                      type="button"
                      aria-expanded={expanded.has(start + i)}
                      onClick={() => toggleExpanded(start + i)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-[#F4F4F5]"
                    >
                      {expanded.has(start + i) ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      {u.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="relative flex size-14 items-center justify-center overflow-hidden rounded-md border border-[#E4E4E7] bg-[#F6F7F9] text-[10px] text-[#9CA3AF]">
                      {u.imagePreviewUrl || u.imageUrl ? (
                        <Image src={u.imagePreviewUrl ?? u.imageUrl ?? ""} alt={`Gambar ${u.name}`} fill unoptimized className="object-cover" />
                      ) : "No image"}
                    </div>
                  </TableCell>
                  <TableCell>{u.variants.length}</TableCell>
                  <TableCell className="whitespace-nowrap">{u.variants.reduce((sum, item) => sum + (Number(item.stock) || 0), 0)} Unit</TableCell>
                  <TableCell className="whitespace-nowrap">{idr(String(Math.min(...u.variants.map((item) => Number(item.basePrice) || 0))))}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" aria-label="Actions" className="cursor-pointer rounded p-1 hover:bg-[#F4F4F5]">
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => open(start + i)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-[#D64545]" onSelect={() => {
                          if (units.some((unit) => unit.type === u.name)) {
                            toast.error("Hapus unit pada tipe ini terlebih dahulu.");
                            return;
                          }
                          onChange(items.filter((_, idx) => idx !== start + i));
                        }}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {expanded.has(start + i) && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="bg-[#F8FAFC] p-0">
                      <div className="p-3">
                        <Table className="text-xs">
                          <TableHeader>
                            <TableRow>
                              {["Varian", ...SPEC_FIELDS.map((field) => field.name), "Stock (kuota)", "Harga dasar", "Unit dibuat", "Sisa slot"].map((h) => (
                                <TableHead key={h} className="h-8 whitespace-nowrap text-xs font-medium text-[#1f1f1f]">{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {u.variants.map((option) => {
                              const quota = Number(option.stock) || 0;
                              const created = units.filter((unit) => unit.typeVariantKey === option.key).length;
                              return (
                                <TableRow key={option.key}>
                                  <TableCell className="whitespace-nowrap">{option.name}</TableCell>
                                  {SPEC_FIELDS.map((field) => (
                                    <TableCell key={field.code} className="whitespace-nowrap">
                                      {option.specs[field.code] || 0}
                                      {"unit" in field ? ` ${field.unit}` : ""}
                                    </TableCell>
                                  ))}
                                  <TableCell>{quota}</TableCell>
                                  <TableCell className="whitespace-nowrap">{idr(option.basePrice)}</TableCell>
                                  <TableCell>{created}</TableCell>
                                  <TableCell>{quota - created}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#6b6b6b]">
        <span>
          Showing {items.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, items.length)} of {items.length} properties
        </span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)} className="grid size-6 cursor-pointer place-items-center rounded-full border border-[#D9D9DE] disabled:cursor-not-allowed disabled:opacity-40">
            <ChevronLeft className="size-3.5" />
          </button>
          {Array.from({ length: pages }, (_, p) => p + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={cn("grid size-6 cursor-pointer place-items-center rounded-full border text-[11px]", p === current ? "border-[#1980C0] bg-[#1980C0] text-white" : "border-[#D9D9DE]")}
            >
              {p}
            </button>
          ))}
          <button type="button" aria-label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)} className="grid size-6 cursor-pointer place-items-center rounded-full border border-[#D9D9DE] disabled:cursor-not-allowed disabled:opacity-40">
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className={TYPE_DIALOG_CLASS}>
          <DialogHeader>
            <DialogTitle>{editing !== null && editing >= 0 ? "Edit Unit Type" : "Add Unit Type"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className={TYPE_FORM_CLASS}>
            <VariantEditor
              variants={draft.variants}
              onChange={(variants) => setDraft((current) => ({ ...current, variants }))}
              createdUnits={(variant) => units.filter((unit) => unit.typeVariantKey === variant.key).length}
            >
            <label className="block">
              <span className={FIELD_LABEL}>Type Name</span>
              <Input
                required
                placeholder="Contoh: Type 36"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className={INPUT}
              />
            </label>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#1f1f1f]">Gambar tipe (opsional)</label>
              <div>
                <label htmlFor="unit-type-image-upload" className={cn("group relative flex h-24 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#8FC9E8] bg-[#E8F3FA] text-[#1980C0] transition hover:bg-[#D9EEF9]", (draft.imagePreviewUrl || draft.imageUrl) && "bg-[#E8F3FA]")}>
                  {draft.imagePreviewUrl || draft.imageUrl ? (
                    <Image src={draft.imagePreviewUrl ?? draft.imageUrl ?? ""} alt={`Preview ${draft.name || "tipe"}`} fill unoptimized className="object-contain" />
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-center text-xs font-medium">
                      <ImagePlus className="size-5" />
                      Upload gambar tipe
                    </span>
                  )}
                  {(draft.imagePreviewUrl || draft.imageUrl) && <span className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-center text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">Ganti gambar</span>}
                </label>
                <input id="unit-type-image-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (event) => {
                  const input = event.target;
                  const file = input.files?.[0];
                  if (!file) return;
                  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
                    toast.error("Gunakan JPEG, PNG, atau WebP maksimal 10 MB.");
                    input.value = "";
                    return;
                  }
                  input.value = "";
                  setProcessing(true);
                  try {
                    const image = await compressImage(file, PHOTO_MAX_EDGE);
                    const imagePreviewUrl = URL.createObjectURL(image);
                    previewUrls.current.push(imagePreviewUrl);
                    setDraft((current) => ({ ...current, image, imagePreviewUrl }));
                  } catch {
                    toast.error("Gambar tidak dapat diproses. Pilih berkas lain.");
                  } finally {
                    setProcessing(false);
                  }
                }} />
                {processing && <ImageProcessingOverlay />}
              </div>
              <p className="text-[10px] text-[#6b6b6b]">JPEG, PNG, atau WebP; maksimal 10 MB.</p>
            </div>
            </VariantEditor>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)} className="h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="h-9 bg-[#1980C0] text-xs text-white hover:bg-[#166ea6]">
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
