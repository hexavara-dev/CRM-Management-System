import { ArrowLeft, Building2, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import type { ProjectAvailabilityDetail } from "./types";

export function ProjectAvailabilityHeader({
  project,
}: {
  project: ProjectAvailabilityDetail;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-bold tracking-tight text-[#101828]">
            Availability Overview
          </h1>

          <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] font-medium text-[#62748e]">
            <span>Availability & Reservation</span>
            <ChevronRight className="size-3" />
            <span>Availability Overview</span>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-[#101828]">{project.name}</span>
          </div>
        </div>

        <Button
          asChild
          variant="outline"
          className="h-9 rounded-lg border-[#e5e7eb] px-4 text-[11px] font-semibold shadow-none"
        >
          <Link href="/availability">
            <ArrowLeft className="mr-1.5 size-3.5" />
            Back to Overview
          </Link>
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {project.image ? (
          <Image
            src={project.image}
            alt={project.name}
            width={90}
            height={55}
            className="h-[55px] w-[90px] rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-[55px] w-[90px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#e8f4ff] to-[#eef2f6]">
            <Building2 className="size-6 text-[#2695ff]/55" />
          </div>
        )}

        <div>
          <h2 className="text-[16px] font-bold text-[#111827]">
            {project.name}
          </h2>

          <div className="mt-1 flex items-center gap-1 text-[10px] text-[#667085]">
            <Building2 className="size-3" />
            {project.location}
          </div>
        </div>
      </div>
    </div>
  );
}
