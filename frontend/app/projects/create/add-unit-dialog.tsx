"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, MapPin, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { clampAddCount } from "./add-unit-count";
import { INPUT } from "./form-styles";
import type { LocationNode, UnitItem } from "./hierarchy-step";
import { compressImage, PHOTO_MAX_EDGE } from "@/lib/compress-image";
import { ImageProcessingOverlay } from "./image-processing-overlay";
import { UnitImageThumbs } from "./unit-image-thumbs";
import type { UnitType } from "./unit-type-step";

type UnitRow = { code: string; type: string; typeVariantKey: string; typeVariantName: string; hook: string; status: string; images: File[] };
const UNIT_STATUS = ["Available", "Reserved", "Sold"];

export function AddUnitDialog({
  onOpenChange,
  location,
  path,
  unitTypes,
  units,
  onSave,
}: {
  onOpenChange: (open: boolean) => void;
  location: LocationNode;
  path: string;
  unitTypes: UnitType[];
  units: UnitItem[];
  onSave: (added: UnitItem[]) => void;
}) {
  // Nomor unit mengikuti node leaf aktual dan tidak bergantung pada nama level tertentu.
  const prefix = location.name.replace(/^(blok|block)\s*/i, "").trim().replace(/\s+/g, "-");
  const normalizeCode = (code: string) => code.trim().toLocaleLowerCase("id-ID");
  const taken = new Set(units.map((u) => normalizeCode(u.code)));
  // Unit yang masih berada di root project belum ter-assign ke blok dan tetap
  // dihitung sebagai stok yang tersedia untuk assignment.
  const options = unitTypes.flatMap((type) => type.variants.map((variant) => ({ type, variant })));
  const assigned = (key: string) => units.filter((u) => u.typeVariantKey === key && u.locationId !== "root").length;
  const firstAvailable = options.find(({ variant }) => Math.max(0, Number(variant.stock) - assigned(variant.key)) > 0);
  const [processing, setProcessing] = useState(false);
  const [activeVariant, setActiveVariant] = useState(firstAvailable?.variant.key ?? options[0]?.variant.key ?? "");
  // Cari nomor yang benar-benar kosong, bukan sekadar jumlah unit + 1. Dengan begitu gap nomor
  // dan unit pada lokasi lain tidak membuat generator menawarkan kode yang sudah dipakai.
  const makeRows = (count: number, type: string, typeVariantKey: string, typeVariantName: string, currentRows: UnitRow[] = []): UnitRow[] => {
    const unavailable = new Set([...taken, ...currentRows.map((row) => normalizeCode(row.code)).filter(Boolean)]);
    const result: UnitRow[] = [];
    for (let suffix = 1; result.length < count; suffix += 1) {
      const code = `${prefix}-${String(suffix).padStart(2, "0")}`;
      const normalized = normalizeCode(code);
      if (unavailable.has(normalized)) continue;
      unavailable.add(normalized);
      result.push({ code, type, typeVariantKey, typeVariantName, hook: "Ya", status: "Available", images: [] });
    }
    return result;
  };
  const [rows, setRows] = useState<UnitRow[]>(() => firstAvailable ? makeRows(1, firstAvailable.type.name, firstAvailable.variant.key, firstAvailable.variant.name) : []);
  const [error, setError] = useState<ReactNode | null>(null);
  const variantListRef = useRef<HTMLDivElement>(null);
  const variantNavRef = useRef<HTMLDivElement>(null);
  const [showVariantArrows, setShowVariantArrows] = useState(false);
  useLayoutEffect(() => {
    const nav = variantNavRef.current;
    const list = variantListRef.current;
    if (!nav || !list) return;
    const measure = () => {
      const cards = Array.from(list.children);
      const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
      const contentWidth = cards.reduce((width, card) => width + card.getBoundingClientRect().width, 0) + Math.max(0, cards.length - 1) * gap;
      setShowVariantArrows(contentWidth > nav.clientWidth + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    Array.from(list.children).forEach((card) => observer.observe(card));
    measure();
    return () => observer.disconnect();
  }, [options.length]);
  // Jumlah kolom per klik "Add Column Unit"; string supaya kotak boleh kosong sementara diketik.
  const [countInput, setCountInput] = useState("1");

  const update = (i: number, patch: Partial<UnitRow>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  // Tambah `addCount` baris sekaligus untuk type aktif; addCount sudah dibatasi sisa slot (lihat clampAddCount).
  const addRows = () => {
    if (addCount < 1) return;
    if (!activeOption) return;
    setRows((rs) => [...rs, ...makeRows(addCount, activeOption.type.name, activeOption.variant.key, activeOption.variant.name, rs)]);
  };

  // Pesan error ada di atas tabel; Simpan ada di luar area scroll, jadi gulung ke pesan agar selalu terlihat.
  const errorRef = useRef<HTMLParagraphElement>(null);
  const fail = (message: ReactNode) => {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };
  const slotsOf = (key: string) => Math.max(0, Math.round(Number(options.find(({ variant }) => variant.key === key)?.variant.stock) || 0));
  const remainingOf = (key: string) => Math.max(0, slotsOf(key) - assigned(key));
  const addingOf = (key: string) => rows.filter((row) => row.typeVariantKey === key).length;
  const activeOption = options.find(({ variant }) => variant.key === activeVariant);
  // Sisa slot type aktif yang masih boleh ditambah = sisa slot dikurangi baris yang sudah ditambahkan di dialog.
  const maxAddable = activeOption ? Math.max(0, remainingOf(activeVariant) - addingOf(activeVariant)) : 0;
  const addCount = clampAddCount(countInput === "" ? 1 : Number(countInput), maxAddable);
  const canAddActiveType = addCount > 0;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) {
      fail("Tidak ada slot unit tersisa untuk ditambahkan.");
      return;
    }
    // 1. Jumlah dulu: total baris tidak boleh melebihi total sisa slot semua type (belum perlu type dipilih).
    const totalRemaining = options.reduce((sum, { variant }) => sum + remainingOf(variant.key), 0);
    if (rows.length > totalRemaining) {
      fail(`Jumlah unit melebihi total slot. Total slot ${totalRemaining} unit, tapi akan ditambah ${rows.length} unit.`);
      return;
    }
    // 2. Baru cek tiap baris sudah memilih type.
    // 3. Per type: unit yang akan ditambah tidak boleh melebihi sisa slot type itu.
    for (const { type, variant } of options) {
      const adding = rows.filter((r) => r.typeVariantKey === variant.key).length;
      if (adding > remainingOf(variant.key)) {
        fail(`Unit ${type.name} (${variant.name}) melebihi total slot. Total slot ${slotsOf(variant.key)} unit, sisa ${remainingOf(variant.key)} unit, tapi akan ditambah ${adding} unit.`);
        return;
      }
    }
    const codes = rows.map((r) => r.code.trim());
    const emptyRows = codes.flatMap((code, index) => code ? [] : [index + 1]);
    if (emptyRows.length) {
      fail(<>Nomor unit pada baris <strong className="font-bold">{emptyRows.join(", ")}</strong> masih kosong. Isi nomor unit atau hapus baris tersebut.</>);
      return;
    }
    const normalizedCodes = codes.map(normalizeCode);
    const duplicateCodes = [...new Set(codes.filter((_, index) =>
      normalizedCodes.indexOf(normalizedCodes[index]) !== normalizedCodes.lastIndexOf(normalizedCodes[index]),
    ))];
    if (duplicateCodes.length) {
      fail(<>Nomor unit duplikat dalam daftar ini: <strong className="font-bold">{duplicateCodes.join(", ")}</strong>. Ubah salah satu nomor agar setiap unit unik.</>);
      return;
    }
    const usedCodes = codes.filter((_, index) => taken.has(normalizedCodes[index]));
    if (usedCodes.length) {
      fail(<>Nomor unit sudah digunakan: <strong className="font-bold">{usedCodes.join(", ")}</strong>. Ganti dengan nomor lain atau hapus baris tersebut.</>);
      return;
    }
    onSave(rows.map((r, i) => ({ id: crypto.randomUUID(), locationId: location.id, code: codes[i], type: r.type, typeVariantKey: r.typeVariantKey, typeVariantName: r.typeVariantName, hook: r.hook, status: r.status, images: r.images })));
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] min-w-0 max-w-[680px] flex-col overflow-hidden sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Add Unit</DialogTitle>
          <p className="text-xs text-[#6b6b6b]">Add several new units to {location.name}</p>
        </DialogHeader>
        <form onSubmit={save} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="h-[calc(90vh-11rem)] w-full min-w-0 overflow-x-hidden overflow-y-auto pr-3">
          <div className="w-full min-w-0 space-y-4">
          <div className="rounded-lg border border-[#E4E4E7] p-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#1f1f1f]">
              <MapPin className="size-4 text-[#1980C0]" />
              {location.name}
            </div>
            <div className="pl-5.5 text-[11px] text-[#6b6b6b]">{path ? `${path} > ${location.name}` : location.name}</div>
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#1f1f1f]">
              <Building2 className="size-3.5 text-[#1980C0]" />
              Unit not yet assigned (available)
            </div>
            {unitTypes.length === 0 ? (
              <p className="text-xs text-[#9CA3AF]">Belum ada unit type. Tambahkan dulu di step 2.</p>
            ) : (
              <Tabs value={activeVariant} onValueChange={setActiveVariant} className="mb-4 min-w-0">
                <div ref={variantNavRef} className="flex w-full min-w-0 items-center gap-2 overflow-hidden">
                  {showVariantArrows && <button type="button" aria-label="Lihat tipe sebelumnya" onClick={() => variantListRef.current?.scrollBy({ left: -272, behavior: "smooth" })} className="grid h-16 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#B9DDF2] bg-[#E8F3FA] text-[#1980C0] hover:bg-[#D9EEF9]">
                    <ChevronLeft className="size-4" />
                  </button>}
                <TabsList ref={variantListRef} className="flex h-auto min-h-0 min-w-0 flex-1 flex-nowrap justify-start gap-2 overflow-x-auto overflow-y-hidden bg-transparent p-0 pb-2 group-data-horizontal/tabs:h-auto [scrollbar-color:#1980C0_#E8F3FA] [scrollbar-width:thin]">
                  {options.map(({ type, variant }) => (
                    <TabsTrigger key={variant.key} value={variant.key} className="h-auto w-64 min-w-64 flex-none flex-col rounded-lg border border-[#E4E4E7] px-2.5 py-2 text-center whitespace-normal data-[state=active]:border-[#1980C0] data-[state=active]:bg-[#E8F3FA]">
                      <span className="w-full break-words text-xs leading-4">{type.name} ({variant.name})</span>
                      <span className="text-[11px] text-[#1980C0]">{Math.max(0, remainingOf(variant.key) - addingOf(variant.key))} tersedia</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
                  {showVariantArrows && <button type="button" aria-label="Lihat tipe berikutnya" onClick={() => variantListRef.current?.scrollBy({ left: 272, behavior: "smooth" })} className="grid h-16 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#B9DDF2] bg-[#E8F3FA] text-[#1980C0] hover:bg-[#D9EEF9]">
                    <ChevronRight className="size-4" />
                  </button>}
                </div>
              </Tabs>
            )}
          </div>

          {error && <p ref={errorRef} role="alert" className="rounded-lg border border-[#F5C2C2] bg-[#FDECEC] p-3 text-xs font-medium text-[#D64545]">{error}</p>}

          <div className="w-full min-w-0 overflow-hidden rounded-lg border border-[#E4E4E7]">
            <Table className="w-full min-w-0 table-fixed text-xs">
              <colgroup>
                <col className="w-[27%]" />
                <col className="w-[25%]" />
                <col className="w-[23%]" />
                <col className="w-[17%]" />
                <col className="w-[8%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  {["No Unit", "Type", "Gambar", "Status", ""].map((h) => (
                    <TableHead key={h || "action"} className="h-9 min-w-0 px-2 text-xs font-medium text-[#1f1f1f] first:pl-3 last:pr-3">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.every((row) => row.typeVariantKey !== activeVariant) && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-5 text-center text-xs text-[#6b6b6b]">Belum ada unit untuk varian ini.</TableCell>
                  </TableRow>
                )}
                {rows.map((r, i) => ({ r, i })).filter(({ r }) => r.typeVariantKey === activeVariant).map(({ r, i }) => (
                  <TableRow key={i}>
                    <TableCell className="min-w-0 px-2 first:pl-3 last:pr-3">
                      <Input required value={r.code} onChange={(e) => update(i, { code: e.target.value })} className={cn(INPUT, "w-full min-w-0")} />
                    </TableCell>
                    <TableCell className="min-w-0 break-words px-2 first:pl-3 last:pr-3">{r.type} ({r.typeVariantName})</TableCell>
                    <TableCell className="min-w-0 px-2 first:pl-3 last:pr-3">
                      <div className="flex flex-col items-start gap-1.5">
                      <UnitImageThumbs files={r.images} label={r.code || "Unit"} />
                      <label className="max-w-full cursor-pointer truncate text-[11px] text-[#1980C0] hover:underline">
                        {r.images.length ? "Ubah gambar" : "Tambah gambar"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="sr-only"
                          onChange={async (event) => {
                            const input = event.target;
                            const files = Array.from(input.files ?? []);
                            const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024);
                            if (invalid) {
                              setError("Gunakan JPEG, PNG, atau WebP maksimal 10 MB per gambar.");
                              input.value = "";
                              return;
                            }
                            input.value = "";
                            if (files.length === 0) return;
                            setProcessing(true);
                            try {
                              update(i, { images: await Promise.all(files.map((file) => compressImage(file, PHOTO_MAX_EDGE))) });
                            } catch {
                              setError("Gambar tidak dapat diproses. Pilih berkas lain.");
                            } finally {
                              setProcessing(false);
                            }
                          }}
                        />
                      </label>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 px-2 first:pl-3 last:pr-3">
                      <Select value={r.status} onValueChange={(v) => update(i, { status: v })}>
                        <SelectTrigger className="h-9 w-full min-w-0 px-2 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_STATUS.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-2 text-center first:pl-3 last:pr-3">
                      <button type="button" aria-label="Remove row" onClick={() => removeRow(i)} className="cursor-pointer rounded p-1 text-[#D64545] hover:bg-[#FDECEC]">
                        <Trash2 className="size-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ButtonGroup className="w-full" aria-label="Jumlah kolom yang ditambahkan">
              <Button type="button" variant="outline" aria-label="Kurangi jumlah kolom" disabled={addCount <= 1} onClick={() => setCountInput(String(addCount - 1))} className="h-9 w-9 shrink-0 border-[#D9D9DE] px-0 text-[#1980C0]">
                <Minus className="size-3.5" />
              </Button>
              <Input
                inputMode="numeric"
                aria-label={`Jumlah kolom (maksimal ${maxAddable})`}
                disabled={maxAddable < 1}
                value={maxAddable < 1 ? "0" : countInput === "" ? "" : String(addCount)}
                onChange={(e) => setCountInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onBlur={() => setCountInput(String(Math.max(addCount, 1)))}
                className={cn(INPUT, "w-full min-w-0 rounded-none text-center")}
              />
              <Button type="button" variant="outline" aria-label="Tambah jumlah kolom" disabled={addCount >= maxAddable} onClick={() => setCountInput(String(addCount + 1))} className="h-9 w-9 shrink-0 border-[#D9D9DE] px-0 text-[#1980C0]">
                <Plus className="size-3.5" />
              </Button>
            </ButtonGroup>
            <button type="button" onClick={addRows} disabled={!canAddActiveType} className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#1980C0] text-xs text-[#1980C0] hover:bg-[#E8F3FA] disabled:cursor-not-allowed disabled:opacity-40">
              <Plus className="size-3.5" />
              Add Column Unit
            </button>
          </div>

          <div className="rounded-lg bg-[#E8F3FA] p-3 text-[11px] text-[#1980C0]">
            <p className="font-semibold">Format nomor unit</p>
            <p className="mt-0.5">Nomor dibuat otomatis mengikuti kode blok, seperti B1-01, B1-02, dan seterusnya. Kamu bisa mengubahnya langsung di kolom nomor unit.</p>
          </div>

          </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 pt-4 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 text-xs">Batal</Button>
            <Button type="submit" className="h-10 bg-[#1980C0] text-xs text-white hover:bg-[#166ea6]">Simpan</Button>
          </DialogFooter>
        </form>
        {processing && <ImageProcessingOverlay />}
      </DialogContent>
    </Dialog>
  );
}
