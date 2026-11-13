import { CalendarDays, House, Layers3, Tag } from "lucide-react";

import { percentage } from "./percentage";
import { AvailabilitySummaryCard } from "./summary-card";
import type { ProjectAvailabilityDetail } from "./types";

export function ProjectAvailabilitySummary({
  project,
}: {
  project: ProjectAvailabilityDetail;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
      <AvailabilitySummaryCard
        title="Total Units"
        value={project.totalUnits}
        icon={<Layers3 className="size-5" />}
        iconClassName="text-[#268dff]"
        iconContainerClassName="bg-[#edf7ff]"
      />

      <AvailabilitySummaryCard
        title="Available"
        value={project.available}
        percentageText={`${percentage(project.available, project.totalUnits)}%`}
        icon={<House className="size-5" />}
        iconClassName="text-[#38b94e]"
        iconContainerClassName="bg-[#effff1]"
        percentageClassName="bg-[#eaffed] text-[#28ae40]"
      />

      <AvailabilitySummaryCard
        title="Reserved / Processing"
        value={project.reserved + project.processing}
        percentageText={`${percentage(project.reserved + project.processing, project.totalUnits)}%`}
        icon={<CalendarDays className="size-5" />}
        iconClassName="text-[#268dff]"
        iconContainerClassName="bg-[#edf7ff]"
        percentageClassName="bg-[#fff2dc] text-[#e48c00]"
      />

      <AvailabilitySummaryCard
        title="Sold"
        value={project.sold}
        percentageText={`${percentage(project.sold, project.totalUnits)}%`}
        icon={<Tag className="size-5" />}
        iconClassName="text-[#ff4656]"
        iconContainerClassName="bg-[#fff0f2]"
        percentageClassName="bg-[#ffe7e9] text-[#ff4052]"
      />
    </div>
  );
}
