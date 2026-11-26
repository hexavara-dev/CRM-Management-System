"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string; hint?: string };

/**
 * Dropdown yang bisa diketik untuk mencari opsi (gaya Select2).
 * - Mode filter (bawaan): opsi teratas berisi placeholder untuk mengosongkan pilihan,
 *   dan tombol X muncul setelah ada pilihan.
 * - Mode form (`clearable={false}`): hanya opsi yang ada, tanpa opsi kosong.
 */
export function SearchableSelect({
  value,
  onChange,
  placeholder,
  options,
  disabled,
  disabledHint,
  loading,
  clearable = true,
  id,
  invalid,
  className,
  triggerClassName,
  searchPlaceholder = "Ketik untuk mencari...",
  icon: Icon,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder: string;
  options: ComboOption[];
  disabled?: boolean;
  /** Ditampilkan sebagai teks tombol saat dropdown nonaktif. */
  disabledHint?: string;
  loading?: boolean;
  /** false untuk field form yang wajib memilih salah satu opsi. */
  clearable?: boolean;
  id?: string;
  invalid?: boolean;
  /** Kelas pembungkus (lebar/posisi di layout). */
  className?: string;
  /** Kelas tombol pemicu (tinggi/ukuran teks). */
  triggerClassName?: string;
  searchPlaceholder?: string;
  /** Ikon di kiri teks tombol. */
  icon?: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);
  const showClear = clearable && selected && !disabled;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) => option.label.toLowerCase().includes(q) || option.hint?.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <div className={cn("relative min-w-0", className)}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            id={id}
            type="button"
            disabled={disabled}
            aria-label={placeholder}
            aria-invalid={invalid || undefined}
            className={cn(
              "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
              !selected && "text-muted-foreground",
              showClear && "pr-14",
              triggerClassName,
            )}
          >
            {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-[#6b6b6b]" />}
            <span className={cn("truncate", Icon && "flex-1 text-left")}>{disabled && disabledHint ? disabledHint : (selected?.label ?? placeholder)}</span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        {showClear && (
          <button
            type="button"
            aria-label={`Hapus pilihan ${placeholder}`}
            onClick={() => onChange(undefined)}
            className="absolute top-1/2 right-7 -translate-y-1/2 rounded p-0.5 text-[#6b6b6b] hover:bg-[#F3F3F3]"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent
        align="start"
        // Di dalam dialog, popover dirender di konten dialog agar tetap bisa diklik dan di-scroll.
        portalContainer={triggerRef.current?.closest<HTMLElement>("[data-slot='dialog-content']") ?? undefined}
        className="z-[999] w-[max(var(--radix-popover-trigger-width),14rem)] p-2"
      >
        <Input
          autoFocus
          value={query}
          placeholder={searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 text-xs"
        />
        <div className="mt-2 max-h-60 overflow-y-auto overscroll-contain">
          {clearable && (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs text-[#6b6b6b] hover:bg-accent"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              {placeholder}
              {!value && <Check className="size-3.5" />}
            </button>
          )}
          {loading ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Memuat...</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {options.length === 0 ? "Tidak ada data" : "Tidak ada yang cocok"}
            </p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && <span className="block truncate text-[10px] text-[#6b6b6b]">{option.hint}</span>}
                </span>
                {option.value === value && <Check className="size-3.5 shrink-0 text-[#1980C0]" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
