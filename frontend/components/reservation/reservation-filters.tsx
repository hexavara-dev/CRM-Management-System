import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import type {
  ReservationFilterOptions,
  ReservationFilterStatus,
  ReservationFiltersState,
  ReservationPeriod,
} from "./reservation-types";

type ReservationFiltersProps = {
  filters: ReservationFiltersState;
  options: ReservationFilterOptions;
  onChange: (filters: Partial<ReservationFiltersState>) => void;
};

type FilterSelectProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-slate-700">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="h-9 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            <SelectItem value="all">Semua</SelectItem>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}

export function ReservationFilters({
  filters,
  options,
  onChange,
}: ReservationFiltersProps) {
  return (
    <div className="grid gap-3 border-b border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-[minmax(250px,1.6fr)_repeat(5,minmax(120px,1fr))]">
      <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-slate-700">
        Pencarian
        <span className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-500" />
          <Input
            type="search"
            name="reservation-search"
            autoComplete="off"
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Cari nomor unit, nama pemesan, atau sales..."
            className="h-9 bg-white pl-9 text-xs"
          />
        </span>
      </label>

      <FilterSelect
        label="Project"
        value={filters.project}
        options={options.projects}
        onChange={(project) => onChange({ project })}
      />
      <FilterSelect
        label="Cluster"
        value={filters.cluster}
        options={options.clusters}
        onChange={(cluster) => onChange({ cluster })}
      />
      <FilterSelect
        label="Blok"
        value={filters.block}
        options={options.blocks}
        onChange={(block) => onChange({ block })}
      />
      <FilterSelect
        label="Status"
        value={filters.status}
        options={["Aktif", "Menunggu Pembayaran", "Kedaluwarsa"]}
        onChange={(status) =>
          onChange({ status: status as ReservationFilterStatus | "all" })
        }
      />
      <FilterSelect
        label="Periode Reservasi"
        value={filters.period}
        options={["Hari ini", "Minggu ini", "Bulan ini"]}
        onChange={(period) =>
          onChange({ period: period as ReservationPeriod | "all" })
        }
      />
    </div>
  );
}
