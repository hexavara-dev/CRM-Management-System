import { ArrowLeft, Building2, ChevronRight, MapPin } from "lucide-react";
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
      <div className="flex items-start justify-between gap-4 border-b border-[#edf0f3] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#101828]">
            Availability Overview
          </h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm font-medium text-[#3664ff]">
            <span>Availability & Reservation</span>
            <ChevronRight className="size-4 text-[#98a2b3]" />
            <Link href="/availability" className="hover:underline">Availability Overview</Link>
            <ChevronRight className="size-4 text-[#98a2b3]" />
            <span className="font-semibold text-[#101828]">{project.name}</span>
          </div>
        </div>

        <Button
          asChild
          variant="outline"
          className="h-10 rounded-xl border-[#e5e7eb] px-4 text-sm font-medium shadow-none"
        >
          <Link href="/availability">
            <ArrowLeft className="mr-1.5 size-4" />
            Back to Overview
          </Link>
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-4">
        {project.image ? (
          <Image
            src={project.image}
            alt={project.name}
            width={112}
            height={64}
            unoptimized
            className="h-16 w-28 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e8f4ff] to-[#eef2f6]">
            <Building2 className="size-8 text-[#2695ff]/55" />
          </div>
        )}

        <div>
          <h2 className="text-lg font-bold text-[#111827]">
            {project.name}
          </h2>

          <div className="mt-1 flex items-center gap-1.5 text-xs text-[#1e3a8a]">
            <MapPin className="size-3.5 shrink-0" />
            {project.location}
          </div>
        </div>
      </div>
    </div>
  );
}
