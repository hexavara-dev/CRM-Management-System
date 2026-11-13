import { Grid2X2, List, Search } from "lucide-react";

import { Input } from "@/components/ui/input";

import type { BlockFilter, ClusterView } from "./types";

type ClusterToolbarProps = {
  block: BlockFilter;
  search: string;
  view: ClusterView;
  blocks: string[];
  onBlockChange: (block: BlockFilter) => void;
  onSearchChange: (search: string) => void;
  onViewChange: (view: ClusterView) => void;
};

export function ClusterToolbar({
  block,
  search,
  view,
  blocks,
  onBlockChange,
  onSearchChange,
  onViewChange,
}: ClusterToolbarProps) {
  return (
    <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center">
        {["all", ...blocks].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onBlockChange(value)}
            className={`h-8 rounded-full px-4 text-[10px] font-semibold transition ${
              block === value
                ? "bg-[#1684ff] text-white shadow-sm"
                : "border border-[#e1e5ea] bg-white text-[#344054] hover:bg-muted"
            }`}
          >
            {value === "all" ? "Semua Blok" : `Blok ${value}`}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full lg:w-[220px]">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#98a2b3]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search unit number..."
            className="h-8 rounded-full pl-9 text-[10px] shadow-none"
          />
        </div>

        <div className="flex overflow-hidden rounded-lg border border-[#dfe4ea]">
          <button
            type="button"
            aria-label="Grid view"
            onClick={() => onViewChange("grid")}
            className={`flex size-8 items-center justify-center ${
              view === "grid"
                ? "bg-[#eef7ff] text-[#1684ff]"
                : "bg-white text-[#667085]"
            }`}
          >
            <Grid2X2 className="size-4" />
          </button>

          <div className="border-l border-[#dfe4ea]" />

          <button
            type="button"
            aria-label="List view"
            onClick={() => onViewChange("list")}
            className={`flex size-8 items-center justify-center ${
              view === "list"
                ? "bg-[#eef7ff] text-[#1684ff]"
                : "bg-white text-[#667085]"
            }`}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
