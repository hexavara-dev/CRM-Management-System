"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const GROUP_MODES = ["Clauster", "Blok", "Type"] as const;
const UNIT_TYPES = ["Tipe A", "Tipe B", "Tipe C", "Tipe D", "Tipe E", "Tipe F"];
const PAGE_SIZE = 8;

type Cluster = { name: string; tipe: number; blok: number; sold: number; reserved: number; available: number };

const CLUSTERS: Cluster[] = [
  { name: "Clauster Anggrek", tipe: 4, blok: 12, sold: 50, reserved: 24, available: 30 },
  { name: "Royal Mutiara", tipe: 2, blok: 6, sold: 50, reserved: 24, available: 20 },
  { name: "Bougenville", tipe: 3, blok: 8, sold: 40, reserved: 18, available: 25 },
];

const STATUS = ["Sold", "Reserved", "Available"] as const;
type UnitStatus = (typeof STATUS)[number];

const STATUS_STYLE: Record<UnitStatus, string> = {
  Sold: "border-[#1E9E55] text-[#1E9E55] bg-[#E6F6EC]",
  Reserved: "border-[#1980C0] text-[#1980C0] bg-[#E5F1FA]",
  Available: "border-[#D9822B] text-[#D9822B] bg-[#FFF1E0]",
};

const METRIC_STYLE = {
  sold: "bg-[#E6F6EC] text-[#1E9E55]",
  reserved: "bg-[#E5F1FA] text-[#1980C0]",
  available: "bg-[#FFF1E0] text-[#D9822B]",
};

function unitsFor(cluster: Cluster, type: string) {
  const total = 40;
  return Array.from({ length: total }, (_, i) => ({
    id: i,
    blok: `A${Math.floor(i / 10) + 1}`,
    no: `${182 + i}`,
    type,
    status: STATUS[i % 3],
    customer: i % 3 === 0 ? "Budi Santoso" : "-",
    cluster: cluster.name,
  }));
}

export function UnitDistribution() {
  const [mode, setMode] = useState<(typeof GROUP_MODES)[number]>("Clauster");
  const [clusterIdx, setClusterIdx] = useState(0);
  const [page, setPage] = useState(1);
  const cluster = CLUSTERS[clusterIdx];
  const [typeTab, setTypeTab] = useState(UNIT_TYPES[0]);

  const rows = unitsFor(cluster, typeTab);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const current = Math.min(page, totalPages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const available = cluster.available;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <div className="rounded-xl border border-[#E4E4E7] bg-[#F6F7F9] p-3">
        <div className="mb-3 flex gap-1 rounded-lg bg-white p-1 shadow-sm">
          {GROUP_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "h-7 flex-1 rounded-md text-xs font-medium text-[#6b6b6b]",
                mode === m && "bg-[#E5F1FA] text-[#1980C0]",
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {CLUSTERS.map((c, i) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                setClusterIdx(i);
                setPage(1);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border bg-white p-2 text-left transition-colors",
                i === clusterIdx ? "border-[#1980C0]" : "border-[#E4E4E7] hover:border-[#1980C0]/50",
              )}
            >
              <div className="h-16 w-24 shrink-0 rounded-lg bg-gradient-to-br from-[#DCE9F2] to-[#F3F7FA]" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs font-semibold text-[#1f1f1f]">{c.name}</p>
                <p className="text-[10px] text-[#6b6b6b]">
                  {c.tipe} Tipe · {c.blok} Blok
                </p>
                <div className="grid grid-cols-3 gap-1">
                  <div className={cn("rounded-md px-1 py-1 text-center", METRIC_STYLE.sold)}>
                    <p className="text-xs font-semibold leading-tight">{c.sold}</p>
                    <p className="text-[9px] opacity-80">Sold</p>
                  </div>
                  <div className={cn("rounded-md px-1 py-1 text-center", METRIC_STYLE.reserved)}>
                    <p className="text-xs font-semibold leading-tight">{c.reserved}</p>
                    <p className="text-[9px] opacity-80">Reserved</p>
                  </div>
                  <div className={cn("rounded-md px-1 py-1 text-center", METRIC_STYLE.available)}>
                    <p className="text-xs font-semibold leading-tight">{c.available}</p>
                    <p className="text-[9px] opacity-80">Available</p>
                  </div>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-[#1f1f1f]" />
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#E4E4E7] bg-white p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1f1f1f]">{cluster.name}</h3>
          <p className="text-[11px] text-[#6b6b6b]">
            Available Unit: <span className="font-semibold text-[#D9822B]">{available}</span>
          </p>
        </div>

        <Tabs value={typeTab} onValueChange={(v) => { setTypeTab(v); setPage(1); }} className="gap-3">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0 px-1 pt-1">
            {UNIT_TYPES.map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="h-7 flex-none rounded-md border border-transparent bg-[#F3F4F6] px-2.5 text-[11px] font-medium text-[#6b6b6b] shadow-none data-[state=active]:border-[#1980C0] data-[state=active]:bg-[#E5F1FA] data-[state=active]:text-[#1980C0] data-[state=active]:shadow-none"
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
          {UNIT_TYPES.map((t) => (
            <TabsContent key={t} value={t}>
              <div className="overflow-x-auto rounded-lg border border-[#E4E4E7]">
                <table className="w-full min-w-[480px] text-left text-[11px]">
                  <thead className="bg-[#F6F7F9] text-[#6b6b6b]">
                    <tr>
                      <th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Select all" className="size-3.5 accent-[#1980C0]" /></th>
                      <th className="px-3 py-2 font-medium">Blok</th>
                      <th className="px-3 py-2 font-medium">No. Unit</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((u) => (
                      <tr key={u.id} className="border-t border-[#EDEDED] text-[#1f1f1f]">
                        <td className="px-3 py-2"><input type="checkbox" aria-label={`Select unit ${u.no}`} className="size-3.5 accent-[#1980C0]" /></td>
                        <td className="px-3 py-2">{u.blok}</td>
                        <td className="px-3 py-2">{u.no}</td>
                        <td className="px-3 py-2">
                          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_STYLE[u.status])}>
                            {u.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">{u.customer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6b6b6b]">
                <p>
                  Showing {(current - 1) * PAGE_SIZE + 1} - {Math.min(current * PAGE_SIZE, rows.length)} of{" "}
                  {rows.length} units.
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={current === 1}
                    onClick={() => setPage(current - 1)}
                    className="grid size-7 place-items-center rounded-md border border-[#E4E4E7] disabled:opacity-40"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={cn(
                        "grid size-7 place-items-center rounded-md border border-[#E4E4E7]",
                        n === current && "border-[#1980C0] bg-[#1980C0] text-white",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={current === totalPages}
                    onClick={() => setPage(current + 1)}
                    className="grid size-7 place-items-center rounded-md border border-[#E4E4E7] disabled:opacity-40"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
