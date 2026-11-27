import { Grid2X2, List, Search } from "lucide-react";

import { Input } from "@/components/ui/input";

import type { BlockFilter, ClusterView } from "./types";

type ClusterToolbarProps = {
  block: BlockFilter;
  search: string;
  view: ClusterView;
  blocks: string[];
  /** false untuk menyembunyikan tab "Semua Blok". */
  showAll?: boolean;
  onBlockChange: (block: BlockFilter) => void;
  onSearchChange: (search: string) => void;
  onViewChange: (view: ClusterView) => void;
};

export function ClusterToolbar({
  block,
  search,
  view,
  blocks,
  showAll = true,
  onBlockChange,
  onSearchChange,
  onViewChange,
}: ClusterToolbarProps) {
  return (
    <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {[...(showAll ? ["all"] : []), ...blocks].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onBlockChange(value)}
            className={`min-h-10 max-w-full rounded-full px-5 py-2 text-left text-sm font-semibold whitespace-normal break-words transition ${
              block === value
                ? "bg-[#1684ff] text-white shadow-sm"
                : "border border-[#e1e5ea] bg-white text-[#344054] hover:bg-muted"
            }`}
          >
            {value === "all" ? "Semua Blok" : /^blok\s/i.test(value) ? value : `Blok ${value}`}
          </button>
        ))}
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
        <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#98a2b3]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search unit number..."
            className="h-10 rounded-full pl-10 text-sm shadow-none md:text-sm"
          />
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => onViewChange("grid")}
            className={`flex size-10 items-center justify-center rounded-xl border ${
              view === "grid"
                ? "border-[#1684ff] bg-[#eef7ff] text-[#1684ff]"
                : "border-[#dfe4ea] bg-white text-[#667085] hover:bg-muted"
            }`}
          >
            <Grid2X2 className="size-5" />
          </button>

          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => onViewChange("list")}
            className={`flex size-10 items-center justify-center rounded-xl border ${
              view === "list"
                ? "border-[#1684ff] bg-[#eef7ff] text-[#1684ff]"
                : "border-[#dfe4ea] bg-white text-[#667085] hover:bg-muted"
            }`}
          >
            <List className="size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
