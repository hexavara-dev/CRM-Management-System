"use client";

import { AddDealDialog } from "@/app/deals/components/add-deal-dialog";
import { DealsPipelineTab } from "@/app/deals/components/deals-pipeline-tab";
import { AppSidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type DealFilters, useDeals } from "@/hooks/use-deals";
import { useFinancingBanks } from "@/hooks/use-financing-banks";
import { usePipelineStages } from "@/hooks/use-pipeline-stages";
import { useProjects } from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import { formatRupiah } from "@/lib/helper";
import type { DealPaymentMethod } from "@/types/deal";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Columns3,
  Eye,
  FileText,
  List,
  type LucideIcon,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

const HIDDEN_STAGES_KEY = "deals-pipeline-hidden-stages";

const paymentLabels: Record<DealPaymentMethod, string> = {
  CASH: "Tunai",
  KPR: "KPR",
  KPR_SHARIA: "KPR Syariah",
};

const dealColumnWidths: Record<string, string> = {
  "No.": "w-9",
  "Lead/Customer": "w-35",
  Project: "w-32.5",
  Unit: "w-20",
  "Harga Deals": "w-27.5",
  Pembayaran: "w-25",
  Bank: "w-25",
  "Fase Deal": "w-35",
  "Assigned Sales": "w-28.5",
  "Last Activity": "w-25",
  Hari: "w-15",
  Actions: "w-22.5",
};

const daysSince = (value?: string) =>
  value
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000),
      )
    : null;

const dateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateLabel = (date: Date) =>
  date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/** Ringkasan KPI harus tetap terbaca tanpa meluber dari kartu. */
const formatCompactRupiah = (value: number) => {
  const amount = Number.isFinite(value) ? Math.max(0, value) : 0;
  const format = (number: number) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(number);

  if (amount >= 1_000_000_000) return `Rp ${format(amount / 1_000_000_000)} M`;
  if (amount >= 1_000_000) return `Rp ${format(amount / 1_000_000)} Jt`;
  if (amount >= 1_000) return `Rp ${format(amount / 1_000)} Rb`;
  return formatRupiah(amount);
};

const visiblePageNumbers = (page: number, totalPages: number) => {
  const count = Math.min(5, Math.max(1, totalPages));
  const first = Math.min(
    Math.max(1, page - 2),
    Math.max(1, totalPages - count + 1),
  );
  return Array.from({ length: count }, (_, index) => first + index);
};

function Kpi({
  title,
  value,
  note,
  Icon,
  className,
  iconClassName,
}: {
  title: string;
  value: string | number;
  note?: string;
  Icon: LucideIcon;
  className: string;
  iconClassName: string;
}) {
  return (
    <Card className={`min-w-0 overflow-hidden border p-2.5 ${className}`}>
      <div className="flex items-start gap-2">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          <div className="mt-1 flex min-w-0 items-baseline gap-2">
            <p className="whitespace-nowrap text-lg font-bold leading-tight text-foreground tabular-nums">
              {value}
            </p>
            {note && (
              <p className="min-w-0 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                {note}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function FilterLabel({ children }: { children: string }) {
  return (
    <p className="mb-1 block text-xs font-medium text-foreground">{children}</p>
  );
}

export default function DealsPage() {
  const router = useRouter();
  const [tab, setTab] = useState("list");
  const [filters, setFilters] = useState<DealFilters>({ page: 1, limit: 10 });
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const { deals, pagination, summary, isLoading, deleteDeal, isDeleting } =
    useDeals(filters);
  const { data: configuredStages = [] } = usePipelineStages("deal");
  const { data: projects } = useProjects({ page: 1, limit: 100 });
  const { users } = useUsers();
  const { data: banks = [] } = useFinancingBanks(true);
  const [hiddenStageIds, setHiddenStageIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HIDDEN_STAGES_KEY);
      if (saved) setHiddenStageIds(JSON.parse(saved) as string[]);
    } catch {
      // abaikan data tersimpan yang rusak
    }
  }, []);
  const updateHiddenStages = (next: string[]) => {
    setHiddenStageIds(next);
    window.localStorage.setItem(HIDDEN_STAGES_KEY, JSON.stringify(next));
  };
  const stages = useMemo(
    () => configuredStages.filter((stage) => stage.isActive),
    [configuredStages],
  );
  const updateFilters = (patch: Partial<DealFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  const dealPeriod: DateRange | undefined = filters.startDate
    ? {
        from: new Date(`${filters.startDate}T00:00:00`),
        to: filters.endDate
          ? new Date(`${filters.endDate}T00:00:00`)
          : undefined,
      }
    : undefined;
  const periodLabel = dealPeriod?.from
    ? dealPeriod.to
      ? `${dateLabel(dealPeriod.from)} – ${dateLabel(dealPeriod.to)}`
      : dateLabel(dealPeriod.from)
    : "Pilih rentang tanggal";
  const currentPage = pagination?.page ?? 1;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const totalDeals = pagination?.total ?? 0;
  const pageStart =
    totalDeals === 0 ? 0 : (currentPage - 1) * (pagination?.limit ?? 10) + 1;
  const pageEnd =
    deals.length === 0 ? 0 : Math.min(totalDeals, pageStart + deals.length - 1);

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0 min-w-0">
        <header className="flex h-16 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <span className="flex size-7 items-center justify-center rounded-md border border-[#B2DDFF] bg-[#EFF8FF] text-[#1570EF]">
            <FileText className="size-4" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">Deals</h1>
          <Button
            type="button"
            disabled
            title="Form Add Deal belum tersedia (dikerjakan di CRM-71)."
            className="ml-auto"
          >
            <Plus className="size-4" />
            Add Deal
          </Button>
        </header>
        <main className="space-y-3 p-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          <Tabs value={tab} onValueChange={setTab} className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            <TabsList className="h-10 w-fit gap-0.5 overflow-hidden rounded-2xl border border-[#E4E7EC] bg-[#F7F8FA] p-1 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
              <TabsTrigger
                value="list"
                className="h-8 gap-2 rounded-xl px-4 text-sm font-medium text-[#667085] transition-colors hover:text-[#344054] data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-[#0B63F6] data-[state=active]:shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
              >
                <List className="size-4" />
                List Deals
              </TabsTrigger>
              <TabsTrigger
                value="pipeline"
                className="h-8 gap-2 rounded-xl px-4 text-sm font-medium text-[#667085] transition-colors hover:text-[#344054] data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-[#0B63F6] data-[state=active]:shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
              >
                <Columns3 className="size-4" />
                Pipeline
              </TabsTrigger>
            </TabsList>
            <section className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
              <h2 className="text-base font-semibold">
                {tab === "list" ? "Deals Management" : "Deals Pipeline"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {tab === "list"
                  ? "Kelola dan pantau progres transaksi dari Lead yang telah dikonversi."
                  : "Pantau progres penjualan (deals) berdasarkan fase transaksi."}
              </p>
              </div>
              <Button
                type="button"
                className="bg-[#1980C0] text-white hover:bg-[#166ea6]"
                onClick={() => setIsAddOpen(true)}
              >
                <Plus className="size-4" />
                Tambah Deal
              </Button>
            </section>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi
                title="Total Deals"
                value={summary?.totalDeals ?? 0}
                Icon={FileText}
                className="border-blue-100 bg-blue-50/80"
                iconClassName="bg-blue-100 text-blue-600"
              />
              <Kpi
                title="Open Deals"
                value={summary?.openDeals ?? 0}
                Icon={Target}
                className="border-emerald-100 bg-emerald-50/80"
                iconClassName="bg-emerald-100 text-emerald-600"
              />
              <Kpi
                title="Estimated Value"
                value={formatCompactRupiah(summary?.estimatedValue ?? 0)}
                Icon={CircleDollarSign}
                className="border-violet-100 bg-violet-50/80"
                iconClassName="bg-violet-100 text-violet-600"
              />
              <Kpi
                title="Won Deals"
                value={summary?.wonDeals ?? 0}
                note={formatCompactRupiah(summary?.wonValue ?? 0)}
                Icon={Trophy}
                className="border-green-100 bg-green-50/80"
                iconClassName="bg-green-100 text-green-600"
              />
              <Kpi
                title="Lost Deals"
                value={summary?.lostDeals ?? 0}
                note={formatCompactRupiah(summary?.lostValue ?? 0)}
                Icon={X}
                className="border-rose-100 bg-rose-50/80"
                iconClassName="bg-rose-100 text-rose-600"
              />
            </div>
            <div
              className={`grid items-start gap-2 rounded-xl border p-2 sm:grid-cols-2 ${
                tab === "list"
                  ? "xl:grid-cols-[minmax(190px,1.8fr)_minmax(190px,1.5fr)_repeat(5,minmax(110px,1fr))]"
                  : "xl:grid-cols-[minmax(190px,1.8fr)_minmax(190px,1.5fr)_repeat(4,minmax(110px,1fr))_auto]"
              } xl:[&_[data-slot=select-trigger]]:h-8 xl:[&_[data-slot=select-trigger]]:text-xs xl:[&_[data-slot=input]]:h-8 xl:[&_[data-slot=input]]:text-xs`}
            >
              <div className="relative pt-[21px]">
                <Search className="absolute left-3 top-[31px] size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter")
                      updateFilters({ search: search.trim() || undefined });
                  }}
                  placeholder="Cari nama customer atau nomor HP…"
                />
              </div>
              <div>
                <FilterLabel>Periode Deal</FilterLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal"
                    >
                      <CalendarDays className="mr-2 size-4 text-muted-foreground" />
                      {periodLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      selected={dealPeriod}
                      onSelect={(range) =>
                        updateFilters({
                          startDate: range?.from
                            ? dateValue(range.from)
                            : undefined,
                          endDate: range?.to ? dateValue(range.to) : undefined,
                        })
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <FilterLabel>Project</FilterLabel>
                <Select
                  value={filters.projectId ?? "all"}
                  onValueChange={(value) =>
                    updateFilters({
                      projectId: value === "all" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Project</SelectItem>
                    {projects?.data.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {tab === "list" && (
                <div>
                  <FilterLabel>Fase Deal</FilterLabel>
                  <Select
                    value={filters.stageId ?? "all"}
                    onValueChange={(value) =>
                      updateFilters({
                        stageId: value === "all" ? undefined : value,
                      })
                    }
                  >
                    <SelectTrigger aria-label="Fase Deal dari konfigurasi pipeline">
                      <SelectValue placeholder="Semua Fase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Fase</SelectItem>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <FilterLabel>Jenis Pembayaran</FilterLabel>
                <Select
                  value={filters.paymentMethod ?? "all"}
                  onValueChange={(value) =>
                    updateFilters({
                      paymentMethod:
                        value === "all"
                          ? undefined
                          : (value as DealPaymentMethod),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Jenis</SelectItem>
                    <SelectItem value="CASH">Tunai</SelectItem>
                    <SelectItem value="KPR">KPR</SelectItem>
                    <SelectItem value="KPR_SHARIA">KPR Syariah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FilterLabel>Bank</FilterLabel>
                <Select
                  value={filters.bankName ?? "all"}
                  onValueChange={(value) =>
                    updateFilters({
                      bankName: value === "all" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Bank" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Bank</SelectItem>
                    {banks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.name}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FilterLabel>Assigned Sales</FilterLabel>
                <Select
                  value={filters.assignedUserId ?? "all"}
                  onValueChange={(value) =>
                    updateFilters({
                      assignedUserId: value === "all" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Sales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Sales</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {tab === "pipeline" && (
                <div className="pt-[21px]">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        title="Pilih kolom fase yang ditampilkan"
                        className="h-8 text-xs"
                      >
                        <SlidersHorizontal className="size-4" />
                        Columns
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 space-y-1 p-2">
                      <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                        Kolom fase yang ditampilkan
                      </p>
                      {stages.map((stage) => {
                        const visible = !hiddenStageIds.includes(stage.id);
                        const onlyVisible =
                          visible && stages.length - hiddenStageIds.length <= 1;
                        return (
                          <label
                            key={stage.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              checked={visible}
                              disabled={onlyVisible}
                              onCheckedChange={(checked) =>
                                updateHiddenStages(
                                  checked
                                    ? hiddenStageIds.filter((id) => id !== stage.id)
                                    : [...hiddenStageIds, stage.id],
                                )
                              }
                            />
                            {stage.name}
                          </label>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
            <TabsContent value="list" className="mt-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              <Card className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                <div className="overflow-auto lg:min-h-0 lg:flex-1">
                  <table className="w-full min-w-[1160px] table-fixed text-xs">
                    <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <tr>
                        {[
                          "No.",
                          "Lead/Customer",
                          "Project",
                          "Unit",
                          "Harga Deals",
                          "Pembayaran",
                          "Bank",
                          "Fase Deal",
                          "Assigned Sales",
                          "Last Activity",
                          "Hari",
                          "Actions",
                        ].map((title) => (
                          <th
                            key={title}
                            className={`whitespace-nowrap px-1.5 py-1.5 text-[10px] font-medium ${dealColumnWidths[title]}`}
                          >
                            {title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={12} className="p-10 text-center">
                            Memuat Deals…
                          </td>
                        </tr>
                      ) : !deals.length ? (
                        <tr>
                          <td
                            colSpan={12}
                            className="p-10 text-center text-muted-foreground"
                          >
                            Tidak ada Deal yang cocok.
                          </td>
                        </tr>
                      ) : (
                        deals.map((deal, index) => {
                          const customer = deal.lead?.customer;
                          const days = daysSince(deal.lastActivityAt);
                          return (
                            <tr
                              key={deal.id}
                              className="border-b last:border-0 hover:bg-muted/30"
                            >
                              <td className="px-1.5 py-1.5 text-[11px]">
                                {((pagination?.page ?? 1) - 1) *
                                  (pagination?.limit ?? 10) +
                                  index +
                                  1}
                              </td>
                              <td className="px-1.5 py-1.5 align-top text-[11px]">
                                <p className="truncate font-medium">
                                  {customer
                                    ? `${customer.firstName} ${customer.lastName ?? ""}`.trim()
                                    : "-"}
                                </p>
                                <p className="whitespace-nowrap text-[10px] text-muted-foreground">
                                  {customer?.phoneNumber || "-"}
                                </p>
                              </td>
                              <td className="px-1.5 py-1.5 text-[11px]">
                                <Badge variant="secondary" className="max-w-full truncate px-1.5 py-0.5 text-[10px]" title={deal.unit?.variant.product.name}>
                                  {deal.unit?.variant.product.name ?? "-"}
                                </Badge>
                              </td>
                              <td className="whitespace-nowrap px-1.5 py-1.5 align-top text-[11px]">
                                {deal.unit?.code ?? "-"}
                              </td>
                              <td className="whitespace-nowrap px-1.5 py-1.5 text-[11px] font-medium">
                                {formatRupiah(
                                  deal.amount ?? deal.expectedAmount ?? 0,
                                )}
                              </td>
                              <td className="px-1.5 py-1.5">
                                <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px]">
                                  {paymentLabels[deal.paymentMethod]}
                                </Badge>
                              </td>
                              <td className="truncate px-1.5 py-1.5 text-[11px]">
                                {deal.paymentMethod === "CASH"
                                  ? "-"
                                  : deal.bankName || "-"}
                              </td>
                              <td className="px-1.5 py-1.5">
                                <Badge className="max-w-full truncate rounded-lg px-1 py-0.5 text-[10px]" title={deal.stage?.name}>
                                  {deal.stage?.name || "Belum ditentukan"}
                                </Badge>
                              </td>
                              <td className="truncate px-1.5 py-1.5 align-top text-[11px]" title={deal.assignedUser?.name || deal.assignedUser?.email}>
                                {deal.assignedUser?.name ||
                                  deal.assignedUser?.email ||
                                  "-"}
                              </td>
                              <td className="whitespace-nowrap px-1.5 py-1.5 text-[11px]">
                                {deal.lastActivityAt
                                  ? new Date(
                                      deal.lastActivityAt,
                                    ).toLocaleDateString("id-ID")
                                  : "-"}
                              </td>
                              <td className="whitespace-nowrap px-1.5 py-1.5 align-top text-[11px]">
                                {days === null ? "-" : `${days} hari`}
                              </td>
                              <td className="px-1 py-1.5">
                                <div className="flex gap-0.5">
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label="Lihat detail Deal"
                                    onClick={() =>
                                      router.push(`/deals/${deal.id}`)
                                    }
                                  >
                                    <Eye />
                                  </Button>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label="Edit Deal"
                                    onClick={() =>
                                      router.push(`/deals/${deal.id}?edit=1`)
                                    }
                                  >
                                    <Pencil />
                                  </Button>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    className="text-destructive"
                                    aria-label="Hapus permanen Deal"
                                    onClick={() => {
                                      setRemoveId(deal.id);
                                      setConfirmation("");
                                    }}
                                  >
                                    <Trash2 />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <footer className="flex flex-col gap-3 border-t p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Menampilkan {pageStart}–{pageEnd} dari {totalDeals} Deals
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap text-muted-foreground">
                        Rows per page
                      </span>
                      <Select
                        value={String(pagination?.limit ?? filters.limit ?? 10)}
                        onValueChange={(value) =>
                          updateFilters({ limit: Number(value), page: 1 })
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-16"
                          aria-label="Jumlah baris per halaman"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[10, 20, 50].map((limit) => (
                            <SelectItem key={limit} value={String(limit)}>
                              {limit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        aria-label="Halaman sebelumnya"
                        disabled={currentPage <= 1}
                        onClick={() => updateFilters({ page: currentPage - 1 })}
                      >
                        <ChevronLeft className="size-3.5" />
                      </Button>
                      {visiblePageNumbers(currentPage, totalPages).map(
                        (page) => (
                          <Button
                            key={page}
                            type="button"
                            size="icon-sm"
                            variant={
                              page === currentPage ? "default" : "outline"
                            }
                            aria-label={`Halaman ${page}`}
                            aria-current={
                              page === currentPage ? "page" : undefined
                            }
                            onClick={() => updateFilters({ page })}
                          >
                            {page}
                          </Button>
                        ),
                      )}
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        aria-label="Halaman berikutnya"
                        disabled={currentPage >= totalPages}
                        onClick={() => updateFilters({ page: currentPage + 1 })}
                      >
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </footer>
              </Card>
            </TabsContent>
            <TabsContent value="pipeline" className="mt-3 lg:min-h-0 lg:flex-1">
              <DealsPipelineTab
                filters={{
                  ...filters,
                  stageId: undefined,
                  page: undefined,
                  limit: undefined,
                }}
                hiddenStageIds={hiddenStageIds}
              />
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
      {isAddOpen && (
        <AddDealDialog
          onClose={() => setIsAddOpen(false)}
          onCreated={(deal) => router.push(`/deals/${deal.id}`)}
        />
      )}
      <ConfirmModal
        isOpen={!!removeId}
        onClose={() => setRemoveId(null)}
        onConfirm={async () => {
          if (removeId) {
            await deleteDeal(removeId);
            setRemoveId(null);
          }
        }}
        loading={isDeleting}
        title="Hapus Deal secara permanen?"
        description="Tindakan ini tidak dapat dibatalkan. Ketik HAPUS untuk mengonfirmasi."
        confirmLabel="Hapus permanen"
        confirmDisabled={confirmation !== "HAPUS"}
      >
        <Input
          aria-label="Konfirmasi hapus permanen"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="Ketik HAPUS"
        />
      </ConfirmModal>
    </SidebarProvider>
  );
}
