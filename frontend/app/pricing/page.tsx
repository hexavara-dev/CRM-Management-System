"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, History, MoreVertical, Pencil, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
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
  PRICE_APPROVAL_ENABLED,
  formatDay,
  formatPrice,
  formatSigned,
  usePriceFilterOptions,
  useUnitPrices,
  type UnitStatus,
} from "@/hooks/use-unit-prices";
import { cn } from "@/lib/utils";
import { PendingAdjustments } from "./pending-adjustments";
import { UNIT_STATUS_LABEL, UnitStatusBadge } from "./status-badge";
import { AdjustPriceDialog, PriceHistoryDialog } from "./unit-price-dialogs";
import { FilterCombobox, type ComboOption } from "./filter-combobox";

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
  const [categoryId, setCategoryId] = useState<string>();
  const [variantId, setVariantId] = useState<string>();
  const [status, setStatus] = useState<UnitStatus>();
  const [adjustUnit, setAdjustUnit] = useState<string>();
  const [historyUnit, setHistoryUnit] = useState<string>();
  const search = useDebouncedValue(query.trim());

  const prices = useUnitPrices({ page, limit: PAGE_SIZE, search, productId, categoryId, variantId, status });
  const options = usePriceFilterOptions(productId);

  /** Lokasi di bawah project terpilih, dengan jalur induknya sebagai keterangan. */
  const locationOptions = useMemo<ComboOption[]>(() => {
    const root = options.project.data?.categoryId;
    if (!root) return [];
    const all = options.locations.data ?? [];
    const byId = new Map(all.map((c) => [c.id, c]));
    const pathOf = (id: string | null): string[] => {
      const names: string[] = [];
      let current = id ? byId.get(id) : undefined;
      while (current && current.id !== root) {
        names.unshift(current.name);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      return names;
    };
    const inProject = (id: string) => {
      let current = byId.get(id);
      while (current) {
        if (current.parentId === root) return true;
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      return false;
    };
    return all
      .filter((c) => c.id !== root && c.type !== "CATEGORY" && inProject(c.id))
      .map((c) => {
        const parents = pathOf(c.parentId);
        const type = LOCATION_TYPE_LABEL[c.type] ?? c.type;
        return { value: c.id, label: c.name, hint: parents.length ? `${type} · ${parents.join(" › ")}` : type };
      })
      .sort((a, b) => (a.hint + a.label).localeCompare(b.hint + b.label));
  }, [options.locations.data, options.project.data]);

  const summary = prices.data?.summary;
  const selectedProject = (options.projects.data ?? []).find((p) => p.id === productId);
  const rows = prices.data?.data ?? [];
  const total = prices.data?.meta.total ?? 0;
  const totalPages = Math.max(1, prices.data?.meta.totalPages ?? 1);
  const start = (page - 1) * PAGE_SIZE;

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
              label="Total Unit"
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <FilterCombobox
                    value={productId}
                    placeholder="Semua project"
                    loading={options.projects.isLoading}
                    options={(options.projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                    onChange={(value) => {
                      setProductId(value);
                      setCategoryId(undefined);
                      setVariantId(undefined);
                      setPage(1);
                    }}
                  />
                  <FilterCombobox
                    value={categoryId}
                    placeholder="Semua lokasi"
                    disabled={!productId}
                    disabledHint="Pilih project dulu"
                    loading={options.project.isLoading || options.locations.isLoading}
                    options={locationOptions}
                    onChange={resetPage(setCategoryId)}
                  />
                  <FilterCombobox
                    value={variantId}
                    placeholder="Semua tipe"
                    disabled={!productId}
                    disabledHint="Pilih project dulu"
                    loading={options.project.isLoading}
                    options={(options.project.data?.variants ?? []).map((v) => ({ value: v.id, label: v.name }))}
                    onChange={resetPage(setVariantId)}
                  />
                  <FilterCombobox
                    value={status}
                    placeholder="Semua status"
                    options={STATUSES.map((s) => ({ value: s, label: UNIT_STATUS_LABEL[s] }))}
                    onChange={resetPage((value?: string) => setStatus(value as UnitStatus | undefined))}
                  />
                </div>
                <div className="relative w-full sm:w-auto">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => resetPage(setQuery)(e.target.value)}
                    placeholder="Cari nomor unit"
                    className="h-8 w-full pl-8 sm:w-56"
                  />
                </div>
              </div>

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
                        <TableRow key={row.unitId}>
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
                              {row.product.name} · {row.variant.name} · {row.location.name}
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
                              <DropdownMenuContent align="end">
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
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
      <PriceHistoryDialog unitId={historyUnit} onOpenChange={(open) => !open && setHistoryUnit(undefined)} />
    </SidebarProvider>
  );
}
