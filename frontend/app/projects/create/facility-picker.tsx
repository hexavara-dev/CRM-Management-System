"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { FacilityIcon } from "@/components/projects/facility-icon";
import { useProjectFacilities } from "@/hooks/use-projects";

export function FacilityPicker({
  selected,
  saved = [],
  onChange,
}: {
  selected: string[];
  /** Fasilitas yang sudah tersimpan di proyek; tetap tampil walau sudah dinonaktifkan. */
  saved?: string[];
  onChange: (ids: string[]) => void;
}) {
  const { user } = useAuth();
  const query = useProjectFacilities();
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Memuat fasilitas...</p>;
  if (query.isError) return <p role="alert" className="text-sm text-destructive">Gagal memuat pilihan fasilitas.</p>;
  const options = query.data?.filter((item) => item.isActive || selected.includes(item.id) || saved.includes(item.id)) ?? [];
  if (!options.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada pilihan fasilitas.
        {user?.role === "owner" && (
          <>
            {" "}
            <Link href="/product-configuration/facilities" target="_blank" className="font-medium text-[#1980C0] hover:underline">
              Atur fasilitas
            </Link>
          </>
        )}
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((item) => (
        <label key={item.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-[#D9D9DE] px-3.5 py-2 text-sm text-[#1f1f1f] transition hover:border-[#1980C0] has-[:checked]:border-[#1980C0] has-[:checked]:bg-[#F6FAFD]">
          <input
            type="checkbox"
            className="size-4 shrink-0 cursor-pointer accent-[#1980C0]"
            checked={selected.includes(item.id)}
            onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
          />
          <FacilityIcon iconKey={item.iconKey} className="size-5 shrink-0 text-[#1980C0]" />
          <span className="min-w-0 flex-1 break-words">{item.name}</span>
          {!item.isActive && (
            <span className="shrink-0 rounded-md bg-[#F3F4F6] px-2 py-1 text-xs font-medium text-[#6b6b6b]">Nonaktif</span>
          )}
        </label>
      ))}
    </div>
  );
}
