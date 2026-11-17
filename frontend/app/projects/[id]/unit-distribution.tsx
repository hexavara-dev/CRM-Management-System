"use client";

import { AvailabilityState } from "@/components/availability/availability-state";
import type { ClusterUnit } from "@/components/availability/cluster/types";
import type { ClusterAvailability } from "@/components/availability/detail/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useClusterAvailability,
  useProjectAvailability,
} from "@/hooks/use-availability";
import { errorMessage } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  House,
  Layers3,
  LoaderCircle,
} from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 8;

const GROUP_MODES = [
  { value: "cluster", label: "Cluster", icon: Building2 },
  { value: "block", label: "Blok", icon: House },
  { value: "type", label: "Tipe", icon: Layers3 },
] as const;

type GroupMode = (typeof GROUP_MODES)[number]["value"];
type UnitStatus = ClusterUnit["status"];
type UnitCounts = Record<UnitStatus, number>;

const STATUSES: { value: UnitStatus; label: string; className: string }[] = [
  {
    value: "available",
    label: "Tersedia",
    className: "bg-[#FFF1E0] text-[#B5651D]",
  },
  {
    value: "reserved",
    label: "Reservasi",
    className: "bg-[#E5F1FA] text-[#1980C0]",
  },
  {
    value: "processing",
    label: "Proses",
    className: "bg-[#EEF2FF] text-[#4F46E5]",
  },
  {
    value: "sold",
    label: "Terjual",
    className: "bg-[#E6F6EC] text-[#1E9E55]",
  },
  {
    value: "blocked",
    label: "Ditahan",
    className: "bg-[#F3F4F6] text-[#6B7280]",
  },
];

const STATUS_STYLE: Record<UnitStatus, string> = {
  available: "border-[#D9822B] bg-[#FFF1E0] text-[#B5651D]",
  reserved: "border-[#1980C0] bg-[#E5F1FA] text-[#1980C0]",
  processing: "border-[#6366F1] bg-[#EEF2FF] text-[#4F46E5]",
  sold: "border-[#1E9E55] bg-[#E6F6EC] text-[#1E9E55]",
  blocked: "border-[#D0D5DD] bg-[#F3F4F6] text-[#667085]",
};

const EMPTY_COUNTS: UnitCounts = {
  available: 0,
  reserved: 0,
  processing: 0,
  sold: 0,
  blocked: 0,
};

function countUnits(units: readonly ClusterUnit[]): UnitCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const unit of units) counts[unit.status] += 1;
  return counts;
}

function countsForCluster(cluster: ClusterAvailability): UnitCounts {
  return {
    available: cluster.available,
    reserved: cluster.reserved,
    processing: cluster.processing,
    sold: cluster.sold,
    blocked: cluster.blocked,
  };
}

function StatusCounts({ counts }: { counts: UnitCounts }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {STATUSES.map((status) => (
        <div
          key={status.value}
          className={cn("rounded-md px-1 py-1 text-center", status.className)}
          title={status.label}
        >
          <p className="text-xs font-semibold leading-tight">
            {counts[status.value]}
          </p>
          <p className="truncate text-[8px] opacity-80">{status.label}</p>
        </div>
      ))}
    </div>
  );
}

function GroupCard({
  name,
  detail,
  counts,
  selected,
  onClick,
}: {
  name: string;
  detail: string;
  counts: UnitCounts;
  selected: boolean;
  onClick: () => void;
}) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border bg-white p-2 text-left transition-colors",
        selected
          ? "border-[#1980C0]"
          : "border-[#E4E4E7] hover:border-[#1980C0]/50",
      )}
    >
      <div className="grid size-16 w-20 shrink-0 place-items-center rounded-lg bg-[#EFF6FC] text-[#1980C0]">
        <Building2 className="size-6" strokeWidth={1.6} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="truncate text-xs font-semibold text-[#1f1f1f]">{name}</p>
        <p className="text-[10px] text-[#6b6b6b]">
          {total} unit{total === 1 ? "" : "s"} · {detail}
        </p>
        <StatusCounts counts={counts} />
      </div>
      <ChevronRight className="size-4 shrink-0 text-[#667085]" />
    </button>
  );
}

export function UnitDistribution({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState<GroupMode>("cluster");
  const [clusterId, setClusterId] = useState<string>();
  const [blockName, setBlockName] = useState<string>();
  const [typeName, setTypeName] = useState<string>();
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const projectQuery = useProjectAvailability(projectId);
  const clusters = projectQuery.data?.clusters ?? [];
  const activeCluster =
    clusters.find((cluster) => cluster.id === clusterId) ?? clusters[0];
  const clusterQuery = useClusterAvailability(projectId, activeCluster?.id);
  const clusterData = clusterQuery.data;
  const units = clusterData?.units ?? [];

  const blockNames = [
    ...new Set([
      ...(clusterData?.blocks ?? []),
      ...units.map((unit) => unit.block),
    ]),
  ];
  const typeNames = [...new Set(units.map((unit) => unit.type))];
  const activeBlock =
    blockNames.find((name) => name === blockName) ?? blockNames[0];
  const activeType =
    typeNames.find((name) => name === typeName) ?? typeNames[0];
  const selectedTypeFilter =
    typeFilter === "all" || typeNames.includes(typeFilter) ? typeFilter : "all";

  let filteredUnits = units;
  if (mode === "block" && activeBlock) {
    filteredUnits = filteredUnits.filter((unit) => unit.block === activeBlock);
  }
  if (mode === "type" && activeType) {
    filteredUnits = filteredUnits.filter((unit) => unit.type === activeType);
  } else if (selectedTypeFilter !== "all") {
    filteredUnits = filteredUnits.filter(
      (unit) => unit.type === selectedTypeFilter,
    );
  }

  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleUnits = filteredUnits.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const selectedName =
    mode === "cluster"
      ? activeCluster?.name
      : mode === "block"
        ? activeBlock
        : activeType;
  const selectedUnits =
    mode === "cluster"
      ? units
      : mode === "block"
        ? units.filter((unit) => unit.block === activeBlock)
        : units.filter((unit) => unit.type === activeType);
  const selectedCounts =
    mode === "cluster" && activeCluster
      ? countsForCluster(activeCluster)
      : countUnits(selectedUnits);
  const selectedTotal = Object.values(selectedCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  const chooseCluster = (nextClusterId: string) => {
    setClusterId(nextClusterId);
    setBlockName(undefined);
    setTypeName(undefined);
    setTypeFilter("all");
    setPage(1);
  };

  const selectMode = (nextMode: GroupMode) => {
    setMode(nextMode);
    setPage(1);
  };

  if (projectQuery.isLoading) {
    return <AvailabilityState loading message="Memuat distribusi unit..." />;
  }
  if (projectQuery.isError) {
    return (
      <AvailabilityState
        message={errorMessage(
          projectQuery.error,
          "Gagal memuat distribusi unit proyek.",
        )}
      />
    );
  }
  if (!activeCluster) {
    return (
      <AvailabilityState message="Belum ada cluster dan unit availability untuk proyek ini." />
    );
  }

  const groupCards =
    mode === "cluster"
      ? clusters.map((cluster) => ({
          id: cluster.id,
          name: cluster.name,
          detail: `${cluster.blocks} blok`,
          counts: countsForCluster(cluster),
          selected: cluster.id === activeCluster.id,
          onClick: () => chooseCluster(cluster.id),
        }))
      : mode === "block"
        ? blockNames.map((name) => {
            const blockUnits = units.filter((unit) => unit.block === name);
            return {
              id: name,
              name: name === "—" ? "Tanpa blok" : name,
              detail: activeCluster.name,
              counts: countUnits(blockUnits),
              selected: name === activeBlock,
              onClick: () => {
                setBlockName(name);
                setPage(1);
              },
            };
          })
        : typeNames.map((name) => {
            const typeUnits = units.filter((unit) => unit.type === name);
            return {
              id: name,
              name,
              detail: activeCluster.name,
              counts: countUnits(typeUnits),
              selected: name === activeType,
              onClick: () => {
                setTypeName(name);
                setPage(1);
              },
            };
          });

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <section className="rounded-xl border border-[#E4E4E7] bg-[#F6F7F9] p-3">
        <div className="mb-3 flex gap-1 rounded-lg bg-white p-1">
          {GROUP_MODES.map(({ value, label, icon: ModeIcon }) => (
            <button
              key={value}
              type="button"
              onClick={() => selectMode(value)}
              aria-pressed={mode === value}
              className={cn(
                "h-7 flex-1 rounded-md text-xs font-medium text-[#6b6b6b]",
                mode === value && "bg-[#E5F1FA] text-[#1980C0]",
              )}
            >
              <ModeIcon className="mr-1 inline size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {mode !== "cluster" && clusterQuery.isLoading ? (
          <div className="flex min-h-44 flex-col items-center justify-center gap-2 text-xs text-[#667085]">
            <LoaderCircle className="size-5 animate-spin" />
            Memuat data {mode === "block" ? "blok" : "tipe"}...
          </div>
        ) : clusterQuery.isError ? (
          <p className="px-3 py-12 text-center text-xs text-[#D64545]">
            {errorMessage(clusterQuery.error, "Gagal memuat unit cluster.")}
          </p>
        ) : groupCards.length === 0 ? (
          <p className="px-3 py-12 text-center text-xs text-[#667085]">
            {mode === "cluster"
              ? "Belum ada cluster pada proyek ini."
              : mode === "block"
                ? "Belum ada data blok pada cluster ini."
                : "Belum ada tipe unit pada cluster ini."}
          </p>
        ) : (
          <div className="space-y-2">
            {groupCards.map((card) => (
              <GroupCard key={card.id} {...card} />
            ))}
          </div>
        )}
      </section>

      <section className="min-w-0 rounded-xl border border-[#E4E4E7] bg-white p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#1f1f1f]">
              {selectedName ?? activeCluster.name}
            </h3>
            <p className="text-[10px] text-[#667085]">
              {clusterData?.project.name ?? projectQuery.data?.project.name}
            </p>
          </div>
          <p className="text-[11px] text-[#6b6b6b]">
            {selectedTotal} unit · Tersedia: {selectedCounts.available}
          </p>
        </div>

        {mode !== "type" && typeNames.length > 0 && (
          <Tabs
            value={selectedTypeFilter}
            onValueChange={(value) => {
              setTypeFilter(value);
              setPage(1);
            }}
            className="mb-3 gap-3"
          >
            <TabsList className="group-data-horizontal/tabs:h-auto w-full justify-start gap-1 overflow-x-auto overflow-y-hidden bg-transparent p-0 px-1 pb-2 pt-1">
              <TabsTrigger
                value="all"
                className="h-7 flex-none rounded-md border border-transparent bg-[#F3F4F6] px-2.5 text-[11px] font-medium text-[#6b6b6b] shadow-none data-[state=active]:border-[#1980C0] data-[state=active]:bg-[#E5F1FA] data-[state=active]:text-[#1980C0] data-[state=active]:shadow-none"
              >
                Semua Tipe
              </TabsTrigger>
              {typeNames.map((name) => (
                <TabsTrigger
                  key={name}
                  value={name}
                  className="h-7 flex-none rounded-md border border-transparent bg-[#F3F4F6] px-2.5 text-[11px] font-medium text-[#6b6b6b] shadow-none data-[state=active]:border-[#1980C0] data-[state=active]:bg-[#E5F1FA] data-[state=active]:text-[#1980C0] data-[state=active]:shadow-none"
                >
                  {name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {clusterQuery.isLoading ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-2 text-xs text-[#667085]">
            <LoaderCircle className="size-5 animate-spin" />
            Memuat unit cluster...
          </div>
        ) : clusterQuery.isError ? (
          <AvailabilityState
            message={errorMessage(
              clusterQuery.error,
              "Gagal memuat unit cluster.",
            )}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-[#E4E4E7]">
              <table className="w-full min-w-[560px] text-left text-[11px]">
                <thead className="bg-[#F6F7F9] text-[#6b6b6b]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Blok</th>
                    <th className="px-3 py-2 font-medium">No. Unit</th>
                    <th className="px-3 py-2 font-medium">Tipe</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUnits.map((unit) => (
                    <tr
                      key={unit.id}
                      className="border-t border-[#EDEDED] text-[#1f1f1f]"
                    >
                      <td className="px-3 py-2">{unit.block}</td>
                      <td className="px-3 py-2 font-medium">{unit.code}</td>
                      <td className="px-3 py-2">{unit.type}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            STATUS_STYLE[unit.status],
                          )}
                        >
                          {STATUSES.find(
                            (status) => status.value === unit.status,
                          )?.label ?? unit.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">{unit.customer ?? "—"}</td>
                    </tr>
                  ))}
                  {visibleUnits.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="h-28 px-3 text-center text-[#667085]"
                      >
                        Tidak ada unit untuk pilihan ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6b6b6b]">
              <p>
                Menampilkan{" "}
                {filteredUnits.length === 0
                  ? 0
                  : (currentPage - 1) * PAGE_SIZE + 1}
                –{Math.min(currentPage * PAGE_SIZE, filteredUnits.length)} dari{" "}
                {filteredUnits.length} unit.
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Halaman sebelumnya"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="grid size-7 place-items-center rounded-md border border-[#E4E4E7] disabled:opacity-40"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    aria-current={
                      pageNumber === currentPage ? "page" : undefined
                    }
                    onClick={() => setPage(pageNumber)}
                    className={cn(
                      "grid size-7 place-items-center rounded-md border border-[#E4E4E7]",
                      pageNumber === currentPage &&
                        "border-[#1980C0] bg-[#1980C0] text-white",
                    )}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Halaman berikutnya"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  className="grid size-7 place-items-center rounded-md border border-[#E4E4E7] disabled:opacity-40"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
