"use client";

import { useRef, useState } from "react";
import { Building2, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { INPUT } from "./form-styles";
import type { LocationNode, UnitItem } from "./hierarchy-step";
import type { UnitType } from "./unit-type-step";

type UnitRow = { code: string; type: string; hook: string; status: string };
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
  // Nomor unit mengikuti pola "<kode blok>-NN", mis. "Blok B1" -> "B1-01".
  const prefix = location.name.replace(/^blok\s*/i, "").trim().replace(/\s+/g, "-");
  const existing = units.filter((u) => u.locationId === location.id).length;
  const taken = new Set(units.map((u) => u.code));
  const assigned = (typeName: string) => units.filter((u) => u.type === typeName).length;

  const firstAvailableType = unitTypes.find((type) => Math.max(0, Number(type.stock) - assigned(type.name)) > 0);
  const [activeType, setActiveType] = useState(firstAvailableType?.name ?? unitTypes[0]?.name ?? "");
  const makeRow = (n: number, type = activeType): UnitRow => ({
    code: `${prefix}-${String(existing + n + 1).padStart(2, "0")}`,
    type,
    hook: "Ya",
    status: "Available",
  });
  const [rows, setRows] = useState<UnitRow[]>(() => firstAvailableType ? [makeRow(0, firstAvailableType.name)] : []);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<UnitRow>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const addRow = () => {
    const addingForType = rows.filter((row) => row.type === activeType).length;
    const selectedType = unitTypes.find((type) => type.name === activeType);
    if (!selectedType || addingForType >= remainingOf(selectedType)) return;
    setRows((rs) => [...rs, makeRow(rs.length, activeType)]);
  };

  // Pesan error ada di atas tabel; Simpan ada di luar area scroll, jadi gulung ke pesan agar selalu terlihat.
  const errorRef = useRef<HTMLParagraphElement>(null);
  const fail = (message: string) => {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };
  const slotsOf = (t: UnitType) => Math.max(0, Math.round(Number(t.stock) || 0));
  const remainingOf = (t: UnitType) => Math.max(0, slotsOf(t) - assigned(t.name));
  const addingOf = (typeName: string) => rows.filter((row) => row.type === typeName).length;
  const activeTypeData = unitTypes.find((type) => type.name === activeType);
  const canAddActiveType = Boolean(activeTypeData && addingOf(activeType) < remainingOf(activeTypeData));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) {
      fail("Tidak ada slot unit tersisa untuk ditambahkan.");
      return;
    }
    // 1. Jumlah dulu: total baris tidak boleh melebihi total sisa slot semua type (belum perlu type dipilih).
    const totalRemaining = unitTypes.reduce((sum, t) => sum + remainingOf(t), 0);
    if (rows.length > totalRemaining) {
      fail(`Jumlah unit melebihi total slot. Total slot ${totalRemaining} unit, tapi akan ditambah ${rows.length} unit.`);
      return;
    }
    // 2. Baru cek tiap baris sudah memilih type.
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
              <Tabs value={activeType} onValueChange={setActiveType} className="mb-4">
                <TabsList className="mb-5 h-auto min-h-0 flex-wrap justify-start gap-2 overflow-visible bg-transparent p-0">
                  {unitTypes.map((t) => (
                    <TabsTrigger key={t.name} value={t.name} className="h-auto flex-none flex-col rounded-lg border border-[#E4E4E7] px-3 py-2 data-[state=active]:border-[#1980C0] data-[state=active]:bg-[#E8F3FA]">
                      <span>{t.name}</span>
                      <span className="text-[11px] text-[#1980C0]">{addingOf(t.name)} / {remainingOf(t)} Unit</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </div>

          {error && <p ref={errorRef} role="alert" className="rounded-lg border border-[#F5C2C2] bg-[#FDECEC] p-3 text-xs font-medium text-[#D64545]">{error}</p>}

          <div className="overflow-x-auto rounded-lg border border-[#E4E4E7]">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  {["No Unit", "Type", "Status Unit", "Action"].map((h) => (
                    <TableHead key={h} className="h-9 whitespace-nowrap text-xs font-medium text-[#1f1f1f]">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => ({ r, i })).filter(({ r }) => r.type === activeType).map(({ r, i }) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input required value={r.code} onChange={(e) => update(i, { code: e.target.value })} className={INPUT} />
                    </TableCell>
                    <TableCell>{r.type}</TableCell>
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
                      <button type="button" aria-label="Remove row" onClick={() => removeRow(i)} className="rounded p-1 text-[#D64545] hover:bg-[#FDECEC]">
                        <Trash2 className="size-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <button type="button" onClick={addRow} disabled={!canAddActiveType} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#1980C0] text-xs text-[#1980C0] hover:bg-[#E8F3FA] disabled:cursor-not-allowed disabled:opacity-40">
            <Plus className="size-3.5" />
            Add Column Unit
          </button>

          <div className="rounded-lg bg-[#E8F3FA] p-3 text-[11px] text-[#1980C0]">
            <p className="font-semibold">Format nomor unit</p>
            <p className="mt-0.5">Nomor dibuat otomatis mengikuti kode blok, seperti B1-01, B1-02, dan seterusnya. Kamu bisa mengubahnya langsung di kolom nomor unit.</p>
          </div>

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
