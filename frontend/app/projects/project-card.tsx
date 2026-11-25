import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { NoImagePlaceholder } from "@/components/projects/no-image-placeholder";
import { cn } from "@/lib/utils";
import type { ProjectListItem } from "@/hooks/use-projects";
import {
  STATUS_STYLE,
  projectMetrics,
  shortLocation,
  statusOf,
} from "./projects-data";

/** Angka metrik berwarna dengan label abu di bawahnya. */
function Metric({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={cn("rounded-xl px-2 py-2 text-center", className)}>
      <p className="text-base font-bold leading-tight">{value.toLocaleString("id-ID")}</p>
      <p className="mt-0.5 text-xs leading-tight text-[#6b6b6b]">{label}</p>
    </div>
  );
}

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const { units, sold, reserved, available, soldPct } = projectMetrics(
    project.unitSummary,
    project.totalSlots,
  );
  const status = statusOf(project.isActive);
  // Baris kartu (foto, nama, lokasi, angka) memakai subgrid agar sejajar dengan kartu di sebelahnya.
  return (
    <Link
      href={`/projects/${project.id}`}
      className="row-span-4 grid grid-rows-subgrid gap-y-0 overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-[#F4F4F5]">
        {project.coverUrl ? (
          <Image
            src={project.coverUrl}
            alt={project.name}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <NoImagePlaceholder className="absolute inset-0" />
        )}
        <span
          className={cn(
            "absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-medium shadow-sm",
            STATUS_STYLE[status],
            "bg-white/95",
          )}
        >
          {status}
        </span>
      </div>
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-5 text-[#1f1f1f]">
            {project.name}
          </h3>
          <span className="max-w-[45%] shrink-0 break-all pt-0.5 text-right text-[11px] leading-4 text-[#667085]">
            {project.code}
          </span>
        </div>
      </div>
      <div className="px-4 pt-2">
        {shortLocation(project) && (
          <p className="flex items-start gap-1.5 text-sm text-[#475467]">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span>{shortLocation(project)}</span>
          </p>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="mb-1 text-right text-sm text-[#1f1f1f]">
            Sold {soldPct}%
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E4E4E7]">
            <div
              className="h-full rounded-full bg-[#1980C0]"
              style={{ width: `${soldPct}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Metric label="Units" value={units} className="bg-[#EEF6FD] text-[#1e3a8a]" />
          <Metric label="Sold" value={sold} className="bg-[#EFFAF2] text-[#166534]" />
          <Metric label="Reserved" value={reserved} className="bg-[#ECFAFA] text-[#155e75]" />
          <Metric label="Available" value={available} className="bg-[#FFF4EB] text-[#9a3412]" />
        </div>
      </div>
    </Link>
  );
}
