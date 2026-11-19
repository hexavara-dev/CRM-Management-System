"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage, useProjects } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/projects/stat-card";
import { ProjectCard } from "./project-card";

const FILTERS = ["All", "Active", "Inactive"] as const;
const PAGE_SIZE = 8;

export default function ProjectsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(query.trim());

  const { data, isError, error, refetch, isFetching } = useProjects({
    page,
    limit: PAGE_SIZE,
    search,
    ...(filter === "All" ? {} : { isActive: filter === "Active" }),
  });

  const projects = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, data?.meta.totalPages ?? 1);
  const start = (page - 1) * PAGE_SIZE;

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3 empty:hidden">
          <SidebarOpenTrigger />
        </header>
        <div className="space-y-4 p-4">
          <PageHeading
            actions={
              <Button
                asChild
                className="h-9 rounded-lg bg-[#1980C0] px-4 text-white hover:bg-[#166ea6]"
              >
                <Link href="/projects/create">
                  <Plus className="size-4" />
                  Add Property
                </Link>
              </Button>
            }
          />

          <hr className="border-[#EDEDED]" />

          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Total Project"
              value={data?.summary.total ?? "—"}
              color="text-[#1f1f1f]"
            />
            <StatCard
              label="Active"
              value={data?.summary.active ?? "—"}
              color="text-[#1E9E55]"
            />
            <StatCard
              label="In Active"
              value={data?.summary.inactive ?? "—"}
              color="text-[#D64545]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <Button
                  key={f}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilter(f);
                    setPage(1);
                  }}
                  className={cn(
                    "h-8 rounded-lg px-3 text-xs",
                    filter === f &&
                      "border-[#1980C0] bg-[#E5F1FA] text-[#1980C0]",
                  )}
                >
                  {f}
                </Button>
              ))}
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]" />
              <Input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search"
                className="h-8 w-full pl-8 sm:w-56"
              />
            </div>
          </div>

          {isError ? (
            <div className="rounded-xl border border-[#FECACA] bg-[#FFF7F7] px-6 py-12 text-center">
              <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-[#FEE2E2] text-[#D64545]">
                  <AlertCircle className="size-5" />
                </span>
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-[#991B1B]">
                    Daftar proyek belum dapat dimuat
                  </h2>
                  <p className="text-xs leading-5 text-[#7F1D1D]">
                    {errorMessage(
                      error,
                      "Terjadi masalah saat memuat data proyek.",
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="mt-1 border-[#D64545] text-[#991B1B] hover:bg-[#FEE2E2] hover:text-[#991B1B]"
                >
                  <RefreshCw
                    className={cn("size-3.5", isFetching && "animate-spin")}
                  />
                  {isFetching ? "Mencoba..." : "Coba lagi"}
                </Button>
              </div>
            </div>
          ) : !data ? (
            <div className="rounded-xl border border-dashed border-[#E4E4E7] py-16 text-center text-sm text-[#6b6b6b]">
              Memuat daftar proyek...
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E4E4E7] py-16 text-center text-sm text-[#6b6b6b]">
              {data.summary.total === 0
                ? "Belum ada proyek. Klik Add Property untuk membuat proyek pertama."
                : "Tidak ada proyek yang cocok dengan pencarian atau filter."}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}

          {data && !isError && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#6b6b6b]">
              <p>
                Showing {start + 1} - {start + projects.length} of {total}{" "}
                properties.
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (n) => (
                    <Button
                      key={n}
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setPage(n)}
                      className={cn(
                        n === page &&
                          "border-[#1980C0] bg-[#1980C0] text-white hover:bg-[#166ea6] hover:text-white",
                      )}
                    >
                      {n}
                    </Button>
                  ),
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next page"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
