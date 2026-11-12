"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { INPUT } from "./form-styles";

export type UnitType = {
  name: string;
  buildingArea: string;
  surfaceArea: string;
  floors: string;
  bedroom: string;
  bathroom: string;
  carport: string;
  stock: string;
  basePrice: string;
};

const PAGE_SIZE = 6;
// Field INT default 0 (sama dengan default di backend).
const EMPTY: UnitType = { name: "", buildingArea: "0", surfaceArea: "0", floors: "0", bedroom: "0", bathroom: "0", carport: "0", stock: "0", basePrice: "0" };

const FIELDS: { key: keyof UnitType; label: string; placeholder: string; numeric?: boolean }[] = [
  { key: "name", label: "Type Name", placeholder: "Contoh: Type 36" },
  { key: "buildingArea", label: "Building Area (m²)", placeholder: "0", numeric: true },
  { key: "surfaceArea", label: "Surface Area (m²)", placeholder: "0", numeric: true },
  { key: "floors", label: "Floors", placeholder: "0", numeric: true },
  { key: "bedroom", label: "Bedroom", placeholder: "0", numeric: true },
  { key: "bathroom", label: "Bathroom", placeholder: "0", numeric: true },
  { key: "carport", label: "Carport", placeholder: "0", numeric: true },
  { key: "stock", label: "Stock (Unit)", placeholder: "0", numeric: true },
  { key: "basePrice", label: "Base Price (Rp)", placeholder: "0", numeric: true },
];

const idr = (v: string) => `Rp ${Number(v).toLocaleString("id-ID")}`;

export function UnitTypeStep({ items, onChange }: { items: UnitType[]; onChange: (items: UnitType[]) => void }) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<UnitType>(EMPTY);

  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const start = (current - 1) * PAGE_SIZE;
  const visible = items.slice(start, start + PAGE_SIZE);

  const open = (index: number) => {
    setDraft(index >= 0 ? items[index] : EMPTY);
    setEditing(index);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing === null) return;
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
              {["Type", "Building area", "Surface area", "Floors", "Bedroom", "Bathroom", "Carport", "Stock", "Base Price", "Action"].map((h) => (
                <TableHead key={h} className="h-10 whitespace-nowrap text-xs font-medium text-[#1f1f1f]">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-[#9CA3AF]">
                  Belum ada unit type. Klik “Add Unit Type” untuk menambahkan.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((u, i) => (
                <TableRow key={start + i}>
                  <TableCell className="whitespace-nowrap">{u.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{u.buildingArea} m2</TableCell>
                  <TableCell className="whitespace-nowrap">{u.surfaceArea} m2</TableCell>
                  <TableCell>{u.floors}</TableCell>
                  <TableCell>{u.bedroom}</TableCell>
                  <TableCell>{u.bathroom}</TableCell>
                  <TableCell>{u.carport}</TableCell>
                  <TableCell className="whitespace-nowrap">{u.stock} Unit</TableCell>
                  <TableCell className="whitespace-nowrap">{idr(u.basePrice)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" aria-label="Actions" className="rounded p-1 hover:bg-[#F4F4F5]">
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => open(start + i)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-[#D64545]" onSelect={() => onChange(items.filter((_, idx) => idx !== start + i))}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
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
          <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)} className="grid size-6 place-items-center rounded-full border border-[#D9D9DE] disabled:opacity-40">
            <ChevronLeft className="size-3.5" />
          </button>
          {Array.from({ length: pages }, (_, p) => p + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={cn("grid size-6 place-items-center rounded-full border text-[11px]", p === current ? "border-[#1980C0] bg-[#1980C0] text-white" : "border-[#D9D9DE]")}
            >
              {p}
            </button>
          ))}
          <button type="button" aria-label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)} className="grid size-6 place-items-center rounded-full border border-[#D9D9DE] disabled:opacity-40">
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
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
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    className={INPUT}
                  />
                </div>
              ))}
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
