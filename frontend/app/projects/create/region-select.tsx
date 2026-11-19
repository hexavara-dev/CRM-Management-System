"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Data resmi kode wilayah Kemendagri (sumber: github.com/cahyadsn/wilayah), disajikan dari public/data.
type Item = { c: string; n: string };
type Village = Item;
type District = Item & { v: Village[] };
type Regency = Item & { d: District[] };
export type Province = Item & { r: Regency[] };

let regionsPromise: Promise<Province[]> | null = null;

export function loadRegions(): Promise<Province[]> {
  if (!regionsPromise) {
    regionsPromise = fetch("/data/wilayah.json").then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Province[]>;
    });
    // Jika gagal, izinkan percobaan ulang pada render berikutnya.
    regionsPromise.catch(() => {
      regionsPromise = null;
    });
  }
  return regionsPromise;
}

export function RegionSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  emptyHint,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (code: string) => void;
  options: Item[];
  placeholder: string;
  emptyHint: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasOptions = options.length > 0;
  const selectedName = options.find((option) => option.c === value)?.n;
  const hint = disabled || !hasOptions ? emptyHint : placeholder;
  const matches = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase("id-ID");
    return query
      ? options.filter((option) => option.n.toLocaleLowerCase("id-ID").includes(query))
      : options;
  }, [options, deferredSearch]);
  const visibleOptions = matches.slice(0, 60);
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-xs font-medium text-[#1f1f1f]">
        {label} <span className="text-[#D64545]">*</span>
      </label>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button ref={triggerRef} type="button" role="combobox" aria-label={label} aria-expanded={open} data-name={name} disabled={disabled || !hasOptions} className="flex h-9 w-full cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50">
            <span className={selectedName ? "truncate" : "truncate text-muted-foreground"}>{selectedName ?? hint}</span>
            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" portalContainer={triggerRef.current?.closest<HTMLElement>("[data-slot='dialog-content']") ?? undefined} className="z-[999] w-[var(--radix-popover-trigger-width)] p-2">
          <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Cari ${label.toLowerCase()}...`} className="h-9 text-xs" />
          <div className="mt-2 max-h-56 overflow-y-auto overscroll-contain">
            {visibleOptions.map((option) => (
              <button key={option.c} type="button" onClick={() => { onChange(option.c); setOpen(false); }} className="flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent">
                <span className="truncate">{option.n}</span>
                {option.c === value && <Check className="size-3.5 shrink-0" />}
              </button>
            ))}
            {matches.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">Wilayah tidak ditemukan.</p>}
            {matches.length > visibleOptions.length && <p className="px-2 py-2 text-xs text-muted-foreground">Ketik nama wilayah untuk mempersempit hasil.</p>}
          </div>
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={options.find((o) => o.c === value)?.n ?? ""} />
      <input type="hidden" name={`${name}Code`} value={value} />
    </div>
  );
}

/** Province → City/Regency → Subdistrict → Village, saling bergantung dan dimuat dari data resmi. */
