"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  
  ChartColumn,
  FileText,
  House,
  Images,
  Lightbulb,
  Map,
  MapPin,
  Search,
  ShieldCheck,
  SquareParking,
  Video,
  type LucideIcon,
} from "lucide-react";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { PageHeading } from "@/components/PageHeading";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject} from "@/hooks/use-projects";
import { STATUS_STYLE, fullAddress, projectMetrics, shortLocation, statusOf } from "../projects-data";
import { UnitDistribution } from "./unit-distribution";
import { InfoCard } from "@/components/projects/info-card";
import { CoverGallery } from "./cover-gallery";
import { SoldSummary } from "./sold-summary";


const FACILITIES: { name: string; icon: LucideIcon }[] = [
  { name: "Smart Home System", icon: House },
  { name: "Secure Parking", icon: SquareParking },
  { name: "24 Hour Security", icon: ShieldCheck },
  { name: "Well Lit Streets", icon: Lightbulb },
  ...Array.from({ length: 8 }, (_, i) => ({ name: `Facilitas ${i + 5}`, icon: ChartColumn })),
];

const TABS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "overview", label: "Overview", icon: Video },
  { value: "unit-distribution", label: "Unit Distribution", icon: ChartColumn },
  { value: "siteplan", label: "Siteplan", icon: Map },
  { value: "media", label: "Media", icon: Images },
  { value: "documents", label: "Documents", icon: FileText },
];

const TAB_TRIGGER =
  "h-8 flex-none gap-1.5 rounded-md border border-transparent bg-[#F3F4F6] px-3 text-xs font-medium text-[#9CA3AF] shadow-none hover:text-[#6b6b6b] " +
  "data-[state=active]:border-[#1980C0] data-[state=active]:bg-[#E5F1FA] data-[state=active]:text-[#1980C0] data-[state=active]:shadow-none";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: project, isLoading } = useProject(params.id);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const facilities = FACILITIES.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3 empty:hidden">
          <SidebarOpenTrigger />
        </header>
        <div className="space-y-4 p-4">
          <PageHeading
            title={project?.name ?? (isLoading ? "Loading..." : "Project not found")}
            extraCrumb={project?.name}
            actions={
              <div className="relative w-40 sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  aria-label="Search facilities"
                  className="h-9 w-full rounded-lg pl-8"
                />
              </div>
            }
          />
          <hr className="border-[#EDEDED]" />

          {isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : !project ? (
            <div className="rounded-xl border border-dashed border-[#E4E4E7] py-16 text-center text-sm text-[#6b6b6b]">
              Project not found.{" "}
              <Link href="/projects" className="font-medium text-[#1980C0] hover:underline">
                Back to projects
              </Link>
            </div>
          ) : (
            <>
              <CoverGallery project={project} />

              <div className="flex flex-col gap-4 px-1 md:flex-row md:items-end md:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] text-[#6b6b6b]">{project.code}</p>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-[#1f1f1f]">{project.name}</h2>
                    <span className={cn("rounded px-2 py-0.5 text-[10px] font-medium", STATUS_STYLE[statusOf(project.isActive)])}>
                      {statusOf(project.isActive)}
                    </span>
                  </div>
                  {shortLocation(project) && (
                    <p className="flex items-center gap-1 text-[11px] text-[#6b6b6b]">
                      <MapPin className="size-3.5" />
                      {shortLocation(project)}
                    </p>
                  )}
                </div>
                <SoldSummary project={project} />
              </div>

              <Tabs defaultValue="overview" className="gap-4">
                <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-b border-[#EDEDED] bg-transparent px-1 pb-3 pt-1">
                  {TABS.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger key={value} value={value} className={TAB_TRIGGER}>
                      <Icon className="size-3.5" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="overview">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,28%)]">
                    <div className="space-y-4">
                      <div>
                        <p className={cn("whitespace-pre-line text-xs leading-5 text-[#3f3f46]", !expanded && "line-clamp-4")}>
                          {project.description || "Belum ada deskripsi."}
                        </p>
                        {project.description && project.description.length > 240 && (
                          <button
                            type="button"
                            onClick={() => setExpanded((v) => !v)}
                            className="mt-1 text-xs font-medium text-[#1980C0] hover:underline"
                          >
                            {expanded ? "Read Less" : "Read More"}
                          </button>
                        )}
                      </div>
                      <hr className="border-[#EDEDED]" />
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-[#1f1f1f]">Facilities</h3>
                        {facilities.length === 0 ? (
                          <p className="text-xs text-[#6b6b6b]">No facilities match your search.</p>
                        ) : (
                          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-flow-col sm:grid-cols-3 sm:grid-rows-4">
                            {facilities.map(({ name, icon: Icon }) => (
                              <li key={name} className="flex items-center gap-2 text-[11px] text-[#3f3f46]">
                                <Icon className="size-3.5 shrink-0 text-[#6b6b6b]" />
                                {name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <InfoCard title="Detail Property">
                        <dl className="space-y-2 text-[11px]">
                          {[
                            ["Code:", project.code],
                            ["Status:", statusOf(project.isActive)],
                            ["Total Units:", String(projectMetrics(project.unitSummary).units)],
                          ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between gap-2">
                              <dt className="text-[#6b6b6b]">{label}</dt>
                              <dd className="font-medium text-[#1f1f1f]">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </InfoCard>
                      <InfoCard title="Location Detail">
                        <p className="flex items-start gap-2 text-[11px] leading-4 text-[#6b6b6b]">
                          <MapPin className="mt-0.5 size-3.5 shrink-0" />
                          {fullAddress(project) || "Alamat belum diisi."}
                        </p>
                        <div className="mt-3 flex h-24 items-center justify-center rounded-md bg-gradient-to-br from-[#E3F0E5] to-[#EEF3F7]">
                          <MapPin className="size-5 text-[#1980C0]" />
                        </div>
                      </InfoCard>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="unit-distribution">
                  <UnitDistribution />
                </TabsContent>

                {TABS.filter((t) => t.value !== "overview" && t.value !== "unit-distribution").map(({ value, label }) => (
                  <TabsContent key={value} value={value}>
                    <div className="rounded-xl border border-dashed border-[#E4E4E7] py-16 text-center text-sm text-[#6b6b6b]">
                      {label} belum tersedia.
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

