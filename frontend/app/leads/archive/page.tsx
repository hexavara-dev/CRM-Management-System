"use client";

import { AppSidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type ArchiveCategory, useLeadArchive } from "@/hooks/use-lead-archive";
import { useProjects } from "@/hooks/use-projects";
import { useSources } from "@/hooks/use-sources";
import { useUsers } from "@/hooks/use-users";
import { ChevronLeft, ChevronRight, Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const labels: Record<ArchiveCategory, string> = { NOT_RESPOND: "Not Respond", INVALID: "Invalid", NOT_QUALIFIED: "Not Qualified" };
const categoryClass: Record<ArchiveCategory, string> = { NOT_RESPOND: "bg-red-100 text-red-700", INVALID: "bg-amber-100 text-amber-800", NOT_QUALIFIED: "bg-violet-100 text-violet-800" };

function dateTime(value?: string | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}

function CategoryDialog({ open, onOpenChange, initialCategory, initialReason, onSave, saving }: { open: boolean; onOpenChange: (open: boolean) => void; initialCategory?: ArchiveCategory; initialReason?: string | null; onSave: (category: ArchiveCategory, reason: string) => Promise<void>; saving: boolean }) {
  const [category, setCategory] = useState<ArchiveCategory>(initialCategory ?? "NOT_RESPOND");
  const [reason, setReason] = useState(initialReason ?? "");
  useEffect(() => { if (open) { setCategory(initialCategory ?? "NOT_RESPOND"); setReason(initialReason ?? ""); } }, [open, initialCategory, initialReason]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Ubah kategori arsip</DialogTitle><DialogDescription>Kategori wajib dipilih. Alasan bersifat opsional dan maksimal 500 karakter.</DialogDescription></DialogHeader>
    <label className="grid gap-1 text-sm font-medium">Kategori
      <select value={category} onChange={(event) => setCategory(event.target.value as ArchiveCategory)} disabled={saving} className="h-9 rounded-md border bg-background px-2">
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-sm font-medium">Alasan (opsional)
      <textarea value={reason} maxLength={500} disabled={saving} onChange={(event) => setReason(event.target.value)} className="min-h-24 rounded-md border p-2 text-sm" placeholder="Contoh: nomor tidak aktif" />
      <span className="text-right text-xs text-muted-foreground">{reason.length}/500</span>
    </label>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button><Button disabled={saving} onClick={() => void onSave(category, reason)}>{saving ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

export default function LeadArchivePage() {
  const [page, setPage] = useState(1); const [limit, setLimit] = useState(10); const [tab, setTab] = useState<"all" | ArchiveCategory>("all");
  const [searchInput, setSearchInput] = useState(""); const [search, setSearch] = useState(""); const [projectId, setProjectId] = useState(""); const [sourceId, setSourceId] = useState(""); const [assignedUserId, setAssignedUserId] = useState(""); const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<string[]>([]); const [editing, setEditing] = useState<{ id: string; category: ArchiveCategory; reason?: string | null } | null>(null); const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300); return () => window.clearTimeout(timer); }, [searchInput]);
  const params = useMemo(() => ({ page, limit, search: search || undefined, category: tab === "all" ? undefined : tab, projectId: projectId || undefined, sourceId: sourceId || undefined, assignedUserId: assignedUserId || undefined, direction }), [page, limit, search, tab, projectId, sourceId, assignedUserId, direction]);
  const archive = useLeadArchive(params); const projectsQuery = useProjects({ page: 1, limit: 100 }); const projects = projectsQuery.data?.data ?? []; const { sources } = useSources({ additionalParams: { type: "lead" } }); const { users } = useUsers();
  const rows = archive.data?.data ?? []; const meta = archive.data?.meta; const summary = archive.data?.summary ?? { total: 0, notRespond: 0, invalid: 0, notQualified: 0 };
  const selectAll = rows.length > 0 && rows.every((row) => selected.includes(row.id));
  const selectedHasDeals = rows.some((row) => selected.includes(row.id) && row.hasDeals);
  const toggle = (id: string, checked: boolean) => setSelected((previous) => checked ? [...new Set([...previous, id])] : previous.filter((item) => item !== id));
  const applyCategory = async (category: ArchiveCategory, reason: string) => { if (!editing) return; await archive.changeCategory({ id: editing.id, category, reason }); setEditing(null); };
  const confirmDelete = async () => { if (!deleteIds) return; if (deleteIds.length === 1) await archive.permanentDelete(deleteIds[0]); else await archive.bulkPermanentDelete(deleteIds); setSelected([]); setDeleteIds(null); };
  return <SidebarProvider className="overflow-hidden"><AppSidebar /><SidebarInset className="w-0">
    <header className="flex h-24 shrink-0 items-center border-b bg-background px-4">
      <div className="border-l pl-4">
        <h1 className="text-base font-semibold">Arsip Leads</h1>
        <Breadcrumb className="mt-1"><BreadcrumbList className="text-xs"><BreadcrumbItem>Leads Management</BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Arsip Leads</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
      </div>
    </header>
    <main className="min-h-screen bg-[#fafcff] p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[['Total Arsip', summary.total, 'bg-blue-50'], ['Not Respond', summary.notRespond, 'bg-rose-50'], ['Invalid', summary.invalid, 'bg-amber-50'], ['Not Qualified', summary.notQualified, 'bg-violet-50']].map(([title, total, color]) => <div key={String(title)} className={`rounded-xl border p-4 ${color}`}><p className="text-sm">{title}</p><p className="text-2xl font-bold">{total} Leads</p></div>)}
      </section>
      <nav aria-label="Kategori arsip" className="grid grid-cols-4 border-b border-[#E4E7EC] bg-white">
        {([['NOT_RESPOND', `Not Respond (${summary.notRespond})`], ['INVALID', `Invalid (${summary.invalid})`], ['NOT_QUALIFIED', `Not Qualified (${summary.notQualified})`], ['all', `Semua Arsip (${summary.total})`]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => { setTab(value); setPage(1); setSelected([]); }} className={`min-w-0 border-b-2 px-2 py-3 text-center text-sm font-medium transition-colors ${tab === value ? 'border-[#1980C0] text-[#1980C0]' : 'border-transparent text-[#667085] hover:text-[#344054]'}`}>{label}</button>)}
      </nav>
      <section className="grid gap-2 rounded-lg border bg-white p-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="relative md:col-span-2"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-8" maxLength={100} placeholder="Cari nama Leads atau No. HP..." /></div>
        <select aria-label="Filter Project" value={projectId} onChange={(e) => { setProjectId(e.target.value); setPage(1); setSelected([]); }} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="">Semua Project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        <select aria-label="Filter Sumber Leads" value={sourceId} onChange={(e) => { setSourceId(e.target.value); setPage(1); setSelected([]); }} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="">Semua Sumber</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select>
        <select aria-label="Filter Assigned Sales" value={assignedUserId} onChange={(e) => { setAssignedUserId(e.target.value); setPage(1); setSelected([]); }} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="">Semua Sales</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select>
        <select aria-label="Urutkan tanggal arsip" value={direction} onChange={(e) => { setDirection(e.target.value as "asc" | "desc"); setSelected([]); }} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="desc">Terbaru Diarsipkan</option><option value="asc">Terlama Diarsipkan</option></select>
      </section>
      <div aria-hidden={selected.length === 0} className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${selected.length > 0 ? "max-h-24 opacity-100" : "max-h-0 opacity-0"}`}><section className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3"><span className="mr-2 text-sm font-medium">{selected.length} dipilih</span><Button size="sm" variant="outline" disabled={archive.isMutating || selected.length === 0} onClick={() => void archive.bulkReactivate(selected).then(() => setSelected([]))}><RotateCcw /> Aktifkan Kembali</Button><Button size="sm" variant="outline" disabled={archive.isMutating || selected.length === 0} onClick={() => setEditing({ id: "", category: "NOT_RESPOND" })}><Pencil /> Ubah Kategori</Button><Button size="sm" variant="destructive" title={selectedHasDeals ? "Lead yang sudah memiliki Deal tidak dapat dihapus permanen" : undefined} disabled={archive.isMutating || selected.length === 0 || selectedHasDeals} onClick={() => setDeleteIds(selected)}><Trash2 /> Hapus Permanen</Button>{selectedHasDeals && <span className="text-xs text-muted-foreground">Lead dengan Deal tidak dapat dihapus permanen.</span>}</section></div>
      <section className="overflow-x-auto rounded-lg border bg-white"><Table className="min-w-[1400px]"><TableHeader><TableRow><TableHead><Checkbox checked={selectAll} onCheckedChange={(checked) => setSelected(checked === true ? rows.map((row) => row.id) : [])} aria-label="Pilih semua Lead" /></TableHead><TableHead className="min-w-[240px]">Nama Leads</TableHead><TableHead>No HP</TableHead><TableHead>Project</TableHead><TableHead>Sumber Leads</TableHead><TableHead>Fase Terakhir</TableHead><TableHead>Alasan Arsip</TableHead><TableHead>Tanggal Diarsipkan</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader><TableBody>
        {archive.isLoading ? <TableRow><TableCell colSpan={9} className="h-28 text-center">Memuat arsip...</TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={9} className="h-28 text-center">Tidak ada Lead dalam arsip untuk filter ini.</TableCell></TableRow> : rows.map((lead) => <TableRow key={lead.id}><TableCell><Checkbox checked={selected.includes(lead.id)} onCheckedChange={(checked) => toggle(lead.id, checked === true)} aria-label={`Pilih ${lead.name}`} /></TableCell><TableCell className="min-w-[240px] whitespace-nowrap"><Link className="font-medium text-primary hover:underline" href={`/leads/${lead.id}`}>{lead.name}</Link></TableCell><TableCell className="whitespace-nowrap">{lead.customer.phoneNumber || "-"}</TableCell><TableCell>{lead.project?.name || "-"}</TableCell><TableCell>{lead.source?.name || "-"}</TableCell><TableCell>{lead.stage?.name || "-"}</TableCell><TableCell className="min-w-[320px]"><Badge className={`${categoryClass[lead.archiveCategory!]} h-auto max-w-[320px] items-start rounded-lg px-3 py-2 text-left`}><span className="grid gap-0.5 whitespace-normal"><span className="font-semibold">{labels[lead.archiveCategory!]}</span>{lead.archiveReason && <span className="text-xs font-normal leading-4 opacity-85">({lead.archiveReason})</span>}</span></Badge></TableCell><TableCell className="whitespace-nowrap">{dateTime(lead.archivedAt)}</TableCell><TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" title="Aktifkan kembali" aria-label={`Aktifkan kembali ${lead.name}`} disabled={archive.isMutating} onClick={() => void archive.reactivate(lead.id)}><RotateCcw /></Button><Button size="icon" variant="ghost" title="Ubah kategori" aria-label={`Ubah kategori ${lead.name}`} disabled={archive.isMutating} onClick={() => setEditing({ id: lead.id, category: lead.archiveCategory!, reason: lead.archiveReason })}><Pencil /></Button><Button size="icon" variant="ghost" title={lead.hasDeals ? "Lead dengan Deal tidak dapat dihapus permanen" : "Hapus permanen"} aria-label={`Hapus permanen ${lead.name}`} disabled={archive.isMutating || lead.hasDeals} onClick={() => setDeleteIds([lead.id])}><Trash2 className="text-destructive" /></Button></div></TableCell></TableRow>)}
      </TableBody></Table></section>
      <footer className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-muted-foreground">Menampilkan {rows.length} dari {meta?.total ?? 0} data</div><div className="flex items-center gap-2"><select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); setSelected([]); }} className="h-8 rounded-md border px-2 text-sm">{[10, 20, 30, 50].map((value) => <option key={value} value={value}>{value}/halaman</option>)}</select><Button variant="outline" size="icon" disabled={!meta || page <= 1 || archive.isFetching} onClick={() => { setPage((value) => value - 1); setSelected([]); }}><ChevronLeft /></Button><span className="text-sm">{meta ? `${meta.page} / ${Math.max(meta.totalPages, 1)}` : "-"}</span><Button variant="outline" size="icon" disabled={!meta || page >= meta.totalPages || archive.isFetching} onClick={() => { setPage((value) => value + 1); setSelected([]); }}><ChevronRight /></Button></div></footer>
    </div></main>
    <CategoryDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} initialCategory={editing?.category} initialReason={editing?.reason} saving={archive.isMutating} onSave={async (category, reason) => { if (editing?.id) await applyCategory(category, reason); else { await archive.bulkChangeCategory({ ids: selected, category, reason }); setSelected([]); setEditing(null); } }} />
    <ConfirmModal isOpen={deleteIds !== null} onClose={() => setDeleteIds(null)} onConfirm={() => void confirmDelete()} title="Hapus permanen Lead?" description={`Lead dan aktivitas terkait akan dihapus permanen. ${deleteIds?.length ?? 0} Lead dipilih dan tindakan ini tidak dapat dibatalkan.`} loading={archive.isMutating} confirmLabel="Hapus Permanen" />
  </SidebarInset></SidebarProvider>;
}
