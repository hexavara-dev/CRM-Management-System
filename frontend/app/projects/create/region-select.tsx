"use client";

import { } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const hasOptions = options.length > 0;
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-xs font-medium text-[#1f1f1f]">
        {label} <span className="text-[#D64545]">*</span>
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled || !hasOptions} required>
        <SelectTrigger aria-label={label} data-name={name} className="h-9 w-full text-xs">
          <SelectValue placeholder={disabled || !hasOptions ? emptyHint : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.c} value={o.c} className="text-xs">
              {o.n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={options.find((o) => o.c === value)?.n ?? ""} />
      <input type="hidden" name={`${name}Code`} value={value} />
    </div>
  );
}

/** Province → City/Regency → Subdistrict → Village, saling bergantung dan dimuat dari data resmi. */
