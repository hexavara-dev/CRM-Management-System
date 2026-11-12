"use client";

import { useState } from "react";
import { Boxes, Building2, Folder, ImageIcon, Info, Layers, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LocationNode, UnitItem } from "./hierarchy-step";
import type { UnitType } from "./unit-type-step";
import { Stat } from "@/components/projects/stat";
import { SectionCard } from "@/components/projects/section-card";

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
};

export const EMPTY_INFO: ProjectInfo = { code: "", name: "", status: "", description: "", province: "", city: "", subdistrict: "", village: "", address: "", postalCode: "" };

const COLORS = ["#3BB4F2", "#F5D33F", "#4CAF50", "#E57373", "#9575CD", "#FF8A65"];
const STATUS_STYLE: Record<string, string> = {
  Active: "bg-[#E7F6EC] text-[#1E9E55]",
  "In Development": "bg-[#FFF4DB] text-[#B58900]",
  Inactive: "bg-[#F1F1F3] text-[#6b6b6b]",
};

type Props = { info: ProjectInfo; coverUrls: string[]; unitTypes: UnitType[]; nodes: LocationNode[]; units: UnitItem[] };

export function PreviewStep({ info, coverUrls, unitTypes, nodes, units }: Props) {
  const [expanded, setExpanded] = useState(false);

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
      const hit = acc.find((l) => l.level.toLowerCase() === n.level.toLowerCase());
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
    return { cluster: top.id === leaf.id ? "-" : top.name, blok: leaf.name, total: units.filter((u) => u.locationId === leaf.id).length };
  });

  const typeStats = unitTypes.map((t, i) => ({ name: t.name, count: units.filter((u) => u.type === t.name).length, color: COLORS[i % COLORS.length] })).filter((t) => t.count > 0);
  const totalUnits = units.length;
  let acc = 0;
  const donut = typeStats.length
    ? `conic-gradient(${typeStats
        .map((t) => {
          const from = (acc / totalUnits) * 100;
          acc += t.count;
          return `${t.color} ${from}% ${(acc / totalUnits) * 100}%`;
        })
        .join(", ")})`
    : "conic-gradient(#E4E4E7 0 100%)";

  const location = [info.subdistrict, info.city].filter(Boolean).join(", ") || [info.village, info.province].filter(Boolean).join(", ");
  const summary =
    [...levelCounts.map((l) => `${l.count} ${l.level.toLowerCase()}${l.count > 1 ? "s" : ""}`), `${unitTypes.length} house type${unitTypes.length === 1 ? "" : "s"}${unitTypes.length ? ` (${unitTypes.map((t) => t.name.toLowerCase()).join(", ")})` : ""}`]
      .join(", ")
      .replace(/, ([^,]+)$/, ", and $1");

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg bg-[#F6F7F9] md:w-44">
          {coverUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL lokal, tidak bisa dioptimasi next/image
            <img src={coverUrls[0]} alt="Project cover" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-[#9CA3AF]">
              <ImageIcon className="size-6" />
            </div>
          )}
          {coverUrls.length > 1 && <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-center text-[11px] font-medium text-white">+{coverUrls.length - 1} Lainnya</span>}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 md:flex-row md:items-start">
          <div className="min-w-0">
            <div className="text-[11px] text-[#6b6b6b]">{info.code || "-"}</div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-[#1f1f1f]">{info.name || "-"}</h3>
              {info.status && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[info.status] ?? STATUS_STYLE.Inactive)}>{info.status}</span>}
            </div>
            {location && (
              <div className="mt-1 flex items-center gap-1 text-xs text-[#6b6b6b]">
                <MapPin className="size-3.5" />
                <span className="underline">{location}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {levelCounts.map((l, i) => (
              <Stat key={l.level} icon={i === 0 ? <Folder className="size-4" /> : <Building2 className="size-4" />} value={l.count} label={l.level} />
            ))}
            <Stat icon={<Boxes className="size-4" />} value={totalUnits} label="Unit" />
            <Stat icon={<Layers className="size-4" />} value={unitTypes.length} label="Type" />
          </div>
        </div>
      </div>

      {info.description && (
        <p className="text-xs leading-relaxed text-[#1f1f1f]">
          <span className={cn(!expanded && "line-clamp-2")}>{info.description}</span>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-0.5 font-medium text-[#1980C0]">
            {expanded ? "Show Less" : "Read More"}
          </button>
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_1.3fr]">
        <SectionCard title="Facilities">
          <p className="text-xs text-[#9CA3AF]">Belum ada data fasilitas.</p>
        </SectionCard>

        <SectionCard title="Unit distribution by house type">
          {typeStats.length === 0 ? (
            <p className="text-xs text-[#9CA3AF]">Belum ada unit yang ditambahkan.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative size-24 shrink-0 rounded-full" style={{ background: donut }}>
                <div className="absolute inset-[14px] grid place-items-center rounded-full bg-white text-center">
                  <div>
                    <div className="text-sm font-semibold leading-none text-[#1f1f1f]">{totalUnits}</div>
                    <div className="text-[10px] text-[#6b6b6b]">Unit</div>
                  </div>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 text-[11px]">
                {typeStats.map((t) => (
                  <li key={t.name} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: t.color }} />
                      <span className="truncate text-[#6b6b6b]">{t.name}</span>
                    </span>
                    <span className="whitespace-nowrap font-semibold text-[#1f1f1f]">
                      {t.count} Unit ({((t.count / totalUnits) * 100).toFixed(1)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Unit distribution by blok">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[#E4E4E7] text-left text-[#1f1f1f]">
                <th className="py-1.5 font-medium">Cluster</th>
                <th className="py-1.5 font-medium">Blok</th>
                <th className="py-1.5 text-right font-medium">Total Unit</th>
              </tr>
            </thead>
            <tbody>
              {blokRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-[#9CA3AF]">Belum ada struktur lokasi.</td>
                </tr>
              ) : (
                blokRows.map((r, i) => (
                  <tr key={i} className="border-b border-[#F1F1F3] last:border-0">
                    <td className="py-1.5 text-[#6b6b6b]">{i === 0 || blokRows[i - 1].cluster !== r.cluster ? r.cluster : ""}</td>
                    <td className="py-1.5 text-[#1f1f1f]">{r.blok}</td>
                    <td className="py-1.5 text-right text-[#1f1f1f]">{r.total} Unit</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-[#BFE0F3] bg-[#E8F3FA] px-3 py-2 text-[11px] text-[#1f1f1f]">
        <Info className="mt-0.5 size-3.5 shrink-0 text-[#1980C0]" />
        <span>The total number of units comprises {summary}.</span>
      </div>
    </section>
  );
}
