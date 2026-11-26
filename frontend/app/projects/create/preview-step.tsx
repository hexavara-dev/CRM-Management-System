"use client";

import { useEffect, useRef, useState } from "react";
import {
  Boxes,
  Building2,
  Folder,
  ImageIcon,
  Info,
  Layers,
  MapPin,
} from "lucide-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LocationNode, UnitItem } from "./hierarchy-step";
import type { UnitType } from "./unit-type-step";
import { Stat } from "@/components/projects/stat";
import { SectionCard } from "@/components/projects/section-card";
import { FacilityIcon } from "@/components/projects/facility-icon";
import { useProjectFacilities } from "@/hooks/use-projects";
import { RichTextContent } from "./rich-text";

export type ProjectInfo = {
  code: string;
  name: string;
  status: string;
  description: string;
  province: string;
  city: string;
  subdistrict: string;
  village: string;
  address: string;
  postalCode: string;
  mapsUrl: string;
  siteplanImg: string;
};

export const EMPTY_INFO: ProjectInfo = {
  code: "",
  name: "",
  status: "",
  description: "",
  province: "",
  city: "",
  subdistrict: "",
  village: "",
  address: "",
  postalCode: "",
  mapsUrl: "",
  siteplanImg: "",
};

const COLORS = [
  "#3BB4F2",
  "#F5D33F",
  "#4CAF50",
  "#E57373",
  "#9575CD",
  "#FF8A65",
];
const STATUS_STYLE: Record<string, string> = {
  Active: "bg-[#E7F6EC] text-[#1E9E55]",
  Inactive: "bg-[#F1F1F3] text-[#6b6b6b]",
};

type Props = {
  info: ProjectInfo;
  coverUrls: string[];
  unitTypes: UnitType[];
  nodes: LocationNode[];
  units: UnitItem[];
  facilityAttributeIds: string[];
};

export function PreviewStep({
  info,
  coverUrls,
  unitTypes,
  nodes,
  units,
  facilityAttributeIds,
}: Props) {
  const facilities =
    useProjectFacilities().data?.filter((item) =>
      facilityAttributeIds.includes(item.id),
    ) ?? [];
  const [expanded, setExpanded] = useState(false);
  // Tombol Read More hanya muncul jika deskripsi benar-benar terpotong 2 baris.
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const element = descriptionRef.current?.firstElementChild as HTMLElement | null | undefined;
    if (!element || expanded) return;
    const measure = () => setTruncated(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [info.description, expanded]);
  const [hoveredType, setHoveredType] = useState<string | null>(null);

  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id);
  const depthOf = (n: LocationNode) => {
    let d = 1;
    let cur = n;
    while (cur.parentId !== "root") {
      const parent = nodes.find((x) => x.id === cur.parentId);
      if (!parent) break;
      cur = parent;
      d++;
    }
    return d;
  };
  // Jumlah per level, diurutkan dari level paling atas (mis. Cluster lalu Blok).
  const levelCounts = [...nodes]
    .sort((a, b) => depthOf(a) - depthOf(b))
    .reduce<{ level: string; count: number }[]>((acc, n) => {
      const hit = acc.find(
        (l) => l.level.toLowerCase() === n.level.toLowerCase(),
      );
      if (hit) hit.count++;
      else acc.push({ level: n.level, count: 1 });
      return acc;
    }, []);

  // Urutan pohon (depth-first) agar baris tabel mengikuti struktur.
  const ordered: LocationNode[] = [];
  const walk = (pid: string) =>
    childrenOf(pid).forEach((n) => {
      ordered.push(n);
      walk(n.id);
    });
  walk("root");
  const leaves = ordered.filter((n) => childrenOf(n.id).length === 0);
  const topAncestor = (n: LocationNode) => {
    let cur = n;
    while (cur.parentId !== "root") {
      const parent = nodes.find((x) => x.id === cur.parentId);
      if (!parent) break;
      cur = parent;
    }
    return cur;
  };
  const blokRows = leaves.map((leaf) => {
    const top = topAncestor(leaf);
    return {
      cluster: top.id === leaf.id ? "-" : top.name,
      blok: leaf.name,
      total: units.filter((u) => u.locationId === leaf.id).length,
    };
  });

  // Satu grup per lokasi teratas; hanya grup pertama yang terbuka agar tabel tidak memanjang.
  const blokGroups = [...new Set(blokRows.map((row) => row.cluster))].map((cluster) => {
    const rows = blokRows.filter((row) => row.cluster === cluster);
    return { cluster, rows, total: rows.reduce((sum, row) => sum + row.total, 0) };
  });
  const [closedGroups, setClosedGroups] = useState<Set<string> | null>(null);
  const closed = closedGroups ?? new Set(blokGroups.slice(1).map((group) => group.cluster));
  const toggleGroup = (cluster: string) => {
    const next = new Set(closed);
    if (next.has(cluster)) next.delete(cluster);
    else next.add(cluster);
    setClosedGroups(next);
  };

  const typeStats = unitTypes
    .map((t, i) => ({
      name: t.name,
      count: t.variants.reduce((sum, option) => sum + (Number(option.stock) || 0), 0),
      color: COLORS[i % COLORS.length],
    }))
    .filter((t) => t.count > 0);
  const totalUnits = typeStats.reduce((total, type) => total + type.count, 0);
  let acc = 0;
  const segments = typeStats.map((t) => {
    const start = acc / totalUnits;
    acc += t.count;
    return { ...t, start, share: t.count / totalUnits };
  });
  const hovered = segments.find((t) => t.name === hoveredType) ?? null;

  const location =
    [info.subdistrict, info.city].filter(Boolean).join(", ") ||
    [info.village, info.province].filter(Boolean).join(", ");
  const summary = [
    ...levelCounts.map(
      (l) => `${l.count} ${l.level.toLowerCase()}${l.count > 1 ? "s" : ""}`,
    ),
    `${unitTypes.length} house type${unitTypes.length === 1 ? "" : "s"}${unitTypes.length ? ` (${unitTypes.map((t) => t.name.toLowerCase()).join(", ")})` : ""}`,
  ]
    .join(", ")
    .replace(/, ([^,]+)$/, ", and $1");

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg bg-[#F6F7F9] md:w-52">
          {coverUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL lokal, tidak bisa dioptimasi next/image
            <img
              src={coverUrls[0]}
              alt="Project cover"
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center text-[#9CA3AF]">
              <ImageIcon className="size-6" />
            </div>
          )}
          {coverUrls.length > 1 && (
            <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-center text-xs font-medium text-white">
              +{coverUrls.length - 1} Lainnya
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 md:flex-row md:items-start">
          <div className="min-w-0">
            <div className="text-xs text-[#6b6b6b]">{info.code || "-"}</div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-[#1f1f1f]">
                {info.name || "-"}
              </h3>
              {info.status && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    STATUS_STYLE[info.status] ?? STATUS_STYLE.Inactive,
                  )}
                >
                  {info.status}
                </span>
              )}
            </div>
            {location && (
              <div className="mt-1 flex items-center gap-1 text-sm text-[#6b6b6b]">
                <MapPin className="size-4" />
                <span className="underline">{location}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {levelCounts.map((l, i) => (
              <Stat
                key={l.level}
                icon={
                  i === 0 ? (
                    <Folder className="size-4" />
                  ) : (
                    <Building2 className="size-4" />
                  )
                }
                value={l.count}
                label={l.level}
              />
            ))}
            <Stat
              icon={<Boxes className="size-4" />}
              value={totalUnits}
              label="Unit"
            />
            <Stat
              icon={<Layers className="size-4" />}
              value={unitTypes.length}
              label="Type"
            />
          </div>
        </div>
      </div>

      {info.description && (
        <div ref={descriptionRef} className="text-sm leading-relaxed text-[#1f1f1f]">
          <RichTextContent value={info.description} className={cn(!expanded && "line-clamp-2")} />
          {(truncated || expanded) && <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 cursor-pointer font-medium text-[#1980C0]"
          >
            {expanded ? "Show Less" : "Read More"}
          </button>}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Facilities">
          {facilities.length ? (
            facilities.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 py-1 text-sm"
              >
                <FacilityIcon iconKey={item.iconKey} className="size-[18px]" />
                {item.name}
              </div>
            ))
          ) : (
            <p className="text-sm text-[#9CA3AF]">
              Belum ada fasilitas dipilih.
            </p>
          )}
        </SectionCard>

        <SectionCard title="Unit distribution by house type">
          {typeStats.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">
              Belum ada slot unit yang ditentukan.
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative size-32 shrink-0">
                <svg viewBox="0 0 36 36" className="size-full -rotate-90" role="img" aria-label="Distribusi unit per tipe">
                  {segments.map((t) => (
                    <circle
                      key={t.name}
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke={t.color}
                      strokeWidth={hoveredType === t.name ? 5 : 4}
                      pathLength={100}
                      strokeDasharray={`${t.share * 100} ${100 - t.share * 100}`}
                      strokeDashoffset={-t.start * 100}
                      className={cn("cursor-pointer transition-all", hoveredType && hoveredType !== t.name && "opacity-40")}
                      onMouseEnter={() => setHoveredType(t.name)}
                      onMouseLeave={() => setHoveredType(null)}
                    >
                      <title>{`${t.name}: ${t.count} Unit (${(t.share * 100).toFixed(1)}%)`}</title>
                    </circle>
                  ))}
                </svg>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div className="max-w-20">
                    <div className="text-lg font-semibold leading-none text-[#1f1f1f]">
                      {hovered ? hovered.count : totalUnits}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[#6b6b6b]">{hovered ? hovered.name : "Unit"}</div>
                  </div>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                {typeStats.map((t) => (
                  <li
                    key={t.name}
                    onMouseEnter={() => setHoveredType(t.name)}
                    onMouseLeave={() => setHoveredType(null)}
                    className={cn(
                      "-mx-1.5 flex cursor-default items-center justify-between gap-2 rounded px-1.5 py-1 transition",
                      hoveredType === t.name && "bg-[#F1F5F9]",
                      hoveredType && hoveredType !== t.name && "opacity-50",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: t.color }}
                      />
                      <span className="truncate text-[#6b6b6b]">{t.name}</span>
                    </span>
                    <span className="whitespace-nowrap font-semibold text-[#1f1f1f]">
                      {t.count} Unit (
                      {((t.count / totalUnits) * 100).toFixed(1)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>

        <div className="lg:col-span-2">
        <SectionCard title="Unit distribution by blok">
          <div className="max-h-72 overflow-auto rounded-lg border border-[#E4E4E7]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
              <tr className="border-b border-[#E4E4E7] text-left text-[#475467]">
                <th className="px-4 py-2.5 font-medium">Cluster</th>
                <th className="px-4 py-2.5 font-medium">Blok</th>
                <th className="px-4 py-2.5 text-right font-medium">Unit Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {blokRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-[#9CA3AF]">
                    Belum ada struktur lokasi.
                  </td>
                </tr>
              ) : (
                blokGroups.flatMap(({ cluster, rows, total }) => {
                  const open = !closed.has(cluster);
                  return [
                    <tr
                      key={`group-${cluster}`}
                      onClick={() => toggleGroup(cluster)}
                      className="cursor-pointer border-t border-[#E4E4E7] bg-white transition-colors first:border-t-0 hover:bg-[#F8FAFC]"
                    >
                      <td className="px-4 py-2.5 font-medium text-[#1f1f1f]">
                        <button type="button" aria-expanded={open} className="flex cursor-pointer items-center gap-2 text-left">
                          <ChevronDown className={cn("size-4 shrink-0 text-[#6b6b6b] transition-transform", !open && "-rotate-90")} />
                          {cluster}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-[#6b6b6b]">{rows.length} lokasi</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex rounded-full bg-[#E8F3FA] px-2 py-0.5 font-semibold text-[#1980C0]">{total} Unit</span>
                      </td>
                    </tr>,
                    ...(open
                      ? rows.map((r) => (
                          <tr key={`${cluster}-${r.blok}`} className="border-t border-[#F1F1F3] bg-[#FCFCFD] transition-colors hover:bg-[#F8FAFC]">
                            <td className="px-4 py-2" />
                            <td className="py-2 pl-4 pr-4 text-[#475467]">
                              <span className="border-l-2 border-[#D9DEE5] pl-3">{r.blok}</span>
                            </td>
                            <td className="px-4 py-2 text-right text-[#475467]">{r.total} Unit</td>
                          </tr>
                        ))
                      : []),
                  ];
                })
              )}
            </tbody>
          </table>
          </div>
        </SectionCard>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-[#BFE0F3] bg-[#E8F3FA] px-4 py-2.5 text-sm text-[#1f1f1f]">
        <Info className="mt-0.5 size-4 shrink-0 text-[#1980C0]" />
        <span>The total number of units comprises {summary}.</span>
      </div>
    </section>
  );
}
