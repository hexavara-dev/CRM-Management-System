"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { useState } from "react";

export const ALL_FILTER_VALUE = "all";

export type FilterOption = { value: string; label: string };

type FilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: FilterOption[];
  isLoading?: boolean;
  className?: string;
  ariaLabel: string;
};

/** Lebar filter dropdown: penuh di layar kecil; di ≥ sm mengecil/membesar bersama (maks 176px) supaya satu baris. */
const FILTER_WIDTH = "w-full sm:w-auto sm:min-w-0 sm:max-w-44 sm:flex-1 sm:basis-0";

function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
  isLoading,
  className,
  ariaLabel,
}: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn("h-9 bg-white text-xs", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_FILTER_VALUE}>{allLabel}</SelectItem>
        {isLoading ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Memuat...
          </div>
        ) : options.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Tidak ada data
          </div>
        ) : (
          options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
});
const SHORT_MONTH_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  month: "short",
});

export function formatMonthLabel(month: Date): string {
  return MONTH_FORMATTER.format(month);
}

function MonthPicker({
  month,
  onChange,
}: {
  month: Date;
  onChange: (month: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(month.getFullYear());

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setYear(month.getFullYear());
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Pilih bulan"
          className="h-10 min-w-40 justify-between bg-white font-medium capitalize"
        >
          <span className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            {formatMonthLabel(month)}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear((current) => current - 1)}
            aria-label="Tahun sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{year}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear((current) => current + 1)}
            aria-label="Tahun berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, index) => {
            const isSelected =
              year === month.getFullYear() && index === month.getMonth();
            return (
              <Button
                key={index}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "ghost"}
                className="capitalize"
                onClick={() => {
                  onChange(new Date(year, index, 1));
                  setOpen(false);
                }}
              >
                {SHORT_MONTH_FORMATTER.format(new Date(year, index, 1))}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ViewingsToolbarProps = {
  mode: "calendar" | "table";
  search: string;
  onSearchChange: (value: string) => void;
  month: Date;
  onMonthChange: (month: Date) => void;
  salesId: string;
  onSalesChange: (value: string) => void;
  projectId: string;
  onProjectChange: (value: string) => void;
  statusId: string;
  onStatusChange: (value: string) => void;
  salesOptions: FilterOption[];
  projectOptions: FilterOption[];
  statusOptions: FilterOption[];
  isSalesLoading?: boolean;
  isProjectLoading?: boolean;
  isStatusLoading?: boolean;
};

export function ViewingsToolbar({
  mode,
  search,
  onSearchChange,
  month,
  onMonthChange,
  salesId,
  onSalesChange,
  projectId,
  onProjectChange,
  statusId,
  onStatusChange,
  salesOptions,
  projectOptions,
  statusOptions,
  isSalesLoading,
  isProjectLoading,
  isStatusLoading,
}: ViewingsToolbarProps) {
  const isCalendar = mode === "calendar";

  const shiftMonth = (diff: number) =>
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + diff, 1));

  const goToToday = () => {
    const now = new Date();
    onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    // Filter di kiri dan kontrol bulan di kanan selalu satu baris; hanya filter kiri yang boleh wrap sendiri.
    <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
      {/* ≥ sm: filter berbagi lebar yang tersedia (mengecil bersama) agar tetap satu baris. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
      <div className="relative w-full sm:w-auto sm:min-w-0 sm:max-w-60 sm:flex-[1.3] sm:basis-0">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={
            isCalendar
              ? "Search customer, sales, atau lokasi..."
              : "Cari nama customer atau no. telepon..."
          }
          className="h-9 bg-white pl-9 text-xs"
          aria-label="Cari visit"
          maxLength={100}
        />
      </div>

      {!isCalendar ? (
        <MonthPicker month={month} onChange={onMonthChange} />
      ) : null}

      <FilterSelect
        ariaLabel="Filter sales"
        value={salesId}
        onChange={onSalesChange}
        allLabel="Semua Sales"
        options={salesOptions}
        isLoading={isSalesLoading}
        className={FILTER_WIDTH}
      />
      <FilterSelect
        ariaLabel="Filter project"
        value={projectId}
        onChange={onProjectChange}
        allLabel={isCalendar ? "Semua Project/Lokasi" : "Semua Project"}
        options={projectOptions}
        isLoading={isProjectLoading}
        className={FILTER_WIDTH}
      />
      <FilterSelect
        ariaLabel="Filter status"
        value={statusId}
        onChange={onStatusChange}
        allLabel={isCalendar ? "Status: Semua" : "Semua Status"}
        options={statusOptions}
        isLoading={isStatusLoading}
        className={FILTER_WIDTH}
      />
      </div>

      {isCalendar ? (
        <div className="flex shrink-0 items-center gap-2">

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 bg-white"
              onClick={() => shiftMonth(-1)}
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-28 text-center text-sm font-medium capitalize">
              {formatMonthLabel(month)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 bg-white"
              onClick={() => shiftMonth(1)}
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 bg-white text-xs"
              onClick={goToToday}
            >
              Today
            </Button>
        </div>
      ) : null}
    </div>
  );
}
