"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Building2, ChevronRight, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatNumber } from "./format";
import { availabilityPath } from "./routes";
import { StatusCell } from "./status-cell";
import type { ProjectAvailability } from "./types";

export function AvailabilityTable({
  projects,
}: {
  projects: ProjectAvailability[];
}) {
  const [search, setSearch] = useState("");

  const filteredProjects = useMemo(() => {
    return projects.filter((project) =>
      project.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [projects, search]);

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-sm font-semibold">
          Availability by Project
        </CardTitle>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search project"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>
      </CardHeader>

      <CardContent>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-xs">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground">
                <th className="rounded-l-md px-3 py-3 font-medium">Project</th>
                <th className="px-3 py-3 text-center font-medium">
                  Total Units
                </th>
                <th className="px-3 py-3 text-center font-medium">Available</th>
                <th className="px-3 py-3 text-center font-medium">
                  Reservation / Processing
                </th>
                <th className="px-3 py-3 text-center font-medium">Reserved</th>
                <th className="px-3 py-3 text-center font-medium">Sold</th>
                <th className="rounded-r-md px-3 py-3 font-medium">
                  Availability
                </th>
                <th />
              </tr>
            </thead>

            <tbody>
              {filteredProjects.map((project) => {
                const percentage =
                  project.total > 0
                    ? (project.available / project.total) * 100
                    : 0;

                return (
                  <tr
                    key={project.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        {project.image ? (
                          <Image
                            src={project.image}
                            alt={project.name}
                            width={40}
                            height={40}
                            className="size-10 rounded-md border object-cover"
                          />
                        ) : (
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-gradient-to-br from-blue-50 to-slate-100">
                            <Building2 className="size-5 text-blue-400" />
                          </div>
                        )}

                        <div>
                          <p className="font-semibold">{project.name}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {project.location}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-center font-medium">
                      {formatNumber(project.total)}
                    </td>

                    <td className="px-3 py-3">
                      <StatusCell value={project.available} type="available" />
                    </td>

                    <td className="px-3 py-3">
                      <StatusCell
                        value={project.processing}
                        type="processing"
                      />
                    </td>

                    <td className="px-3 py-3">
                      <StatusCell value={project.reserved} type="reserved" />
                    </td>

                    <td className="px-3 py-3">
                      <StatusCell value={project.sold} type="sold" />
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-green-500"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>

                        <span className="font-medium">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <Link
                        href={availabilityPath(project.id)}
                        aria-label={`View ${project.name}`}
                        className="inline-flex rounded-md border p-1.5 hover:bg-muted"
                      >
                        <ChevronRight className="size-4 shrink-0 text-[#111827]" />
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filteredProjects.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          Showing 1–{filteredProjects.length} of {projects.length} projects
        </div>
      </CardContent>
    </Card>
  );
}
