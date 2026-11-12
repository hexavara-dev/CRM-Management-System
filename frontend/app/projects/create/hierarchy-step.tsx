"use client";

import { useState } from "react";
import { Folder, Layers, LayoutGrid, MoreVertical, Pencil, Plus, Trash2, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import type { UnitType } from "./unit-type-step";
import { FIELD_LABEL, INPUT } from "./form-styles";
import { AddUnitDialog } from "./add-unit-dialog";
import { DetailStat } from "./detail-stat";
import { TreeRow } from "./tree-row";

/** Flat list; parentId "root" = langsung di bawah proyek. */
export type LocationNode = { id: string; parentId: string; name: string; level: string };
/** Unit fisik; dimiliki oleh lokasi terbawah (block) melalui locationId. */
export type UnitItem = { id: string; locationId: string; code: string; type: string; hook: string; status: string };

const ROOT = "root";
const LEVEL_SUGGESTIONS = ["Cluster", "Zone", "Block", "Tower", "Floor"];

type Draft = { id: string | null; parentId: string; name: string; level: string };

export function HierarchyStep({
  projectName,
  nodes,
  onChange,
  unitTypes,
  units,
  onUnitsChange,
}: {
  projectName: string;
  nodes: LocationNode[];
  onChange: (n: LocationNode[]) => void;
  unitTypes: UnitType[];
  units: UnitItem[];
  onUnitsChange: (u: UnitItem[]) => void;
}) {
  const [selectedId, setSelectedId] = useState(ROOT);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([ROOT]));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [unitOpen, setUnitOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LocationNode | null>(null);

  const rootName = projectName || "Project";
  const kids = (pid: string) => nodes.filter((n) => n.parentId === pid);
  const descendants = (id: string): LocationNode[] => kids(id).flatMap((k) => [k, ...descendants(k.id)]);
  const unitCount = (id: string) => units.filter((u) => u.locationId === id).length;
  const totalUnits = (id: string) => [id, ...descendants(id).map((d) => d.id)].reduce((s, x) => s + unitCount(x), 0);
  /** Path leluhur tanpa proyek dan tanpa lokasi itu sendiri, mis. "Cluster Anggrek > Zone B". */
  const pathOf = (id: string) => {
    const names: string[] = [];
    let cur = nodes.find((n) => n.id === id);
    while (cur && cur.parentId !== ROOT) {
      const parentId = cur.parentId;
      cur = nodes.find((n) => n.id === parentId);
      if (cur) names.unshift(cur.name);
    }
    return names.join(" > ");
  };

  const selected = nodes.find((n) => n.id === selectedId) ?? { id: ROOT, parentId: "", name: rootName, level: "Project" };
  const children = kids(selected.id);
  // Hanya lokasi level Block (tanpa child) yang menampung unit; Add Unit disembunyikan di level lain.
  const isLeaf = selected.id !== ROOT && selected.level.trim().toLowerCase() === "block" && children.length === 0;
  const selectedUnits = units.filter((u) => u.locationId === selected.id);
  const desc = descendants(selected.id);
  const leaves = desc.filter((n) => kids(n.id).length === 0);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const openAdd = (parentId: string) => setDraft({ id: null, parentId, name: "", level: "" });
  const openEdit = (n: LocationNode) => setDraft({ id: n.id, parentId: n.parentId, name: n.name, level: n.level });

  const remove = (id: string) => {
    const gone = new Set([id, ...descendants(id).map((d) => d.id)]);
    onChange(nodes.filter((n) => !gone.has(n.id)));
    onUnitsChange(units.filter((u) => !gone.has(u.locationId)));
    if (gone.has(selectedId)) setSelectedId(ROOT);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const node: LocationNode = { id: draft.id ?? crypto.randomUUID(), parentId: draft.parentId, name: draft.name.trim(), level: draft.level.trim() };
    onChange(draft.id ? nodes.map((n) => (n.id === draft.id ? node : n)) : [...nodes, node]);
    if (!draft.id) setExpanded((s) => new Set(s).add(draft.parentId));
    setDraft(null);
  };

  const rowActions = (n: LocationNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Aksi lokasi" className="ml-auto rounded p-1 hover:bg-[#E4E4E7]">
          <MoreVertical className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => openEdit(n)}>Edit</DropdownMenuItem>
        <DropdownMenuItem className="text-[#D64545]" onSelect={() => setPendingDelete(n)}>Hapus</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderTree = (pid: string, depth: number): React.ReactNode =>
    kids(pid).map((n) => {
      const hasKids = kids(n.id).length > 0;
      return (
        <div key={n.id}>
          <TreeRow label={n.name} depth={depth} open={expanded.has(n.id)} hasKids={hasKids} active={selectedId === n.id} onToggle={() => toggle(n.id)} onSelect={() => setSelectedId(n.id)} actions={rowActions(n)} />
          {hasKids && expanded.has(n.id) && renderTree(n.id, depth + 1)}
        </div>
      );
    });

  // Saat edit, parent tidak boleh diri sendiri atau turunannya (mencegah siklus).
  const blocked = new Set(draft?.id ? [draft.id, ...descendants(draft.id).map((d) => d.id)] : []);
  const parentOptions = [{ id: ROOT, name: rootName, level: "Project" }, ...nodes.filter((n) => !blocked.has(n.id))];

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[#1f1f1f]">Location Hierarchy Setup</h3>
        <p className="text-xs text-[#6b6b6b]">Set up the project structure, add hierarchical levels (e.g., Cluster, Zone, Block, Tower, etc.), and manage the data.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="rounded-lg border border-[#E4E4E7] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#1f1f1f]">Project Location Structure</span>
            <Button type="button" variant="outline" onClick={() => openAdd(ROOT)} className="h-8 gap-1 rounded-lg border-[#1980C0] bg-[#E8F3FA] px-3 text-xs text-[#1980C0] hover:bg-[#d6eaf6]">
              <Plus className="size-3.5" />
              Add Level
            </Button>
          </div>
          <TreeRow label={rootName} depth={0} open={expanded.has(ROOT)} hasKids={kids(ROOT).length > 0} active={selectedId === ROOT} onToggle={() => toggle(ROOT)} onSelect={() => setSelectedId(ROOT)} />
          {expanded.has(ROOT) && renderTree(ROOT, 1)}
        </div>

        <div className="space-y-3 rounded-lg border border-[#E4E4E7] p-4">
          <div>
            <h4 className="text-xs font-semibold text-[#1f1f1f]">Detail</h4>
            <p className="text-[11px] text-[#6b6b6b]">Manage the selected location information and add child locations under it</p>
          </div>

          <div className="rounded-lg border border-[#E4E4E7] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Folder className="size-5 shrink-0 text-[#1980C0]" />
                <span className="truncate text-sm font-semibold text-[#1f1f1f]">{selected.name}</span>
              </div>
              {selected.id !== ROOT && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => openEdit(selected)} className="h-8 gap-1 border-[#E0B400] bg-[#FFFBE6] px-4 text-xs text-[#B58900] hover:bg-[#fff5c2]">
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setPendingDelete(selected)} className="h-8 gap-1 border-[#D64545] bg-[#FDECEC] px-4 text-xs text-[#D64545] hover:bg-[#fbd9d9]">
                    <Trash2 className="size-3" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <DetailStat icon={<LayoutGrid className="size-4" />} label="Level" value={selected.level} />
              <DetailStat icon={<Layers className="size-4" />} label="Total child" value={children.length ? `${children.length} ${children[0].level}` : "-"} />
              <DetailStat icon={<Boxes className="size-4" />} label={leaves.length ? `Total ${leaves[0].level}` : "Total Unit"} value={leaves.length ? `${leaves.length} ${leaves[0].level}` : `${totalUnits(selected.id)} Unit`} />
            </div>
          </div>

          {isLeaf && (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#1f1f1f]">Daftar Unit</h4>
                <Button type="button" variant="outline" onClick={() => setUnitOpen(true)} className="h-8 gap-1 rounded-lg border-[#1980C0] bg-[#E8F3FA] px-3 text-xs text-[#1980C0] hover:bg-[#d6eaf6]">
                  <Plus className="size-3.5" />
                  Add Unit
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#E4E4E7]">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      {["No Unit", "Type", "Hook", "Status Unit", "Action"].map((h) => (
                        <TableHead key={h} className="h-10 whitespace-nowrap text-xs font-medium text-[#1f1f1f]">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedUnits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-[#9CA3AF]">Belum ada unit di lokasi ini.</TableCell>
                      </TableRow>
                    ) : (
                      selectedUnits.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="whitespace-nowrap">{u.code}</TableCell>
                          <TableCell>{u.type}</TableCell>
                          <TableCell>{u.hook}</TableCell>
                          <TableCell>{u.status}</TableCell>
                          <TableCell>
                            <button type="button" aria-label="Delete unit" onClick={() => onUnitsChange(units.filter((x) => x.id !== u.id))} className="rounded p-1 text-[#D64545] hover:bg-[#FDECEC]">
                              <Trash2 className="size-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>

      {pendingDelete && (
        <ConfirmModal
          isOpen
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            remove(pendingDelete.id);
            setPendingDelete(null);
          }}
          title={`Hapus ${pendingDelete.name}?`}
          description={`${descendants(pendingDelete.id).length} child location dan ${totalUnits(pendingDelete.id)} unit di dalamnya ikut terhapus. Tindakan ini tidak bisa dibatalkan.`}
        />
      )}

      {unitOpen && isLeaf && (
        <AddUnitDialog
          onOpenChange={setUnitOpen}
          location={selected}
          path={pathOf(selected.id)}
          unitTypes={unitTypes}
          units={units}
          onSave={(added) => onUnitsChange([...units, ...added])}
        />
      )}

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit Location" : "Add Level"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className={FIELD_LABEL}>Location Name</label>
                <Input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Contoh: Cluster Anggrek" className={INPUT} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Level</label>
                <Select value={draft.level} onValueChange={(v) => setDraft({ ...draft, level: v })}>
                  <SelectTrigger className="h-9 w-full text-xs">
                    <SelectValue placeholder="Pilih level" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_SUGGESTIONS.map((l) => (
                      <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Parent</label>
                <Select value={draft.parentId} onValueChange={(v) => setDraft({ ...draft, parentId: v })}>
                  <SelectTrigger className="h-9 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{`${p.name} (${p.level})`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)} className="h-9 text-xs">Cancel</Button>
                <Button type="submit" disabled={!draft.level} className="h-9 bg-[#1980C0] text-xs text-white hover:bg-[#166ea6]">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

