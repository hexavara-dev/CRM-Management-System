"use client";

import { useState } from "react";
import { ArrowUpDown, ChevronRight, Folder, Layers, LayoutGrid, MoreVertical, Pencil, Plus, Trash2, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { cn } from "@/lib/utils";
import type { UnitType } from "./unit-type-step";
import { FIELD_LABEL, INPUT } from "./form-styles";
import { AddUnitDialog } from "./add-unit-dialog";
import { DetailStat } from "./detail-stat";
import { TreeRow } from "./tree-row";
import { toast } from "sonner";

/** Flat list; parentId "root" = langsung di bawah proyek. */
export type LocationNode = { id: string; persistedId?: string; parentId: string; name: string; level: string };
/** Unit fisik; dimiliki oleh lokasi terbawah (block) melalui locationId. */
export type UnitItem = { id: string; persistedId?: string; locationId: string; code: string; type: string; typeVariantKey: string; typeVariantName: string; status: string };

const ROOT = "root";
const LEVEL_SUGGESTIONS = ["Cluster", "Zone", "Block", "Tower", "Floor"];
/** Kolom status di daftar sublokasi; Booked dihitung sebagai Reserved. */
const CHILD_STATUSES = [
  { label: "Available", statuses: ["Available"], className: "bg-[#E7F8EC] text-[#12833B]" },
  { label: "Reserved", statuses: ["Reserved", "Booked"], className: "bg-[#FFF4DB] text-[#B54708]" },
  { label: "Sold", statuses: ["Sold"], className: "bg-[#FDECEC] text-[#D64545]" },
  { label: "Blocked", statuses: ["Blocked"], className: "bg-[#F2F4F7] text-[#667085]" },
];
const UNIT_CODE_SORTER = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });

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
  const kids = (pid: string) =>
    nodes.filter((n) => n.parentId === pid).sort((a, b) => UNIT_CODE_SORTER.compare(a.name, b.name));
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
  // Unit selalu dimiliki node terbawah aktual. Nama level bebas (Cluster, Zona,
  // Blok, Tower, atau level lain) dan tidak menentukan apakah unit boleh dibuat.
  const isLeaf = selected.id !== ROOT && children.length === 0;
  const selectedUnits = units.filter((u) => u.locationId === selected.id);
  const sortedSelectedUnits = [...selectedUnits].sort((a, b) => UNIT_CODE_SORTER.compare(a.code, b.code));
  const isUnitOrderSorted = selectedUnits.every((unit, index) => unit.id === sortedSelectedUnits[index]?.id);
  const sortSelectedUnits = () => {
    let sortedIndex = 0;
    onUnitsChange(units.map((unit) =>
      unit.locationId === selected.id ? (sortedSelectedUnits[sortedIndex++] ?? unit) : unit,
    ));
    toast.success("Daftar unit berhasil diurutkan.");
  };
  const desc = descendants(selected.id);
  const leaves = desc.filter((n) => kids(n.id).length === 0);
  const childRows = children.map((child) => {
    const ids = new Set([child.id, ...descendants(child.id).map((node) => node.id)]);
    const childUnits = units.filter((unit) => ids.has(unit.locationId));
    const sub = kids(child.id);
    return {
      node: child,
      sub: sub.length ? `${sub.length} ${sub[0].level}` : "-",
      total: childUnits.length,
      counts: CHILD_STATUSES.map(({ statuses }) => childUnits.filter((unit) => statuses.includes(unit.status)).length),
    };
  });
  // Buka lokasi dan induknya di pohon agar pilihan terlihat.
  const openChild = (id: string) => {
    setExpanded((current) => new Set([...current, selected.id, id]));
    setSelectedId(id);
  };

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Lokasi yang sudah berisi unit tidak boleh diberi sub-lokasi; unit hanya ada di lokasi paling bawah.
  const holdsUnits = (id: string) => id !== ROOT && unitCount(id) > 0;
  const openAdd = (parentId: string) =>
    setDraft({ id: null, parentId: holdsUnits(parentId) ? selected.parentId : parentId, name: "", level: "" });
  const openEdit = (n: LocationNode) => setDraft({ id: n.id, parentId: n.parentId, name: n.name, level: n.level });

  const remove = (id: string) => {
    if (kids(id).length > 0) {
      const name = nodes.find((node) => node.id === id)?.name ?? "Level";
      toast.error(`Level ${name} belum bisa dihapus karena masih memiliki level di bawahnya. Hapus level di bawahnya terlebih dahulu.`);
      return;
    }
    const gone = new Set([id, ...descendants(id).map((d) => d.id)]);
    onChange(nodes.filter((n) => !gone.has(n.id)));
    onUnitsChange(units.filter((u) => !gone.has(u.locationId)));
    if (gone.has(selectedId)) setSelectedId(ROOT);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    if (nodes.some((item) => item.id !== draft.id && item.parentId === draft.parentId && item.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.error(`Lokasi "${name}" sudah ada di parent yang sama. Gunakan nama lain.`);
      return;
    }
    const previous = nodes.find((item) => item.id === draft.id);
    const node: LocationNode = { id: draft.id ?? crypto.randomUUID(), ...(previous?.persistedId ? { persistedId: previous.persistedId } : {}), parentId: draft.parentId, name, level: draft.level.trim() };
    onChange(draft.id ? nodes.map((n) => (n.id === draft.id ? node : n)) : [...nodes, node]);
    if (!draft.id) setExpanded((s) => new Set(s).add(draft.parentId));
    setDraft(null);
  };

  const rowActions = (n: LocationNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Aksi lokasi" className="ml-auto cursor-pointer rounded p-1 hover:bg-[#E4E4E7]">
          <MoreVertical className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => openEdit(n)}>Edit</DropdownMenuItem>
        <DropdownMenuItem className="text-[#D64545]" onSelect={() => {
          if (kids(n.id).length > 0) {
            toast.error(`Level ${n.name} belum bisa dihapus karena masih memiliki level di bawahnya. Hapus level di bawahnya terlebih dahulu.`);
            return;
          }
          setPendingDelete(n);
        }}>Hapus</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderTree = (pid: string, depth: number): React.ReactNode =>
    kids(pid).map((n) => {
      const hasKids = kids(n.id).length > 0;
      return (
        <div key={n.id}>
          <TreeRow label={n.name} depth={depth} open={expanded.has(n.id)} hasKids={hasKids} active={selectedId === n.id} onToggle={() => toggle(n.id)} onSelect={() => setSelectedId(n.id)} onEdit={() => openEdit(n)} actions={rowActions(n)} />
          {hasKids && expanded.has(n.id) && renderTree(n.id, depth + 1)}
        </div>
      );
    });

  // Saat edit, parent tidak boleh diri sendiri atau turunannya (mencegah siklus).
  const blocked = new Set(draft?.id ? [draft.id, ...descendants(draft.id).map((d) => d.id)] : []);
  const currentParentId = nodes.find((n) => n.id === draft?.id)?.parentId;
  const parentOptions = [{ id: ROOT, name: rootName, level: "Project" }, ...nodes.filter((n) => !blocked.has(n.id) && (!holdsUnits(n.id) || n.id === currentParentId))];

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[#1f1f1f]">Location Hierarchy Setup</h3>
        <p className="text-xs text-[#6b6b6b]">Set up the project structure, add hierarchical levels (e.g., Cluster, Zone, Block, Tower, etc.), and manage the data.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex h-[70vh] min-h-[420px] max-h-[600px] flex-col rounded-lg border border-[#E4E4E7] p-4">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#1f1f1f]">Project Location Structure</span>
            <Button type="button" variant="outline" onClick={() => openAdd(selectedId)} className="h-8 gap-1 rounded-lg border-[#1980C0] bg-[#E8F3FA] px-3 text-xs text-[#1980C0] hover:bg-[#d6eaf6]">
              <Plus className="size-3.5" />
              Add Level
            </Button>
          </div>
          <ScrollArea className="-mr-2 min-h-0 flex-1 pr-2">
            <TreeRow label={rootName} depth={0} open={expanded.has(ROOT)} hasKids={kids(ROOT).length > 0} active={selectedId === ROOT} onToggle={() => toggle(ROOT)} onSelect={() => setSelectedId(ROOT)} />
            {expanded.has(ROOT) && renderTree(ROOT, 1)}
          </ScrollArea>
        </div>

        <div className="flex h-[70vh] min-h-[420px] max-h-[600px] flex-col gap-3 rounded-lg border border-[#E4E4E7] p-4">
          <div className="shrink-0">
            <h4 className="text-xs font-semibold text-[#1f1f1f]">Detail</h4>
            <p className="text-[11px] text-[#6b6b6b]">Manage the selected location information and add child locations under it</p>
          </div>

          <div className="shrink-0 rounded-lg border border-[#E4E4E7] p-3">
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
                  <Button type="button" variant="outline" onClick={() => {
                    if (children.length > 0) {
                      toast.error(`Level ${selected.name} belum bisa dihapus karena masih memiliki level di bawahnya. Hapus level di bawahnya terlebih dahulu.`);
                      return;
                    }
                    setPendingDelete(selected);
                  }} className="h-8 gap-1 border-[#D64545] bg-[#FDECEC] px-4 text-xs text-[#D64545] hover:bg-[#fbd9d9]">
                    <Trash2 className="size-3" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <DetailStat icon={<LayoutGrid className="size-4" />} label="Level" value={selected.level} />
              <DetailStat icon={<Layers className="size-4" />} label="Total child" value={children.length ? `${children.length} ${children[0].level}` : "-"} />
              <DetailStat icon={<Boxes className="size-4" />} label={leaves.length ? `Total ${leaves[0].level}` : "Unit Dibuat"} value={leaves.length ? `${leaves.length} ${leaves[0].level}` : `${totalUnits(selected.id)} Unit`} />
            </div>
          </div>

          {children.length > 0 && (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex shrink-0 items-baseline justify-between gap-3">
                <h4 className="text-sm font-semibold text-[#1f1f1f]">Daftar {children[0].level}</h4>
                <p className="text-xs text-[#667085]">
                  {totalUnits(selected.id)} unit dibuat
                  {selectedUnits.length > 0 && `, ${selectedUnits.length} langsung di ${selected.name}`}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#E4E4E7]">
                <table className="w-full min-w-[600px] text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#F8FAFC] text-[#1f1f1f]">
                    <tr>
                      {["Lokasi", "Sublokasi", "Unit", ...CHILD_STATUSES.map(({ label }) => label), ""].map((heading, index) => (
                        <th key={heading || index} className={cn("h-10 whitespace-nowrap px-3 font-medium", index > 1 && "text-center")}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {childRows.map(({ node, sub, total, counts }) => (
                      <tr key={node.id} onClick={() => openChild(node.id)} className="cursor-pointer border-t border-[#EDEDED] hover:bg-[#F8FAFC]">
                        <td className="px-3 py-2.5">
                          <button type="button" className="flex cursor-pointer items-center gap-2 text-left font-medium text-[#1f1f1f] hover:text-[#1980C0]">
                            <Folder className="size-4 shrink-0 text-[#1980C0]" />
                            <span>
                              {node.name}
                              <span className="block text-[11px] font-normal text-[#667085]">{node.level}</span>
                            </span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[#475467]">{sub}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-[#1f1f1f]">{total}</td>
                        {CHILD_STATUSES.map(({ label, className }, index) => (
                          <td key={label} className="px-3 py-2.5 text-center">
                            <span className={cn("inline-block min-w-9 rounded-md px-2 py-0.5 font-medium", className)}>{counts[index]}</span>
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right"><ChevronRight className="ml-auto size-4 text-[#667085]" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(isLeaf || selectedUnits.length > 0) && (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex shrink-0 items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-[#1f1f1f]">
                  {isLeaf ? "Daftar Unit" : `Unit langsung di ${selected.name}`}
                </h4>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={sortSelectedUnits} disabled={selectedUnits.length < 2 || isUnitOrderSorted} className="h-8 gap-1 rounded-lg px-3 text-xs">
                    <ArrowUpDown className="size-3.5" />
                    Sort Unit
                  </Button>
                  {isLeaf && <Button type="button" variant="outline" onClick={() => setUnitOpen(true)} className="h-8 gap-1 rounded-lg border-[#1980C0] bg-[#E8F3FA] px-3 text-xs text-[#1980C0] hover:bg-[#d6eaf6]">
                    <Plus className="size-3.5" />
                    Add Unit
                  </Button>}
                </div>
              </div>
              <ScrollArea className="min-h-0 flex-1 rounded-lg border border-[#E4E4E7]">
                <div className="min-w-[560px] overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow>
                      {["No Unit", "Type", "Status Unit", "Action"].map((h) => (
                        <TableHead key={h} className="h-10 whitespace-nowrap text-xs font-medium text-[#1f1f1f]">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedUnits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-20 text-center text-[#9CA3AF]">Belum ada unit di lokasi ini.</TableCell>
                      </TableRow>
                    ) : (
                      selectedUnits.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="whitespace-nowrap">{u.code}</TableCell>
                          <TableCell>{u.type}{u.typeVariantName && ` (${u.typeVariantName})`}</TableCell>
                          <TableCell>{u.status}</TableCell>
                          <TableCell>
                            <button type="button" aria-label="Delete unit" onClick={() => onUnitsChange(units.filter((x) => x.id !== u.id))} className="cursor-pointer rounded p-1 text-[#D64545] hover:bg-[#FDECEC]">
                              <Trash2 className="size-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </ScrollArea>
            </div>
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
          title={`Hapus “${pendingDelete.name}”?`}
          description={totalUnits(pendingDelete.id) > 0 ? (
            <>
              <strong>{totalUnits(pendingDelete.id)} unit</strong> di dalamnya juga akan dihapus. Penghapusan ini permanen dan tidak dapat dibatalkan.
            </>
          ) : (
            <>Penghapusan ini permanen dan tidak dapat dibatalkan.</>
          )}
          cancelLabel="Batal"
          confirmLabel="Hapus"
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
                <SearchableSelect
                  triggerClassName="h-11 rounded-lg text-sm"
                  value={draft.level || undefined}
                  onChange={(v) => setDraft({ ...draft, level: v ?? "" })}
                  placeholder="Pilih level"
                  searchPlaceholder="Cari level"
                  options={LEVEL_SUGGESTIONS.map((l) => ({ value: l, label: l }))}
                  clearable={false}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Parent</label>
                <SearchableSelect
                  triggerClassName="h-11 rounded-lg text-sm"
                  value={draft.parentId}
                  onChange={(v) => setDraft({ ...draft, parentId: v ?? ROOT })}
                  placeholder="Pilih parent"
                  searchPlaceholder="Cari nama atau lokasi induk"
                  // Nama lokasi bisa sama (mis. Lantai 1 di tiap tower), jadi induknya ikut ditampilkan dan dicari.
                  options={parentOptions.map((p) => ({ value: p.id, label: `${p.name} (${p.level})`, hint: pathOf(p.id) || undefined }))}
                  clearable={false}
                />
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

