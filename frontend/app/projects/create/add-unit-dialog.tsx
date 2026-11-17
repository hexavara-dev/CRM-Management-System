"use client";

import { useRef, useState } from "react";
import { Building2, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INPUT } from "./form-styles";
import type { LocationNode, UnitItem } from "./hierarchy-step";
import type { UnitType } from "./unit-type-step";

type UnitRow = { code: string; type: string; hook: string; status: string };
const UNIT_STATUS = ["Available", "Reserved", "Sold"];
const HOOK_OPTIONS = ["Ya", "Tidak"];

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
  // Nomor unit mengikuti pola "<kode blok>-NN", mis. "Blok B1" -> "B1-01".
  const prefix = location.name.replace(/^blok\s*/i, "").trim().replace(/\s+/g, "-");
  const existing = units.filter((u) => u.locationId === location.id).length;
  const taken = new Set(units.map((u) => u.code));
  const assigned = (typeName: string) => units.filter((u) => u.type === typeName).length;

  const makeRow = (n: number): UnitRow => ({
    code: `${prefix}-${String(existing + n + 1).padStart(2, "0")}`,
    type: "",
    hook: "Ya",
    status: "Available",
  });
  const [rows, setRows] = useState<UnitRow[]>(() => [makeRow(0)]);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<UnitRow>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const addRow = () => setRows((rs) => [...rs, makeRow(rs.length)]);

  // Pesan error ada di atas tabel; Simpan ada di luar area scroll, jadi gulung ke pesan agar selalu terlihat.
  const errorRef = useRef<HTMLParagraphElement>(null);
  const fail = (message: string) => {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };
  const slotsOf = (t: UnitType) => Math.max(0, Math.round(Number(t.stock) || 0));
  const remainingOf = (t: UnitType) => Math.max(0, slotsOf(t) - assigned(t.name));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    // 1. Jumlah dulu: total baris tidak boleh melebihi total sisa slot semua type (belum perlu type dipilih).
    const totalRemaining = unitTypes.reduce((sum, t) => sum + remainingOf(t), 0);
    if (rows.length > totalRemaining) {
      fail(`Jumlah unit melebihi total slot. Total slot ${totalRemaining} unit, tapi akan ditambah ${rows.length} unit.`);
      return;
    }
    // 2. Baru cek tiap baris sudah memilih type.
    if (rows.some((r) => !r.type)) {
      fail("Pilih type untuk setiap unit.");
      return;
    }
    // 3. Per type: unit yang akan ditambah tidak boleh melebihi sisa slot type itu.
    for (const t of unitTypes) {
      const adding = rows.filter((r) => r.type === t.name).length;
      if (adding > remainingOf(t)) {
        fail(`Unit ${t.name} melebihi total slot. Total slot ${slotsOf(t)} unit, sisa ${remainingOf(t)} unit, tapi akan ditambah ${adding} unit.`);
        return;
      }
    }
    const codes = rows.map((r) => r.code.trim());
    if (codes.some((c, i) => !c || codes.indexOf(c) !== i || taken.has(c))) {
      fail("Nomor unit kosong, duplikat, atau sudah dipakai.");
      return;
    }
    onSave(rows.map((r, i) => ({ id: crypto.randomUUID(), locationId: location.id, code: codes[i], type: r.type, hook: r.hook, status: r.status })));
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Unit</DialogTitle>
          <p className="text-xs text-[#6b6b6b]">Add several new units to {location.name}</p>
        </DialogHeader>
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="h-[calc(90vh-11rem)] pr-3">
          <div className="space-y-4">
          <div className="rounded-lg border border-[#E4E4E7] p-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#1f1f1f]">
              <MapPin className="size-4 text-[#1980C0]" />
              {location.name}
            </div>
            <div className="pl-5.5 text-[11px] text-[#6b6b6b]">{path ? `${path} > ${location.name}` : location.name}</div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#1f1f1f]">
              <Building2 className="size-3.5 text-[#1980C0]" />
              Unit not yet assigned (available)
            </div>
            {unitTypes.length === 0 ? (
              <p className="text-xs text-[#9CA3AF]">Belum ada unit type. Tambahkan dulu di step 2.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {unitTypes.map((t) => (
                  <div key={t.name} className="rounded-lg border border-[#E4E4E7] p-2 text-center">
                    <div className="text-xs font-medium text-[#1f1f1f]">{t.name}</div>
                    <div className="text-[11px] text-[#1980C0]">{remainingOf(t)} Unit</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p ref={errorRef} role="alert" className="rounded-lg border border-[#F5C2C2] bg-[#FDECEC] p-3 text-xs font-medium text-[#D64545]">{error}</p>}

          <div className="overflow-x-auto rounded-lg border border-[#E4E4E7]">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  {["No Unit", "Type", "Hook", "Status Unit", "Action"].map((h) => (
                    <TableHead key={h} className="h-9 whitespace-nowrap text-xs font-medium text-[#1f1f1f]">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input required value={r.code} onChange={(e) => update(i, { code: e.target.value })} className={INPUT} />
                    </TableCell>
                    <TableCell>
                      <Select value={r.type} onValueChange={(v) => update(i, { type: v })}>
                        <SelectTrigger className="h-9 w-full text-xs">
                          <SelectValue placeholder="Pilih type" />
                        </SelectTrigger>
                        {/*
                          position="popper" wajib di sini: mode default item-aligned memposisikan dropdown dari
                          item terpilih / item pertama yang tidak disabled. Bila semua type slotnya habis (semua
                          item disabled) dan belum ada yang dipilih, dropdown tidak pernah diposisikan -> tak terlihat.
                        */}
                        <SelectContent position="popper">
                          {unitTypes.map((t) => (
                            // Slot habis: tetap tampil tapi tidak bisa dipilih (kecuali sudah terpilih di baris ini).
                            <SelectItem key={t.name} value={t.name} disabled={remainingOf(t) === 0 && r.type !== t.name} className="text-xs">{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={r.hook} onValueChange={(v) => update(i, { hook: v })}>
                        <SelectTrigger className="h-9 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOOK_OPTIONS.map((h) => (
                            <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={r.status} onValueChange={(v) => update(i, { status: v })}>
                        <SelectTrigger className="h-9 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_STATUS.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <button type="button" aria-label="Remove row" disabled={rows.length === 1} onClick={() => removeRow(i)} className="rounded p-1 text-[#D64545] hover:bg-[#FDECEC] disabled:opacity-40">
                        <Trash2 className="size-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <button type="button" onClick={addRow} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#1980C0] text-xs text-[#1980C0] hover:bg-[#E8F3FA]">
            <Plus className="size-3.5" />
            Add Column Unit
          </button>

          <p className="rounded-lg bg-[#E8F3FA] p-3 text-[11px] text-[#1980C0]">
            The Unit Number will automatically be generated based on the established numbering system (e.g., {prefix || "B1"}-01, {prefix || "B1"}-02...) and you may change it if necessary.
          </p>

          </div>
          </ScrollArea>
          <DialogFooter className="grid grid-cols-2 gap-3 pt-4 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 text-xs">Batal</Button>
            <Button type="submit" className="h-10 bg-[#1980C0] text-xs text-white hover:bg-[#166ea6]">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
