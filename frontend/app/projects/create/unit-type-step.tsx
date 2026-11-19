"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronLeft, ChevronRight, ImagePlus, MoreVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { INPUT } from "./form-styles";
import type { UnitItem } from "./hierarchy-step";

export type UnitType = {
  id?: string;
  image?: File;
  imageUrl?: string;
  imagePreviewUrl?: string;
  name: string;
  buildingArea: string;
  surfaceArea: string;
  floors: string;
  bedroom: string;
  bathroom: string;
  carport: string;
  variants: UnitTypeVariant[];
};

export type UnitTypeVariant = {
  id?: string;
  key: string;
  name: string;
  code: string;
  stock: string;
  basePrice: string;
};

 const PAGE_SIZE = 6;
// Input numeric dibiarkan kosong saat form baru dibuka; nilai kosong dinormalisasi menjadi 0 saat payload dibuat.
const emptyType = (): UnitType => ({
  name: "", buildingArea: "", surfaceArea: "", floors: "", bedroom: "", bathroom: "", carport: "",
  variants: [{ key: crypto.randomUUID(), name: "Default", code: "", stock: "", basePrice: "" }],
});

const FIELDS: { key: Exclude<keyof UnitType, "id" | "image" | "imageUrl" | "imagePreviewUrl" | "variants">; label: string; placeholder: string; numeric?: boolean }[] = [
  { key: "name", label: "Type Name", placeholder: "Contoh: Type 36" },
  { key: "buildingArea", label: "Building Area (m²)", placeholder: "0", numeric: true },
  { key: "surfaceArea", label: "Surface Area (m²)", placeholder: "0", numeric: true },
  { key: "floors", label: "Floors", placeholder: "0", numeric: true },
  { key: "bedroom", label: "Bedroom", placeholder: "0", numeric: true },
  { key: "bathroom", label: "Bathroom", placeholder: "0", numeric: true },
  { key: "carport", label: "Carport", placeholder: "0", numeric: true },
];

const idr = (v: string) => `Rp ${Number(v).toLocaleString("id-ID")}`;

export function UnitTypeStep({ items, units, onChange, onRename, onVariantRename }: { items: UnitType[]; units: UnitItem[]; onChange: (items: UnitType[]) => void; onRename?: (oldName: string, newName: string) => void; onVariantRename?: (key: string, name: string) => void }) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [draft, setDraft] = useState<UnitType>(() => emptyType());
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
    const names = draft.variants.map((item) => item.name.trim().toLocaleLowerCase("id-ID"));
    if (new Set(names).size !== names.length) return toast.error("Nama varian dalam satu tipe tidak boleh sama.");
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
              {["Type", "Gambar", "Building area", "Surface area", "Floors", "Bedroom", "Bathroom", "Carport", "Varian", "Total Stock", "Mulai Harga", "Action"].map((h) => (
                <TableHead key={h} className="h-10 whitespace-nowrap text-xs font-medium text-[#1f1f1f]">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-[#9CA3AF]">
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
                  <TableCell className="whitespace-nowrap">{u.buildingArea} m2</TableCell>
                  <TableCell className="whitespace-nowrap">{u.surfaceArea} m2</TableCell>
                  <TableCell>{u.floors}</TableCell>
                  <TableCell>{u.bedroom}</TableCell>
                  <TableCell>{u.bathroom}</TableCell>
                  <TableCell>{u.carport}</TableCell>
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
                    <TableCell colSpan={12} className="bg-[#F8FAFC] p-0">
                      <div className="p-3">
                        <Table className="text-xs">
                          <TableHeader>
                            <TableRow>
                              {["Varian", "Stock (kuota)", "Harga dasar", "Unit dibuat", "Sisa slot"].map((h) => (
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
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing !== null && editing >= 0 ? "Edit Unit Type" : "Add Unit Type"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key} className={f.key === "name" ? "col-span-2" : undefined}>
                  <label className="mb-1.5 block text-xs font-medium text-[#1f1f1f]">{f.label}</label>
                  <Input
                      required
                      type={f.numeric ? "number" : "text"}
                      min={f.numeric ? 0 : undefined}
                      placeholder={f.placeholder}
                      value={draft[f.key]}
                      onFocus={() => {
                        if (draft[f.key] === "0") setDraft({ ...draft, [f.key]: "" });
                      }}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                      className={INPUT}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-lg border border-[#E4E4E7] p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[#1f1f1f]">Varian tipe</p>
                  <p className="text-[10px] text-[#667085]">Harga dan stock diatur untuk setiap varian.</p>
                </div>
                <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setDraft((current) => ({ ...current, variants: [...current.variants, { key: crypto.randomUUID(), name: "", code: "", stock: "", basePrice: "" }] }))}>
                  <Plus className="mr-1 size-3.5" />Tambah varian
                </Button>
              </div>
              <ScrollArea className="h-56 overflow-hidden pr-1">
              <div className="space-y-2">
              {draft.variants.map((option) => (
                <div key={option.key} className="grid gap-2 rounded-md bg-[#F8FAFC] p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.9fr)_auto]">
                  <Input required value={option.name} placeholder="Nama varian" className={INPUT} onChange={(event) => setDraft((current) => ({ ...current, variants: current.variants.map((item) => item.key === option.key ? { ...item, name: event.target.value } : item) }))} />
                  <Input type="number" required min={0} value={option.stock} placeholder="Stock" className={INPUT} onChange={(event) => setDraft((current) => ({ ...current, variants: current.variants.map((item) => item.key === option.key ? { ...item, stock: event.target.value } : item) }))} />
                  <RupiahInput required value={option.basePrice} placeholder="Harga dasar" className={INPUT} onValueChange={(value) => setDraft((current) => ({ ...current, variants: current.variants.map((item) => item.key === option.key ? { ...item, basePrice: value } : item) }))} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus varian ${option.name || "ini"}`}
                    title="Hapus varian"
                    disabled={draft.variants.length === 1 || units.some((unit) => unit.typeVariantKey === option.key)}
                    className="h-9 w-9 text-[#D64545] hover:bg-[#FDECEC] hover:text-[#B42318]"
                    onClick={() => setDraft((current) => ({ ...current, variants: current.variants.filter((item) => item.key !== option.key) }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              </div>
              </ScrollArea>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#1f1f1f]">Gambar tipe (opsional)</label>
              <div>
                <label htmlFor="unit-type-image-upload" className={cn("group relative flex h-28 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#8FC9E8] bg-[#E8F3FA] text-[#1980C0] transition hover:bg-[#D9EEF9]", (draft.imagePreviewUrl || draft.imageUrl) && "bg-[#E8F3FA]")}>
                  {draft.imagePreviewUrl || draft.imageUrl ? (
                    <Image src={draft.imagePreviewUrl ?? draft.imageUrl ?? ""} alt={`Preview ${draft.name || "tipe"}`} fill unoptimized className="object-cover" />
                  ) : (
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <ImagePlus className="size-5" />
                      Upload gambar tipe
                    </span>
                  )}
                  {(draft.imagePreviewUrl || draft.imageUrl) && <span className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-center text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">Ganti gambar</span>}
                </label>
                <input id="unit-type-image-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
                    toast.error("Gunakan JPEG, PNG, atau WebP maksimal 10 MB.");
                    event.target.value = "";
                    return;
                  }
                  const imagePreviewUrl = URL.createObjectURL(file);
                  previewUrls.current.push(imagePreviewUrl);
                  setDraft((current) => ({ ...current, image: file, imagePreviewUrl }));
                }} />
              </div>
              <p className="text-[10px] text-[#6b6b6b]">JPEG, PNG, atau WebP; maksimal 10 MB.</p>
            </div>
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
