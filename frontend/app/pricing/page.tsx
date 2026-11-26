"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, History, Layers, MoreVertical, Pencil, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/projects/stat-card";
import { useAuth } from "@/components/auth/auth-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/hooks/use-projects";
import {
  BULK_ADJUSTMENT_MAX_UNITS,
  PRICE_APPROVAL_ENABLED,
  formatDay,
  formatPrice,
  formatSigned,
  usePriceFilterOptions,
  useUnitPrices,
  type UnitPriceRow,
  type UnitStatus,
} from "@/hooks/use-unit-prices";
import { cn } from "@/lib/utils";
import { pageItems } from "@/lib/pagination";
import { PendingAdjustments } from "./pending-adjustments";
import { UNIT_STATUS_LABEL, UnitStatusBadge } from "./status-badge";
import { AdjustPriceDialog, PriceHistoryDialog } from "./unit-price-dialogs";
import { SearchableSelect, type ComboOption } from "@/components/ui/searchable-select";
import { BulkAdjustDialog } from "./bulk-adjust-dialog";

const PAGE_SIZE = 10;
const STATUSES = Object.keys(UNIT_STATUS_LABEL) as UnitStatus[];
const LOCATION_TYPE_LABEL: Record<string, string> = {
  CLUSTER: "Cluster",
  ZONE: "Zona",
  BLOCK: "Blok",
  TOWER: "Tower",
  FLOOR: "Lantai",
};

export default function PricingPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "owner";

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  // Filter bertahap: project dulu, lalu lokasi dan tipe di dalam project itu.
  const [productId, setProductId] = useState<string>();
  const [clusterId, setClusterId] = useState<string>();
  const [blockId, setBlockId] = useState<string>();
  const categoryId = blockId ?? clusterId;
  const [variantId, setVariantId] = useState<string>();
  const [status, setStatus] = useState<UnitStatus>();
  const [adjustUnit, setAdjustUnit] = useState<string>();
  const [historyUnit, setHistoryUnit] = useState<string>();
  // Unit terpilih untuk ubah massal, tetap tersimpan saat pindah halaman atau filter dalam project yang sama.
  const [selected, setSelected] = useState<Map<string, UnitPriceRow>>(new Map());
  const [bulkOpen, setBulkOpen] = useState(false);
  const search = useDebouncedValue(query.trim());

  const prices = useUnitPrices({ page, limit: PAGE_SIZE, search, productId, categoryId, variantId, status });
  const options = usePriceFilterOptions(productId);

  /**
   * Lokasi di bawah project terpilih: tingkat teratas (Cluster/Tower) dan tingkat paling bawah
   * (Blok/Lantai), apa pun nama levelnya.
   * Keterangan berisi jenis lokasi dan jalur induknya di dalam project.
   */
  const { clusterOptions, blockOptions } = useMemo(() => {
    const root = options.project.data?.categoryId;
    if (!root) return { clusterOptions: [] as ComboOption[], blockOptions: [] as ComboOption[] };
    const all = options.locations.data ?? [];
    const byId = new Map(all.map((c) => [c.id, c]));
    /** Id induk dari bawah ke atas sampai sebelum node project; null bila di luar project. */
    const ancestorsInProject = (id: string): string[] | null => {
      const chain: string[] = [];
      let current = byId.get(id)?.parentId;
      while (current) {
        if (current === root) return chain;
        chain.push(current);
        current = byId.get(current)?.parentId ?? null;
      }
      return null;
    };
    const toOption = (c: (typeof all)[number], ancestors: string[]): ComboOption => {
      const type = LOCATION_TYPE_LABEL[c.type] ?? c.type;
      const path = ancestors
        .map((id) => byId.get(id)?.name)
        .filter(Boolean)
        .reverse();
      return { value: c.id, label: c.name, hint: path.length ? `${type} · ${path.join(" › ")}` : type };
    };
    const byHint = (a: ComboOption, b: ComboOption) => `${a.hint}${a.label}`.localeCompare(`${b.hint}${b.label}`);

    const clusters: ComboOption[] = [];
    const blocks: ComboOption[] = [];
    const hasChildren = new Set(all.map((c) => c.parentId));
    for (const c of all) {
      if (c.id === root || c.type === "CATEGORY") continue;
      const ancestors = ancestorsInProject(c.id);
      if (!ancestors) continue;
      const top = ancestors.length === 0;
      const leaf = !hasChildren.has(c.id);
      // Lokasi tanpa sub-lokasi di tingkat teratas cukup muncul sebagai pilihan teratas.
      if (top) clusters.push(toOption(c, ancestors));
      else if (leaf && (!clusterId || ancestors.includes(clusterId))) blocks.push(toOption(c, ancestors));
    }
    return { clusterOptions: clusters.sort(byHint), blockOptions: blocks.sort(byHint) };
  }, [options.locations.data, options.project.data, clusterId]);

  const locationLoading = options.project.isLoading || options.locations.isLoading;

  const summary = prices.data?.summary;
  const selectedProject = (options.projects.data ?? []).find((p) => p.id === productId);
  const rows = prices.data?.data ?? [];
  const total = prices.data?.meta.total ?? 0;
  const totalPages = Math.max(1, prices.data?.meta.totalPages ?? 1);
  const start = (page - 1) * PAGE_SIZE;

  // Ubah massal hanya untuk satu project: dikunci oleh unit pertama yang dipilih,
  // atau oleh filter project bila belum ada yang dipilih.
  const canSelect = canWrite;
  const firstSelected = selected.values().next().value as UnitPriceRow | undefined;
  const lockedProject = firstSelected?.product ?? (selectedProject ? { id: selectedProject.id, name: selectedProject.name } : undefined);
  const lockReason = (row: UnitPriceRow) =>
    row.status === "SOLD"
      ? "Unit terjual tidak bisa diubah"
      : lockedProject && row.product.id !== lockedProject.id
        ? `Hanya unit dari ${lockedProject.name}`
        : undefined;
  const mixedPage = new Set(rows.map((row) => row.product.id)).size > 1;
  const selectableRows = lockedProject || !mixedPage ? rows.filter((row) => !lockReason(row)) : [];
  const pageSelected = selectableRows.filter((row) => selected.has(row.unitId)).length;
  const toggleRows = (targets: UnitPriceRow[], checked: boolean) =>
    setSelected((current) => {
      const next = new Map(current);
      for (const row of targets) {
        if (checked) next.set(row.unitId, row);
        else next.delete(row.unitId);
      }
      return next;
    });
  const tooMany = selected.size > BULK_ADJUSTMENT_MAX_UNITS;

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3 empty:hidden">
          <SidebarOpenTrigger />
        </header>
        <div className="space-y-4 p-4">
          <PageHeading />

          <hr className="border-[#EDEDED]" />

          <div className={cn("grid grid-cols-2 gap-3", PRICE_APPROVAL_ENABLED ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
            {selectedProject ? (
              <StatCard label="Project" value={selectedProject.name} color="text-[#1980C0]" hint="Filter project aktif" />
            ) : (
              <StatCard
                label="Total Project"
                value={summary?.totalProjects ?? 0}
                color="text-[#1980C0]"
                hint="Project yang memiliki unit"
              />
            )}
            <StatCard
              label="Unit Terdaftar"
              value={summary?.totalUnits ?? 0}
              color="text-[#1f1f1f]"
              hint={
                summary
                  ? `Sold ${summary.byStatus.SOLD} · Reserved ${summary.byStatus.RESERVED} · Booked ${summary.byStatus.BOOKED}`
                  : undefined
              }
            />
            <StatCard
              label="Unit Available"
              value={summary?.byStatus.AVAILABLE ?? 0}
              color="text-[#D9822B]"
              hint={
                summary && summary.totalUnits > 0
                  ? `${Math.round((summary.byStatus.AVAILABLE / summary.totalUnits) * 100)}% dari total unit`
                  : undefined
              }
            />
            <StatCard
              label="Nilai Harga Jual"
              value={<span title={summary ? formatPrice(summary.unsoldValue) : undefined}>{formatPrice(summary?.unsoldValue ?? 0)}</span>}
              color="text-[#1E9E55]"
              hint="Total unit yang belum terjual"
            />
            {PRICE_APPROVAL_ENABLED && (
              <StatCard
                label="Menunggu Approval"
                value={summary?.pendingAdjustments ?? 0}
                color="text-[#D9822B]"
              />
            )}
          </div>

          <Tabs defaultValue="list">
            {PRICE_APPROVAL_ENABLED && (
              <TabsList variant="line">
                <TabsTrigger value="list">Daftar Harga</TabsTrigger>
                <TabsTrigger value="pending">Menunggu Approval</TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="list" className="space-y-4 pt-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-1">
                  <SearchableSelect
                    className="lg:flex-1"
                    value={productId}
                    placeholder="Semua project"
                    loading={options.projects.isLoading}
                    options={(options.projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                    onChange={(value) => {
                      setProductId(value);
                      setSelected(new Map());
                      setClusterId(undefined);
                      setBlockId(undefined);
                      setVariantId(undefined);
                      setPage(1);
                    }}
                  />
                  <SearchableSelect
                    className="lg:flex-1"
                    value={clusterId}
                    placeholder="Semua cluster / tower"
                    disabled={!productId || (!locationLoading && clusterOptions.length === 0)}
                    disabledHint={productId ? "Tidak ada cluster" : "Pilih project dulu"}
                    loading={locationLoading}
                    options={clusterOptions}
                    onChange={(value) => {
                      setClusterId(value);
                      setBlockId(undefined);
                      setPage(1);
                    }}
                  />
                  <SearchableSelect
                    className="lg:flex-1"
                    value={blockId}
                    placeholder="Semua blok / lantai"
                    disabled={!productId}
                    disabledHint="Pilih project dulu"
                    loading={locationLoading}
                    options={blockOptions}
                    onChange={resetPage(setBlockId)}
                  />
                  <SearchableSelect
                    className="lg:flex-1"
                    value={variantId}
                    placeholder="Semua tipe"
                    disabled={!productId}
                    disabledHint="Pilih project dulu"
                    loading={options.project.isLoading}
                    options={(options.project.data?.variants ?? []).map((v) => ({ value: v.id, label: v.name }))}
                    onChange={resetPage(setVariantId)}
                  />
                  <SearchableSelect
                    className="lg:flex-1"
                    value={status}
                    placeholder="Semua status"
                    options={STATUSES.map((s) => ({ value: s, label: UNIT_STATUS_LABEL[s] }))}
                    onChange={resetPage((value?: string) => setStatus(value as UnitStatus | undefined))}
                  />
                </div>
                <div className="relative w-full lg:w-48 lg:shrink-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => resetPage(setQuery)(e.target.value)}
                    placeholder="Cari nomor unit"
                    className="h-8 w-full pl-8"
                  />
                </div>
              </div>

              {selected.size > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border border-[#1980C0]/30 bg-[#E5F1FA] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#1f1f1f]">
                    <span className="font-semibold">{selected.size} unit</span> dipilih
                    {firstSelected && <span className="text-[#6b6b6b]"> · {firstSelected.product.name}</span>}
                    {tooMany && (
                      <span className="ml-1 text-[#D64545]">· maksimal {BULK_ADJUSTMENT_MAX_UNITS} unit</span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setSelected(new Map())}>
                      <X className="size-3.5" />
                      Batal
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={tooMany}
                      onClick={() => setBulkOpen(true)}
                      className="h-8 bg-[#1980C0] text-white hover:bg-[#166ea6]"
                    >
                      <Layers className="size-3.5" />
                      Ubah harga massal
                    </Button>
                  </div>
                </div>
              )}

              {prices.isLoading ? (
                <Skeleton className="h-72 rounded-xl" />
              ) : prices.isError ? (
                <div className="rounded-xl border border-dashed border-[#D64545]/40 py-16 text-center text-sm text-[#D64545]">
                  {errorMessage(prices.error, "Gagal memuat daftar harga.")}
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E4E4E7] py-16 text-center text-sm text-[#6b6b6b]">
                  Tidak ada unit yang cocok dengan filter.
                </div>
              ) : (
                <div className={cn("rounded-xl border border-[#E4E4E7]", prices.isFetching && "opacity-70")}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canSelect && (
                          <TableHead className="w-10">
                            <Checkbox
                              aria-label="Pilih semua unit di halaman ini"
                              title={
                                selectableRows.length === 0 && mixedPage && !lockedProject
                                  ? "Pilih project atau centang satu unit dulu"
                                  : undefined
                              }
                              disabled={selectableRows.length === 0}
                              checked={
                                pageSelected === 0
                                  ? false
                                  : pageSelected === selectableRows.length
                                    ? true
                                    : "indeterminate"
                              }
                              onCheckedChange={(checked) => toggleRows(selectableRows, checked === true)}
                            />
                          </TableHead>
                        )}
                        <TableHead>Unit</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Harga Dasar</TableHead>
                        <TableHead className="text-right">Penyesuaian</TableHead>
                        <TableHead className="text-right">Harga Jual</TableHead>
                        <TableHead className="w-10">
                          <span className="sr-only">Aksi</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.unitId} data-state={selected.has(row.unitId) ? "selected" : undefined}>
                          {canSelect && (
                            <TableCell>
                              <Checkbox
                                aria-label={`Pilih unit ${row.code}`}
                                title={lockReason(row)}
                                disabled={!!lockReason(row) && !selected.has(row.unitId)}
                                checked={selected.has(row.unitId)}
                                onCheckedChange={(checked) => toggleRows([row], checked === true)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <span className="font-semibold text-[#1f1f1f]">{row.code}</span>
                              {PRICE_APPROVAL_ENABLED && row.hasPendingAdjustment && (
                                <span className="rounded-full bg-[#FFF1E0] px-1.5 py-0.5 text-[10px] text-[#D9822B]">
                                  Menunggu approval
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 whitespace-nowrap text-xs text-[#6b6b6b]">
                              {row.product.name} · {row.variant.name} · {row.location.path || row.location.name}
                            </p>
                          </TableCell>
                          <TableCell>
                            <UnitStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">{formatPrice(row.basePrice)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {row.priceLogTotal === 0 && row.adjustment === 0 ? (
                              <span className="text-[#6b6b6b]">-</span>
                            ) : (
                              <div className="space-y-0.5">
                                {row.priceLogTotal !== 0 && (
                                  <p>
                                    {formatSigned(row.priceLogTotal)}
                                    <span className="ml-1 text-xs text-[#6b6b6b]">kenaikan tipe</span>
                                  </p>
                                )}
                                {row.adjustment !== 0 && (
                                  <p className={row.adjustment > 0 ? "text-[#1E9E55]" : "text-[#D64545]"}>
                                    {formatSigned(row.adjustment)}
                                    <span className="ml-1 text-xs text-[#6b6b6b]">unit</span>
                                  </p>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">
                            {formatPrice(row.sellingPrice)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Aksi unit ${row.code}`}
                                >
                                  <MoreVertical className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              {/* Tanpa batas tinggi agar menu berpindah ke atas pada baris terbawah, bukan terpotong. */}
                              <DropdownMenuContent align="end" collisionPadding={8} className="max-h-none min-w-48">

                                <DropdownMenuItem onSelect={() => setHistoryUnit(row.unitId)}>
                                  <History className="size-4" />
                                  Riwayat harga
                                </DropdownMenuItem>
                                {canWrite && (
                                  <DropdownMenuItem
                                    disabled={row.status === "SOLD"}
                                    onSelect={() => setAdjustUnit(row.unitId)}
                                  >
                                    <Pencil className="size-4" />
                                    {row.status === "SOLD" ? "Atur harga (unit terjual)" : "Atur harga"}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#6b6b6b]">
                <p>
                  Showing {total === 0 ? 0 : start + 1} - {start + rows.length} of {total} units. Harga per{" "}
                  {prices.data ? formatDay(prices.data.summary.date) : "-"}.
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  {pageItems(page, totalPages).map((n, gapIndex) =>
                  n === "gap" ? (
                    <span key={`gap-${gapIndex}`} className="px-1 text-xs text-muted-foreground" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <Button
                      key={n}
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setPage(n)}
                      className={cn(n === page && "border-[#1980C0] bg-[#1980C0] text-white hover:bg-[#166ea6] hover:text-white")}
                    >
                      {n}
                    </Button>
                  ))}
                  <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            {PRICE_APPROVAL_ENABLED && (
              <TabsContent value="pending" className="pt-3">
                <PendingAdjustments canWrite={canWrite} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </SidebarInset>

      {canWrite && (
        <AdjustPriceDialog unitId={adjustUnit} onOpenChange={(open) => !open && setAdjustUnit(undefined)} />
      )}
      {canWrite && (
        <BulkAdjustDialog
          units={[...selected.values()]}
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          onSaved={() => {
            setBulkOpen(false);
            setSelected(new Map());
          }}
        />
      )}
      <PriceHistoryDialog unitId={historyUnit} onOpenChange={(open) => !open && setHistoryUnit(undefined)} />
    </SidebarProvider>
  );
}
