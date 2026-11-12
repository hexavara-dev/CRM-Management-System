import { MetricTile } from "@/components/projects/metric-tile";
import type { ProjectDetail } from "@/hooks/use-projects";
import { projectMetrics } from "../projects-data";

export function SoldSummary({ project }: { project: ProjectDetail }) {
  const { units, sold, reserved, available, soldPct } = projectMetrics(project.unitSummary);
  return (
    <div className="w-full space-y-1.5 md:w-[330px]">
      <p className="text-right text-[11px] font-medium text-[#3f3f46]">Sold {soldPct}%</p>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[#E4E4E7]">
        <div className="h-full rounded-full bg-[#1980C0]" style={{ width: `${soldPct}%` }} />
      </div>
      <div className="grid grid-cols-4 gap-1.5 pt-1">
        <MetricTile label="Units" value={units} className="bg-[#E8EFFB] text-[#2F4F8F]" />
        <MetricTile label="Sold" value={sold} className="bg-[#EEF7E5] text-[#4C7A2F]" />
        <MetricTile label="Reserved" value={reserved} className="bg-[#E4F5FA] text-[#2B7A8C]" />
        <MetricTile label="Available" value={available} className="bg-[#FCEEE4] text-[#B5651D]" />
      </div>
    </div>
  );
}
