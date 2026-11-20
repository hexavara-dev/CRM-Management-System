"use client";

import {
  Building2,
  ChevronLeft,
  ChevronRight,
  House,
  Layers3,
  LoaderCircle,
  MapPin,
} from "lucide-react";
import { useState } from "react";

import { AvailabilityState } from "@/components/availability/availability-state";
import { AvailabilityIntegrityWarning } from "@/components/availability/availability-integrity-warning";
import { formatHierarchyLevel } from "@/components/availability/cluster/format";
import type { ClusterUnit } from "@/components/availability/cluster/types";
import type { ClusterAvailability } from "@/components/availability/detail/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useHierarchyNodeAvailability,
  useProjectAvailability,
} from "@/hooks/use-availability";
import { errorMessage } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;
const TYPE_MODE = "TYPE";

type UnitStatus = ClusterUnit["status"];
type UnitCounts = Record<UnitStatus, number>;
type PaginationItem = number | `ellipsis-${string}`;

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
  { value: "sold", label: "Terjual", className: "bg-[#E6F6EC] text-[#1E9E55]" },
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

function countsForGroup(group: ClusterAvailability): UnitCounts {
  return {
    available: group.available,
    reserved: group.reserved,
    processing: group.processing,
    sold: group.sold,
    blocked: group.blocked,
  };
}

function paginationItems(current: number, total: number): PaginationItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((left, right) => left - right);
  const items: PaginationItem[] = [];

  pages.forEach((page, index) => {
    const previous = pages[index - 1];
    if (previous && page - previous > 1) items.push(`ellipsis-${previous}`);
    items.push(page);
  });

  return items;
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

function HierarchyIcon({ level }: { level: string }) {
  if (level === "BLOCK") return <House className="size-6" strokeWidth={1.6} />;
  if (level === "FLOOR")
    return <Layers3 className="size-6" strokeWidth={1.6} />;
  if (level === "ZONE") return <MapPin className="size-6" strokeWidth={1.6} />;
  return <Building2 className="size-6" strokeWidth={1.6} />;
}

function HierarchyTabIcon({ level }: { level: string }) {
  if (level === TYPE_MODE) return <Layers3 className="size-3.5" />;
  if (level === "BLOCK") return <House className="size-3.5" />;
  if (level === "FLOOR") return <Layers3 className="size-3.5" />;
  if (level === "ZONE") return <MapPin className="size-3.5" />;
  return <Building2 className="size-3.5" />;
}

function GroupCard({
  name,
  detail,
  counts,
  level,
  selected,
  onClick,
}: {
  name: string;
  detail: string;
  counts: UnitCounts;
  level: string;
  selected: boolean;
  onClick: () => void;
}) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-white p-2 text-left transition-colors",
        selected
          ? "border-[#1980C0]"
          : "border-[#E4E4E7] hover:border-[#1980C0]/50",
      )}
    >
      <div className="grid size-16 w-20 shrink-0 place-items-center rounded-lg bg-[#EFF6FC] text-[#1980C0]">
        <HierarchyIcon level={level} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="truncate text-xs font-semibold text-[#1f1f1f]">{name}</p>
        <p className="text-[10px] text-[#6b6b6b]">
          {total} unit · {detail}
        </p>
        <StatusCounts counts={counts} />
      </div>
      <ChevronRight className="size-4 shrink-0 text-[#667085]" />
    </button>
  );
}

export function UnitDistribution({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState<string>();
  const [groupId, setGroupId] = useState<string>();
  const [typeName, setTypeName] = useState<string>();
  const [rightFilter, setRightFilter] = useState("all");
  const [page, setPage] = useState(1);

  const projectQuery = useProjectAvailability(projectId);
  const projectData = projectQuery.data;
  const hierarchyGroups =
    projectData?.hierarchyGroups ?? projectData?.groups ?? [];
  const hierarchyLevels = [
    ...new Set(hierarchyGroups.map((group) => group.level)),
  ];
  const modes = [
    ...hierarchyLevels.map((level) => ({
      value: level,
      label: formatHierarchyLevel(level),
    })),
    { value: TYPE_MODE, label: "Tipe" },
  ];
  const effectiveMode = modes.some((item) => item.value === mode)
    ? (mode as string)
    : (modes[0]?.value ?? TYPE_MODE);
  const modeGroups = hierarchyGroups.filter(
    (group) => group.level === effectiveMode,
  );
  const activeGroup =
    modeGroups.find((group) => group.id === groupId) ?? modeGroups[0];
  const queryNodeId =
    effectiveMode === TYPE_MODE ? projectData?.root?.id : activeGroup?.id;
  const nodeQuery = useHierarchyNodeAvailability(projectId, queryNodeId);
  const nodeUnits = queryNodeId
    ? (nodeQuery.data?.units ?? [])
    : (projectData?.units ?? []);
  const typeNames = [...new Set(nodeUnits.map((unit) => unit.type))].sort(
    (left, right) => left.localeCompare(right, "id-ID", { numeric: true }),
  );
  const activeType =
    typeNames.find((name) => name === typeName) ?? typeNames[0];
  const childOptions =
    effectiveMode === TYPE_MODE ? [] : (nodeQuery.data?.children ?? []);
  const rightTabs =
    childOptions.length > 0
      ? [
          { value: "all", label: "Semua" },
          ...childOptions.map((child) => ({
            value: `node:${child.id}`,
            label: child.name,
          })),
        ]
      : effectiveMode === TYPE_MODE
        ? [
            { value: "all", label: "Semua" },
            ...STATUSES.map((status) => ({
              value: `status:${status.value}`,
              label: status.label,
            })),
          ]
        : [
            { value: "all", label: "Semua" },
            ...typeNames.map((name) => ({
              value: `type:${name}`,
              label: name,
            })),
          ];
  const effectiveRightFilter = rightTabs.some(
    (item) => item.value === rightFilter,
  )
    ? rightFilter
    : "all";
  const selectedChild = childOptions.find(
    (child) => `node:${child.id}` === effectiveRightFilter,
  );
  const scopeUnits = selectedChild
    ? nodeUnits.filter(
        (unit) =>
          unit.locationPathIds?.includes(selectedChild.id) ||
          unit.location === selectedChild.name,
      )
    : nodeUnits;
  const filteredUnits = scopeUnits.filter((unit) => {
    if (effectiveMode === TYPE_MODE) {
      const selectedStatus = effectiveRightFilter.startsWith("status:")
        ? effectiveRightFilter.slice("status:".length)
        : null;
      return (
        unit.type === activeType &&
        (!selectedStatus || unit.status === selectedStatus)
      );
    }

    const selectedType = effectiveRightFilter.startsWith("type:")
      ? effectiveRightFilter.slice("type:".length)
      : null;
    return !selectedType || unit.type === selectedType;
  });
  const selectedCounts = countUnits(filteredUnits);
  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleUnits = filteredUnits.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const selectedName =
    effectiveMode === TYPE_MODE
      ? (activeType ?? "Tipe Unit")
      : (activeGroup?.name ?? projectData?.project.name ?? "Unit Distribution");
  const nodeLoading = Boolean(queryNodeId) && nodeQuery.isLoading;
  const nodeError = queryNodeId ? nodeQuery.error : null;

  const resetTable = () => {
    setRightFilter("all");
    setPage(1);
  };

  const selectMode = (nextMode: string) => {
    setMode(nextMode);
    if (nextMode !== TYPE_MODE) {
      const firstGroup = hierarchyGroups.find(
        (group) => group.level === nextMode,
      );
      setGroupId(firstGroup?.id);
    }
    setTypeName(undefined);
    resetTable();
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
  if (!projectData) {
    return (
      <AvailabilityState message="Data availability proyek tidak ditemukan." />
    );
  }

  return (
    <div className="space-y-3">
      <AvailabilityIntegrityWarning integrity={projectData.integrity} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <section className="flex h-[calc(100vh-13rem)] min-h-[560px] max-h-[720px] flex-col overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#F6F7F9] p-3">
        <Tabs
          value={effectiveMode}
          onValueChange={selectMode}
          className="gap-3"
        >
          <TabsList className="group-data-horizontal/tabs:h-auto flex h-auto w-full justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-lg bg-white p-1">
            {modes.map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-7 min-w-24 flex-1 gap-1 rounded-md px-2 text-xs font-medium text-[#6b6b6b] shadow-none data-[state=active]:bg-[#E5F1FA] data-[state=active]:text-[#1980C0] data-[state=active]:shadow-none"
              >
                <HierarchyTabIcon level={value} />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="my-3 border-t border-[#E4E4E7]" />

        <ScrollArea className="-mr-2 min-h-0 flex-1 pr-2">
          {nodeLoading && effectiveMode === TYPE_MODE ? (
            <div className="flex min-h-44 flex-col items-center justify-center gap-2 text-xs text-[#667085]">
              <LoaderCircle className="size-5 animate-spin" />
              Memuat tipe unit...
            </div>
          ) : nodeError && effectiveMode === TYPE_MODE ? (
            <AvailabilityState
              message={errorMessage(nodeError, "Gagal memuat tipe unit.")}
            />
          ) : effectiveMode === TYPE_MODE ? (
            typeNames.length > 0 ? (
              <div className="space-y-2 pb-1">
                {typeNames.map((name) => {
                  const typeUnits = scopeUnits.filter(
                    (unit) => unit.type === name,
                  );
                  return (
                    <GroupCard
                      key={name}
                      name={name}
                      detail={projectData.project.name}
                      counts={countUnits(typeUnits)}
                      level={TYPE_MODE}
                      selected={name === activeType}
                      onClick={() => {
                        setTypeName(name);
                        setRightFilter("all");
                        setPage(1);
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="px-3 py-12 text-center text-xs text-[#667085]">
                Belum ada tipe unit pada proyek ini.
              </p>
            )
          ) : modeGroups.length > 0 ? (
            <div className="space-y-2 pb-1">
              {modeGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  name={group.name}
                  detail={`${group.children} sublokasi`}
                  counts={countsForGroup(group)}
                  level={group.level}
                  selected={group.id === activeGroup?.id}
                  onClick={() => {
                    setGroupId(group.id);
                    resetTable();
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="px-3 py-12 text-center text-xs text-[#667085]">
              Belum ada data {formatHierarchyLevel(effectiveMode)} pada proyek
              ini.
            </p>
          )}
        </ScrollArea>
      </section>

      <section className="flex h-[calc(100vh-13rem)] min-h-[560px] max-h-[720px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#E4E4E7] bg-white p-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#1f1f1f]">
              {selectedName}
            </h3>
            <p className="text-[10px] text-[#667085]">
              {effectiveMode === TYPE_MODE
                ? projectData.project.name
                : `${formatHierarchyLevel(effectiveMode)} · ${projectData.project.name}`}
            </p>
          </div>
          {!nodeLoading && !nodeError && (
            <p className="text-[11px] text-[#6b6b6b]">
              {filteredUnits.length} unit · Tersedia: {selectedCounts.available}
            </p>
          )}
        </div>

        {!nodeLoading && !nodeError && rightTabs.length > 1 && (
          <Tabs
            value={effectiveRightFilter}
            onValueChange={(value) => {
              setRightFilter(value);
              setPage(1);
            }}
            className="mb-3 gap-0"
          >
            <TabsList className="group-data-horizontal/tabs:h-auto flex min-h-11 w-full justify-start overflow-x-auto overflow-y-hidden rounded-lg border border-[#D9E0E7] bg-white px-0 py-1">
              {rightTabs.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="h-9 min-w-20 flex-none rounded-none border-0 border-r border-[#E4E7EC] bg-white px-4 py-2 text-[11px] font-medium text-[#344054] shadow-none last:border-r-0 data-[state=active]:bg-[#E8F4FF] data-[state=active]:text-[#0878D1] data-[state=active]:shadow-[inset_0_0_0_1px_#1684ff]"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {nodeLoading ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-xs text-[#667085]">
            <LoaderCircle className="size-5 animate-spin" />
            Memuat unit...
          </div>
        ) : nodeError ? (
          <AvailabilityState
            message={errorMessage(nodeError, "Gagal memuat unit.")}
          />
        ) : (
          <>
            <ScrollArea
              horizontal
              className="min-h-0 flex-1 rounded-lg border border-[#E4E4E7]"
            >
              <div className="min-w-[980px] pb-2">
                <table className="w-full text-left text-[11px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                  <thead className="sticky top-0 z-10 bg-[#F6F7F9] text-[#6b6b6b]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Lokasi</th>
                      <th className="px-3 py-2 font-medium">Level</th>
                      <th className="px-3 py-2 font-medium">No. Unit</th>
                      <th className="px-3 py-2 font-medium">Tipe</th>
                      <th className="px-3 py-2 font-medium">Varian</th>
                      <th className="px-3 py-2 font-medium">Hook</th>
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
                        <td className="px-3 py-2">{unit.location}</td>
                        <td className="px-3 py-2 text-[#667085]">
                          {formatHierarchyLevel(unit.locationLevel)}
                        </td>
                        <td className="px-3 py-2 font-medium">{unit.code}</td>
                        <td className="px-3 py-2">{unit.type}</td>
                        <td className="px-3 py-2">{unit.variant}</td>
                        <td className="px-3 py-2">
                          {unit.isHook ? "Ya" : "Tidak"}
                        </td>
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
                          colSpan={8}
                          className="h-28 px-3 text-center text-[#667085]"
                        >
                          Tidak ada unit untuk pilihan ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </ScrollArea>

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
                  className="grid size-7 cursor-pointer place-items-center rounded-md border border-[#E4E4E7] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                {paginationItems(currentPage, totalPages).map((item) =>
                  typeof item === "number" ? (
                    <button
                      key={item}
                      type="button"
                      aria-current={item === currentPage ? "page" : undefined}
                      onClick={() => setPage(item)}
                      className={cn(
                        "grid size-7 cursor-pointer place-items-center rounded-md border border-[#E4E4E7]",
                        item === currentPage &&
                          "border-[#1980C0] bg-[#1980C0] text-white",
                      )}
                    >
                      {item}
                    </button>
                  ) : (
                    <span
                      key={item}
                      className="grid size-7 place-items-center text-[#98A2B3]"
                    >
                      …
                    </span>
                  ),
                )}
                <button
                  type="button"
                  aria-label="Halaman berikutnya"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  className="grid size-7 cursor-pointer place-items-center rounded-md border border-[#E4E4E7] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      </div>
    </div>
  );
}
