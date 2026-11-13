"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, History, Pencil, Search } from "lucide-react";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/projects/stat-card";
import { useAuth } from "@/components/auth/auth-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/hooks/use-projects";
import {
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

const PAGE_SIZE = 10;
const ALL = "all";
const STATUSES = Object.keys(UNIT_STATUS_LABEL) as UnitStatus[];

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  disabled,
  loading,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 w-full text-xs sm:w-44" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {loading && (
          <SelectItem value="__loading" disabled>
            Memuat...
          </SelectItem>
        )}
        {!loading && options.length === 0 && (
          <SelectItem value="__empty" disabled>
            Tidak ada data
          </SelectItem>
        )}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function PricingPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "owner";

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [variantId, setVariantId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [adjustUnit, setAdjustUnit] = useState<string>();
  const [historyUnit, setHistoryUnit] = useState<string>();
  const search = useDebouncedValue(query.trim());

  const pick = (value: string) => (value === ALL ? undefined : value);
  const prices = useUnitPrices({
    page,
    limit: PAGE_SIZE,
    search,
    productId: pick(productId),
    categoryId: pick(categoryId),
    variantId: pick(variantId),
    status: pick(status) as UnitStatus | undefined,
  });
  const options = usePriceFilterOptions(pick(productId));

  const locationOptions = useMemo(() => {
    const all = (options.locations.data ?? []).filter((c) => c.type !== "CATEGORY");
    const root = options.project.data?.categoryId;
    if (!root) return all.map((c) => ({ value: c.id, label: c.name }));
    const inProject = new Set([root]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of all) {
        if (c.parentId && inProject.has(c.parentId) && !inProject.has(c.id)) {
          inProject.add(c.id);
          grew = true;
        }
      }
    }
    return all.filter((c) => inProject.has(c.id) && c.id !== root).map((c) => ({ value: c.id, label: c.name }));
  }, [options.locations.data, options.project.data]);

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

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Unit" value={prices.data?.summary.totalUnits ?? 0} color="text-[#1f1f1f]" />
            <StatCard
              label="Menunggu Approval"
              value={prices.data?.summary.pendingAdjustments ?? 0}
              color="text-[#D9822B]"
            />
          </div>

          <Tabs defaultValue="list">
            <TabsList variant="line">
              <TabsTrigger value="list">Daftar Harga</TabsTrigger>
              <TabsTrigger value="pending">Menunggu Approval</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <FilterSelect
                    value={productId}
                    placeholder="Semua project"
                    loading={options.projects.isLoading}
                    options={(options.projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                    onChange={(value) => {
                      setProductId(value);
                      setCategoryId(ALL);
                      setVariantId(ALL);
                      setPage(1);
                    }}
                  />
                  <FilterSelect
                    value={categoryId}
                    placeholder="Semua lokasi"
                    loading={options.locations.isLoading}
                    options={locationOptions}
                    onChange={resetPage(setCategoryId)}
                  />
                  <FilterSelect
                    value={variantId}
                    placeholder="Semua tipe"
                    disabled={productId === ALL}
                    loading={options.project.isLoading}
                    options={(options.project.data?.variants ?? []).map((v) => ({ value: v.id, label: v.name }))}
                    onChange={resetPage(setVariantId)}
                  />
                  <FilterSelect
                    value={status}
                    placeholder="Semua status"
                    options={STATUSES.map((s) => ({ value: s, label: UNIT_STATUS_LABEL[s] }))}
                    onChange={resetPage(setStatus)}
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
                        <TableHead>No. Unit</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead>Lokasi</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Harga Dasar</TableHead>
                        <TableHead className="text-right">Kenaikan</TableHead>
                        <TableHead className="text-right">Penyesuaian</TableHead>
                        <TableHead className="text-right">Harga Jual</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.unitId}>
                          <TableCell className="font-medium">
                            {row.code}
                            {row.hasPendingAdjustment && (
                              <span className="ml-2 rounded-full bg-[#FFF1E0] px-1.5 py-0.5 text-[10px] text-[#D9822B]">
                                Approval
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{row.product.name}</TableCell>
                          <TableCell>{row.variant.name}</TableCell>
                          <TableCell>{row.location.name}</TableCell>
                          <TableCell>
                            <UnitStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="text-right">{formatPrice(row.basePrice)}</TableCell>
                          <TableCell className="text-right text-[#6b6b6b]">
                            {row.priceLogTotal ? formatSigned(row.priceLogTotal) : "-"}
                          </TableCell>
                          <TableCell className="text-right text-[#6b6b6b]">
                            {row.adjustment ? formatSigned(row.adjustment) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatPrice(row.sellingPrice)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-lg px-2 text-xs"
                                onClick={() => setHistoryUnit(row.unitId)}
                              >
                                <History className="size-3.5" />
                                Riwayat
                              </Button>
                              {canWrite && (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 rounded-lg bg-[#1980C0] px-2 text-xs text-white hover:bg-[#166ea6]"
                                  disabled={row.status === "SOLD"}
                                  title={row.status === "SOLD" ? "Unit sudah terjual" : undefined}
                                  onClick={() => setAdjustUnit(row.unitId)}
                                >
                                  <Pencil className="size-3.5" />
                                  Atur harga
                                </Button>
                              )}
                            </div>
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
                  {prices.data?.summary.date ?? "-"}.
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

            <TabsContent value="pending" className="pt-3">
              <PendingAdjustments canWrite={canWrite} />
            </TabsContent>
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
