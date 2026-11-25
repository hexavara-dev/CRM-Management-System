"use client";

import { AddDealDialog } from "@/app/deals/components/add-deal-dialog";
import { DealsPipelineTab } from "@/app/deals/components/deals-pipeline-tab";
import { AppSidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
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
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

const paymentLabels: Record<DealPaymentMethod, string> = {
  CASH: "Tunai",
  KPR: "KPR",
  KPR_SHARIA: "KPR Syariah",
};

const dealColumnWidths: Record<string, string> = {
  "No.": "w-12",
  "Lead/Customer": "w-52",
  Project: "w-44",
  Unit: "w-28",
  "Harga Deals": "w-44",
  Pembayaran: "w-36",
  Bank: "w-32",
  "Fase Deal": "w-52",
  "Assigned Sales": "w-48",
  "Last Activity": "w-32",
  Hari: "w-20",
  Actions: "w-28",
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
    <Card className={`min-w-0 overflow-hidden border p-3 ${className}`}>
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          <div className="mt-1 flex min-w-0 items-baseline gap-2">
            <p className="whitespace-nowrap text-xl font-bold leading-tight text-foreground tabular-nums">
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex h-16 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <h1 className="text-lg font-semibold">Deals</h1>
        </header>
        <main className="space-y-4 p-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="!h-[52px] gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-2 py-1.5 shadow-sm">
              <TabsTrigger
                value="list"
                className="!h-10 gap-2 rounded-lg px-5 text-sm font-medium text-slate-600 transition-all hover:bg-white hover:text-slate-900 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <List className="size-4" />
                List Deals
              </TabsTrigger>
              <TabsTrigger
                value="pipeline"
                className="!h-10 gap-2 rounded-lg px-5 text-sm font-medium text-slate-600 transition-all hover:bg-white hover:text-slate-900 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Columns3 className="size-4" />
                Pipeline
              </TabsTrigger>
            </TabsList>
            <section className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
              <h2 className="text-lg font-semibold">
                {tab === "list" ? "Deals Management" : "Deals Pipeline"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Kelola dan pantau progres transaksi dari Lead yang telah
                dikonversi.
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
            <div className="grid items-start gap-3 rounded-xl border p-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.8fr)_minmax(220px,1.5fr)_repeat(4,minmax(140px,1fr))]">
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
            </div>
            <TabsContent value="list" className="mt-4">
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1420px] table-fixed text-sm">
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
                            className={`whitespace-nowrap px-3 py-3 font-medium ${dealColumnWidths[title]}`}
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
                              <td className="px-3 py-3">
                                {((pagination?.page ?? 1) - 1) *
                                  (pagination?.limit ?? 10) +
                                  index +
                                  1}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <p className="font-medium">
                                  {customer
                                    ? `${customer.firstName} ${customer.lastName ?? ""}`.trim()
                                    : "-"}
                                </p>
                                <p className="whitespace-nowrap text-xs text-muted-foreground">
                                  {customer?.phoneNumber || "-"}
                                </p>
                              </td>
                              <td className="px-3 py-3">
                                <Badge variant="secondary">
                                  {deal.unit?.variant.product.name ?? "-"}
                                </Badge>
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 align-top">
                                {deal.unit?.code ?? "-"}
                              </td>
                              <td className="px-3 py-3 font-medium">
                                {formatRupiah(
                                  deal.amount ?? deal.expectedAmount ?? 0,
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <Badge variant="secondary">
                                  {paymentLabels[deal.paymentMethod]}
                                </Badge>
                              </td>
                              <td className="px-3 py-3">
                                {deal.paymentMethod === "CASH"
                                  ? "-"
                                  : deal.bankName || "-"}
                              </td>
                              <td className="px-3 py-3">
                                <Badge>
                                  {deal.stage?.name || "Belum ditentukan"}
                                </Badge>
                              </td>
                              <td className="px-3 py-3 align-top">
                                {deal.assignedUser?.name ||
                                  deal.assignedUser?.email ||
                                  "-"}
                              </td>
                              <td className="px-3 py-3">
                                {deal.lastActivityAt
                                  ? new Date(
                                      deal.lastActivityAt,
                                    ).toLocaleDateString("id-ID")
                                  : "-"}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 align-top">
                                {days === null ? "-" : `${days} hari`}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex gap-1">
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
            <TabsContent value="pipeline" className="mt-4">
              <DealsPipelineTab
                filters={{ ...filters, page: undefined, limit: undefined }}
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
