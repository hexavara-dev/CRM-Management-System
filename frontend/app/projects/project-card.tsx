import Image from "next/image";
import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { MetricTile } from "@/components/projects/metric-tile";
import { cn } from "@/lib/utils";
import type { ProjectListItem } from "@/hooks/use-projects";
import { STATUS_STYLE, projectMetrics, shortLocation, statusOf } from "./projects-data";

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const { units, sold, reserved, available, soldPct } = projectMetrics(project.unitSummary);
  const status = statusOf(project.isActive);
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block overflow-hidden rounded-xl border border-[#E4E4E7] bg-white p-2 transition-shadow hover:shadow-md"
    >
      <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#DCE9F2] to-[#F3F7FA]">
        {project.coverUrl ? (
          <Image src={project.coverUrl} alt={project.name} fill unoptimized className="object-cover" />
        ) : (
          <Building2 className="size-10 text-[#1980C0]/40" />
        )}
        <span className={cn("absolute right-2 top-2 rounded-md px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[status])}>
          {status}
        </span>
      </div>
      <div className="space-y-2 px-1 pb-1 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#1f1f1f]">{project.name}</h3>
          <span className="shrink-0 text-[11px] text-[#6b6b6b]">{project.code}</span>
        </div>
        {shortLocation(project) && (
          <p className="flex items-center gap-1 text-[11px] text-[#6b6b6b]">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{shortLocation(project)}</span>
          </p>
        )}
        <div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E4E4E7]">
            <div className="h-full rounded-full bg-[#1980C0]" style={{ width: `${soldPct}%` }} />
          </div>
          <p className="mt-1 text-right text-[10px] text-[#6b6b6b]">Sold {soldPct}%</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <MetricTile label="Units" value={units} className="bg-[#E5F1FA] text-[#1980C0]" />
          <MetricTile label="Sold" value={sold} className="bg-[#E6F6EC] text-[#1E9E55]" />
          <MetricTile label="Reserved" value={reserved} className="bg-[#FFF1E0] text-[#D9822B]" />
          <MetricTile label="Available" value={available} className="bg-[#FDEBEA] text-[#D64545]" />
        </div>
      </div>
    </Link>
  );
}
