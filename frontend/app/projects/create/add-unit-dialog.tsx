"use client";

import { type ReactNode, useRef, useState } from "react";
import { ChevronDown, Home, MapPin, Minus, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { clampAddCount } from "./add-unit-count";
import { INPUT } from "./form-styles";
import type { LocationNode, UnitItem } from "./hierarchy-step";
import type { UnitType } from "./unit-type-step";

type UnitRow = { code: string; type: string; typeVariantKey: string; typeVariantName: string };

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
  // Nomor hanya perlu unik di lokasi ini; lokasi lain boleh memakai nomor yang sama.
  const taken = new Set(units.filter((u) => u.locationId === location.id).map((u) => normalizeCode(u.code)));
  // Unit yang masih berada di root project belum ter-assign ke blok dan tetap
  // dihitung sebagai stok yang tersedia untuk assignment.
  const options = unitTypes.flatMap((type) => type.variants.map((variant) => ({ type, variant })));
  const assigned = (key: string) => units.filter((u) => u.typeVariantKey === key && u.locationId !== "root").length;
  const firstAvailable = options.find(({ variant }) => Math.max(0, Number(variant.stock) - assigned(variant.key)) > 0);
  const [activeVariant, setActiveVariant] = useState(firstAvailable?.variant.key ?? options[0]?.variant.key ?? "");
  // Cari nomor yang benar-benar kosong di lokasi ini, bukan sekadar jumlah unit + 1.
  const makeRows = (count: number, type: string, typeVariantKey: string, typeVariantName: string, currentRows: UnitRow[] = []): UnitRow[] => {
    const unavailable = new Set([...taken, ...currentRows.map((row) => normalizeCode(row.code)).filter(Boolean)]);
    const result: UnitRow[] = [];
    // Lanjut dari nomor baris terakhir (mis. A-05 lalu A-06); tanpa angka di akhir, mulai dari 01.
    const last = currentRows.at(-1)?.code.trim().match(/^(.*?)(\d{1,9})$/);
    const base = last ? last[1] : `${prefix}-`;
    const width = last ? last[2].length : 2;
    for (let suffix = last ? Number(last[2]) + 1 : 1; result.length < count; suffix += 1) {
      const code = `${base}${String(suffix).padStart(width, "0")}`;
      const normalized = normalizeCode(code);
      if (unavailable.has(normalized)) continue;
      unavailable.add(normalized);
      result.push({ code, type, typeVariantKey, typeVariantName });
    }
    return result;
  };
  const [rows, setRows] = useState<UnitRow[]>(() => firstAvailable ? makeRows(1, firstAvailable.type.name, firstAvailable.variant.key, firstAvailable.variant.name) : []);
  const [search, setSearch] = useState("");
  // Hanya tipe varian aktif yang terbuka di awal agar daftar tidak memanjang.
  const [openTypes, setOpenTypes] = useState<Set<string>>(
    () => new Set(options.filter(({ variant }) => variant.key === activeVariant).map(({ type }) => type.name)),
  );
  const toggleType = (name: string) =>
    setOpenTypes((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const [error, setError] = useState<ReactNode | null>(null);
  // Jumlah kolom per klik "Add Column Unit"; string supaya kotak boleh kosong sementara diketik.
  const [countInput, setCountInput] = useState("1");

  const update = (i: number, patch: Partial<UnitRow>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  // Varian baris yang dihapus dipilih lagi, agar slotnya langsung bisa ditambahkan kembali.
  const removeRow = (i: number) => {
    const removed = rows[i];
    if (removed) setActiveVariant(removed.typeVariantKey);
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  };
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
  const leftOf = (key: string) => Math.max(0, remainingOf(key) - addingOf(key));
  // Tipe yang masih punya slot tampil lebih dulu; pencarian mencocokkan nama tipe atau varian.
  const query = search.trim().toLowerCase();
  const typeGroups = unitTypes
    .map((type) => ({
      type,
      left: type.variants.reduce((sum, variant) => sum + leftOf(variant.key), 0),
      variants: type.variants.filter((variant) => `${type.name} ${variant.name}`.toLowerCase().includes(query)),
    }))
    .filter((group) => group.variants.length > 0)
    .sort((a, b) => Number(b.left > 0) - Number(a.left > 0));
  const totalLeft = options.reduce((sum, { variant }) => sum + leftOf(variant.key), 0);
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
      fail(<>Nomor unit sudah digunakan di lokasi ini: <strong className="font-bold">{usedCodes.join(", ")}</strong>. Ganti dengan nomor lain atau hapus baris tersebut.</>);
      return;
    }
    onSave(rows.map((r, i) => ({ id: crypto.randomUUID(), locationId: location.id, code: codes[i], type: r.type, typeVariantKey: r.typeVariantKey, typeVariantName: r.typeVariantName, status: "Available" })));
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-[#E4E4E7] px-5 py-4 text-left">
          <DialogTitle>Tambah Unit</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <MapPin className="size-4 shrink-0 text-[#1980C0]" />
            {path ? `${path} > ${location.name}` : location.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 overflow-y-auto md:h-[min(56vh,520px)] md:grid-cols-[300px_minmax(0,1fr)] md:overflow-hidden">
            <aside className="flex min-h-0 flex-col border-b border-[#E4E4E7] bg-[#FAFAFB] md:border-r md:border-b-0">
              <div className="space-y-3 p-4 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#1f1f1f]">Tipe & Varian</h3>
                  <span className="text-xs text-[#6b6b6b]">{totalLeft} slot tersedia</span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]" />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    // Enter di pencarian tidak boleh menyimpan form.
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    placeholder="Cari tipe atau varian"
                    aria-label="Cari tipe atau varian"
                    className="h-9 bg-white pl-9 text-sm"
                  />
                </div>
              </div>
              <div className="max-h-56 min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4 md:max-h-none">
                {typeGroups.length === 0 && (
                  <p className="py-6 text-center text-sm text-[#6b6b6b]">
                    {options.length === 0 ? "Belum ada unit type. Tambahkan dulu di step 2." : "Tidak ada yang cocok."}
                  </p>
                )}
                {typeGroups.map(({ type, left: typeLeft, variants }) => {
                  // Saat mencari, semua tipe yang cocok terbuka.
                  const open = !!query || openTypes.has(type.name);
                  const typeAdding = type.variants.reduce((sum, variant) => sum + addingOf(variant.key), 0);
                  const hasActive = variants.some((variant) => variant.key === activeVariant);
                  return (
                  <div key={type.name} className="space-y-1.5">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggleType(type.name)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#EEF0F3]",
                        hasActive && !open && "bg-[#E8F3FA]",
                      )}
                    >
                      <ChevronDown className={cn("size-4 shrink-0 text-[#6b6b6b] transition-transform", !open && "-rotate-90")} />
                      <span className="min-w-0 flex-1 break-words text-sm font-medium text-[#1f1f1f]">{type.name}</span>
                      {typeAdding > 0 && <span className="shrink-0 text-xs text-[#1E9E55]">+{typeAdding}</span>}
                      <span className={cn("shrink-0 text-xs", typeLeft > 0 ? "text-[#1E9E55]" : "text-[#9CA3AF]")}>
                        {typeLeft > 0 ? `${typeLeft} slot` : "Habis"}
                      </span>
                    </button>
                    {open && (
                    // Garis dan indentasi menandai varian sebagai isi tipe di atasnya.
                    <div className="ml-[15px] space-y-1.5 border-l-2 border-[#D9DEE5] pl-5">
                    {variants.map((variant) => {
                      const active = variant.key === activeVariant;
                      const left = leftOf(variant.key);
                      const adding = addingOf(variant.key);
                      return (
                        <button
                          key={variant.key}
                          type="button"
                          aria-pressed={active}
                          // Varian habis tanpa unit di daftar tidak dapat dipilih karena tidak ada yang bisa ditambah.
                          disabled={!left && !adding && !active}
                          onClick={() => setActiveVariant(variant.key)}
                          className={cn(
                            "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition",
                            active
                              ? "border-[#1980C0] bg-[#E8F3FA]"
                              : "border-[#E4E4E7] bg-white enabled:hover:border-[#1980C0] disabled:cursor-not-allowed",
                          )}
                        >
                          <span className="min-w-0">
                            <span className={cn("block break-words text-sm", active ? "font-medium text-[#1980C0]" : left || adding ? "text-[#1f1f1f]" : "text-[#9CA3AF]")}>
                              {variant.name}
                            </span>
                            {adding > 0 && <span className="block text-xs text-[#1E9E55]">+{adding} akan ditambah</span>}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
                              left > 0 ? "bg-[#E6F6EC] text-[#1E9E55]" : "bg-[#F3F4F6] text-[#9CA3AF]",
                            )}
                          >
                            {left > 0 ? `${left} slot` : "Habis"}
                          </span>
                        </button>
                      );
                    })}
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </aside>

            <section className="flex min-h-0 flex-col">
              <div className="flex flex-col gap-3 border-b border-[#E4E4E7] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-semibold text-[#1f1f1f]">
                    {activeOption ? `${activeOption.type.name} - ${activeOption.variant.name}` : "Pilih tipe dan varian"}
                  </h3>
                  <p className="text-xs text-[#6b6b6b]">
                    {maxAddable > 0 ? `Masih bisa menambah ${maxAddable} unit` : "Tidak ada slot tersisa untuk varian ini"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ButtonGroup aria-label="Jumlah unit yang ditambahkan">
                    <Button type="button" variant="outline" aria-label="Kurangi jumlah unit" disabled={addCount <= 1} onClick={() => setCountInput(String(addCount - 1))} className="size-9 border-[#D9D9DE] px-0 text-[#1980C0]">
                      <Minus className="size-3.5" />
                    </Button>
                    <Input
                      inputMode="numeric"
                      aria-label={`Jumlah unit (maksimal ${maxAddable})`}
                      disabled={maxAddable < 1}
                      value={maxAddable < 1 ? "0" : countInput === "" ? "" : String(addCount)}
                      onChange={(e) => setCountInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      onBlur={() => setCountInput(String(Math.max(addCount, 1)))}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        addRows();
                      }}
                      className="h-9 w-16 rounded-none border-[#D9D9DE] text-center text-sm"
                    />
                    <Button type="button" variant="outline" aria-label="Tambah jumlah unit" disabled={addCount >= maxAddable} onClick={() => setCountInput(String(addCount + 1))} className="size-9 border-[#D9D9DE] px-0 text-[#1980C0]">
                      <Plus className="size-3.5" />
                    </Button>
                  </ButtonGroup>
                  <Button type="button" disabled={!canAddActiveType} onClick={addRows} className="h-9 bg-[#1980C0] text-white hover:bg-[#166ea6]">
                    <Plus className="size-4" />
                    Tambah
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {error && <p ref={errorRef} role="alert" className="rounded-lg border border-[#F5C2C2] bg-[#FDECEC] p-3 text-sm text-[#D64545]">{error}</p>}
                {rows.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#E4E4E7] px-4 py-12 text-center">
                    <Home className="size-8 text-[#9CA3AF]" />
                    <p className="text-sm font-medium text-[#1f1f1f]">Belum ada unit yang ditambahkan</p>
                    <p className="text-xs text-[#6b6b6b]">
                      {options.length > 0 && totalLeft === 0
                        ? "Semua slot sudah terpakai. Tambah stock varian di step Unit Type."
                        : "Pilih varian di daftar, isi jumlah, lalu klik Tambah."}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-[#6b6b6b]">Nomor bisa diubah. Unit berikutnya melanjutkan nomor baris terakhir.</p>
                    <ul className="space-y-2">
                      {rows.map((r, i) => (
                        <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-3 rounded-lg border border-[#E4E4E7] px-3 py-2">
                          <Input required aria-label={`Nomor unit baris ${i + 1}`} value={r.code} onChange={(e) => update(i, { code: e.target.value })} className={cn(INPUT, "h-9 w-full min-w-0")} />
                          <span className="min-w-0 break-words text-sm text-[#475467]">
                            {r.type} <span className="text-[#6b6b6b]">({r.typeVariantName})</span>
                          </span>
                          <Button type="button" variant="ghost" size="icon" aria-label={`Hapus ${r.code || "baris"}`} onClick={() => removeRow(i)} className="text-[#D64545] hover:bg-[#FDECEC] hover:text-[#D64545]">
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#E4E4E7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#475467]">
              <strong className="text-[#1f1f1f]">{rows.length} unit</strong> akan ditambahkan dengan status Available
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">Batal</Button>
              <Button type="submit" disabled={rows.length === 0} className="flex-1 bg-[#1980C0] text-white hover:bg-[#166ea6] sm:flex-none">Simpan</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
