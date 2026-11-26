"use client";

import { AppSidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStatistics } from "@/hooks/use-statistics";
import { formatRupiah } from "@/lib/helper";
import {
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Home,
  Layers3,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

const number = new Intl.NumberFormat("id-ID");
const date = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

function SummaryCard({
  title,
  value,
  change,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  change?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  const isUp = change == null || change >= 0;
  const percentage = Math.abs(change ?? 0);
  const trendMessage =
    change == null
      ? "Belum ada pembanding dari bulan lalu."
      : `${percentage}% ${isUp ? "lebih tinggi" : "lebih rendah"} dari bulan lalu.`;
  return (
    <Card className="h-[72px] min-w-0 border-[#E3E8F0] shadow-[0_1px_3px_rgba(15,23,42,.08)]">
      <CardContent className="flex h-full items-center gap-2.5 px-3 py-1">
        <span className={`rounded-lg p-2.5 ${tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p title={title} className="truncate text-[13px] text-slate-500">
            {title}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-[21px] font-semibold leading-7 text-slate-900">
              {number.format(value)}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className={`inline-flex cursor-help items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                >
                  {isUp ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {percentage}%
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {trendMessage}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SalesChart({
  data,
  metric,
}: {
  data: { month: string; count: number; value: number }[];
  metric: "revenue" | "sold";
}) {
  const points = data.slice(-12);
  if (!points.length)
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-400">
        Belum ada data penjualan.
      </div>
    );
  const categories = points.map((item) =>
    new Intl.DateTimeFormat("id-ID", { month: "short" }).format(
      new Date(`${item.month}-01`),
    ),
  );
  const isRevenue = metric === "revenue";
  const seriesData = points.map((item) =>
    isRevenue ? item.value : item.count,
  );
  const seriesName = isRevenue ? "Sales Revenue" : "Total Sold";
  const options: ApexOptions = {
    chart: {
      type: "bar",
      height: 270,
      toolbar: { show: false },
      fontFamily: "inherit",
      animations: { enabled: true },
    },
    colors: ["#3B82C4"],
    dataLabels: { enabled: false },
    plotOptions: {
      bar: {
        columnWidth: "14%",
        borderRadius: 2,
      },
    },
    grid: {
      borderColor: "#DCE5EF",
      strokeDashArray: 0,
      padding: { left: 0, right: 0, top: 16, bottom: 0 },
    },
    xaxis: {
      categories,
      axisBorder: { color: "#DCE5EF" },
      axisTicks: { show: false },
      labels: { style: { colors: "#64748B", fontSize: "10px" } },
    },
    yaxis: {
      min: 0,
      tickAmount: 5,
      title: {
        text: isRevenue ? "Revenue (Rp miliar)" : "Unit terjual",
        style: { color: "#64748B", fontSize: "11px", fontWeight: 400 },
      },
      labels: {
        formatter: (value) =>
          isRevenue
            ? `${(value / 1_000_000_000).toFixed(0)} M`
            : number.format(Math.round(value)),
        style: { colors: "#64748B", fontSize: "10px" },
      },
    },
    legend: { show: false },
    tooltip: {
      shared: false,
      y: {
        formatter: (value) =>
          isRevenue
            ? formatRupiah(Number(value))
            : `${number.format(Number(value))} unit`,
      },
    },
  };
  return (
    <div>
      <ApexChart
        type="bar"
        height={270}
        options={options}
        series={[{ name: seriesName, data: seriesData }]}
      />
      <div className="flex items-center gap-2 pl-1 text-xs text-slate-500">
        <i className="h-2.5 w-2.5 rounded-sm bg-[#3B82C4]" />
        {seriesName}
      </div>
    </div>
  );
}

function Pipeline({
  title,
  items,
}: {
  title: string;
  items: { id: string; name: string; color: string | null; count: number }[];
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const fallbackColors = ["#214F8D", "#3980BA", "#77B1E2", "#A9D4F1", "#CBDCE8", "#D7E1E8"];
  return (
    <Card className="min-w-0 border-[#E3E8F0] shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[17px]">{title}</CardTitle>
        <span className="text-sm text-slate-500">
          <b className="text-slate-700">{number.format(total)}</b>{" "}
          {title.startsWith("Leads") ? "Leads" : "Deals"}
        </span>
      </CardHeader>
      <CardContent className="flex gap-4 pt-1">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">
            Belum ada tahapan yang dikonfigurasi.
          </p>
        ) : (
          <>
            <div className="flex w-[44%] shrink-0 flex-col items-center justify-center gap-1.5 pt-1">
              {items.map((item, index) => {
                // Bentuk funnel mengikuti urutan tahap, bukan jumlah data pada tahap.
                // Dengan begitu visual pipeline tetap mengalir dari besar ke kecil
                // walaupun count antar-tahap berubah atau ada tahap bernilai nol.
                const width =
                  items.length > 1
                    ? 100 - (index / (items.length - 1)) * 58
                    : 100;
                const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div
                    key={item.id}
                    className="h-5 rounded-[5px]"
                    title={`${item.name}: ${number.format(item.count)} (${percent}%)`}
                    style={{
                      width: `${width}%`,
                      opacity: item.count === 0 ? 0.35 : 1,
                      backgroundColor: item.color || fallbackColors[index % fallbackColors.length],
                    }}
                  />
                );
              })}
            </div>
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="flex min-w-0 items-center gap-2 truncate text-slate-600">
                    <i
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color || "#4385C5" }}
                    />
                    {item.name}
                  </span>
                  <b className="text-slate-700">{number.format(item.count)}</b>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Availability({
  values,
}: {
  values: NonNullable<
    ReturnType<typeof useStatistics>["statistics"]
  >["availability"];
}) {
  const items = [
    { label: "Available", value: values.available, color: "#3B82F6" },
    {
      label: "Reservation / Processing",
      value: values.processing,
      color: "#F6C344",
    },
    { label: "Reserved", value: values.reserved, color: "#4FA8A0" },
    { label: "Sold", value: values.sold, color: "#1E477E" },
    { label: "Blocked", value: values.blocked, color: "#EF5360" },
    { label: "Not yet created", value: values.notYetCreated, color: "#CBD5E1" },
  ];
  const options: ApexOptions = {
    chart: { type: "donut", height: 220, fontFamily: "inherit", animations: { enabled: true } },
    labels: items.map((item) => item.label),
    colors: items.map((item) => item.color),
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { width: 2, colors: ["#fff"] },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: { show: true, fontSize: "12px", color: "#64748B", offsetY: 18 },
            value: {
              show: true,
              fontSize: "24px",
              fontWeight: 700,
              color: "#1E293B",
              offsetY: -14,
              formatter: (value) => number.format(Number(value)),
            },
            total: {
              show: true,
              showAlways: true,
              label: "Units",
              fontSize: "12px",
              color: "#94A3B8",
              formatter: () => number.format(values.total),
            },
          },
        },
      },
    },
    // Hover menampilkan nama status, jumlah unit, dan persentasenya dari total.
    tooltip: {
      y: {
        formatter: (value) =>
          `${number.format(Number(value))} unit (${values.total > 0 ? Math.round((Number(value) / values.total) * 100) : 0}%)`,
      },
    },
  };
  return (
    <Card className="border-[#E3E8F0] shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Availability</CardTitle>
        <p className="text-sm text-slate-500">Unit availability</p>
      </CardHeader>
      <CardContent>
        {values.total > 0 ? (
          <div className="mx-auto mb-3 w-full max-w-[240px]">
            <ApexChart
              type="donut"
              height={220}
              options={options}
              series={items.map((item) => item.value)}
            />
          </div>
        ) : (
          <p className="mb-5 py-10 text-center text-sm text-slate-400">
            Belum ada unit.
          </p>
        )}
        <div className="space-y-2 text-xs">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600">
                <i
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
              <b className="text-slate-700">{number.format(item.value)}</b>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [chartMetric, setChartMetric] = useState<"revenue" | "sold">("revenue");
  const { statistics, isLoading } = useStatistics(year);
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <PageHeader title="Dashboard" />
        {isLoading || !statistics ? (
          <div className="flex flex-1 items-center justify-center p-6 text-slate-400">
            Memuat dashboard...
          </div>
        ) : (
          <main className="min-w-0 bg-[#FBFCFE] p-4 md:p-6">
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-5">
                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <SummaryCard
                    title="Total Project Active"
                    value={statistics.totalProjectActive}
                    change={statistics.summaryChanges.projects}
                    icon={Building2}
                    tone="bg-blue-100 text-blue-600"
                  />
                  <SummaryCard
                    title="Total Type"
                    value={statistics.totalTypes}
                    change={statistics.summaryChanges.types}
                    icon={Layers3}
                    tone="bg-cyan-100 text-cyan-600"
                  />
                  <SummaryCard
                    title="Total Unit"
                    value={statistics.totalUnits}
                    change={statistics.summaryChanges.units}
                    icon={Home}
                    tone="bg-indigo-100 text-indigo-600"
                  />
                  <SummaryCard
                    title="Ongoing Deals"
                    value={statistics.ongoingDeals}
                    change={statistics.summaryChanges.ongoingDeals}
                    icon={Target}
                    tone="bg-amber-100 text-amber-600"
                  />
                  <SummaryCard
                    title="Won Deals"
                    value={statistics.wonDeals}
                    change={statistics.summaryChanges.wonDeals}
                    icon={Trophy}
                    tone="bg-emerald-100 text-emerald-600"
                  />
                  <SummaryCard
                    title="Lost Deals"
                    value={statistics.lostDeals}
                    change={statistics.summaryChanges.lostDeals}
                    icon={XCircle}
                    tone="bg-rose-100 text-rose-600"
                  />
                </div>
                <Card className="border-[#E3E8F0] shadow-none">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-lg">Sales Trend</CardTitle>
                      <p className="text-sm text-slate-500">
                        Monitor sales progress in real time
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-md border bg-white p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setChartMetric("revenue")}
                          className={`rounded px-2.5 py-1.5 ${chartMetric === "revenue" ? "bg-blue-600 text-white" : "text-slate-500"}`}
                        >
                          Revenue
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartMetric("sold")}
                          className={`rounded px-2.5 py-1.5 ${chartMetric === "sold" ? "bg-blue-600 text-white" : "text-slate-500"}`}
                        >
                          Unit
                        </button>
                      </div>
                      <select
                        value={year}
                        onChange={(event) =>
                          setYear(Number(event.target.value))
                        }
                        className="rounded-md border bg-white px-3 py-2 text-sm text-slate-600 outline-none"
                      >
                        {[currentYear, currentYear - 1, currentYear - 2].map(
                          (option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex gap-8">
                      <div>
                        <p className="text-sm text-slate-500">Total Revenue</p>
                        <b className="text-xl">
                          {formatRupiah(
                            statistics.salesTrend.reduce(
                              (sum, item) => sum + item.value,
                              0,
                            ),
                          )}
                        </b>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Total Sold</p>
                        <b className="text-xl">
                          {number.format(
                            statistics.salesTrend.reduce(
                              (sum, item) => sum + item.count,
                              0,
                            ),
                          )}
                        </b>
                      </div>
                    </div>
                    <SalesChart
                      data={statistics.salesTrend}
                      metric={chartMetric}
                    />
                  </CardContent>
                </Card>
                <div className="grid min-w-0 gap-5 md:grid-cols-2">
                  <Pipeline
                    title="Leads Pipeline"
                    items={statistics.leadPipeline}
                  />
                  <Pipeline
                    title="Deals Pipeline"
                    items={statistics.dealPipeline}
                  />
                </div>
              </div>
              <div className="min-w-0 space-y-5">
                <Card className="border-[#E3E8F0] shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div>
                      <CardTitle className="text-lg">Upcoming Visit</CardTitle>
                      <p className="text-sm text-slate-500">
                        Upcoming visit schedule
                      </p>
                    </div>
                    <Link
                      href="/viewings"
                      className="flex items-center gap-1 text-sm text-blue-600"
                    >
                      View All <ArrowRight className="h-4 w-4" />
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {statistics.upcomingVisits.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        Tidak ada jadwal visit mendatang.
                      </p>
                    ) : (
                      statistics.upcomingVisits.map((visit) => (
                        <div
                          key={visit.id}
                          className="flex items-center gap-3 border-b pb-3 last:border-0 last:pb-0"
                        >
                          <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                            <CalendarDays className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block truncate text-sm text-slate-800">
                              {date.format(new Date(visit.scheduledAt))}
                            </b>
                            <span className="block truncate text-xs text-slate-500">
                              {visit.name ||
                                `${visit.lead?.customer?.firstName || "Customer"} ${visit.lead?.customer?.lastName || ""}`} {" "}
                              {visit.location ? `• ${visit.location.name}` : ""}
                            </span>
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
                <Availability values={statistics.availability} />
              </div>
            </div>
          </main>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
