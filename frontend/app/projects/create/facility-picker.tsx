"use client";

import { FacilityIcon } from "@/components/projects/facility-icon";
import { useProjectFacilities } from "@/hooks/use-projects";

export function FacilityPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const query = useProjectFacilities();
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Memuat fasilitas...</p>;
  if (query.isError) return <p role="alert" className="text-sm text-destructive">Gagal memuat pilihan fasilitas.</p>;
  if (!query.data?.length) return <p className="text-sm text-muted-foreground">Belum ada pilihan fasilitas.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {query.data.map((item) => (
        <label key={item.id} className="flex h-12 cursor-pointer items-center gap-3 rounded-lg border border-[#D9D9DE] px-3.5 text-sm text-[#1f1f1f] transition hover:border-[#1980C0] has-[:checked]:border-[#1980C0] has-[:checked]:bg-[#F6FAFD]">
          <input
            type="checkbox"
            className="size-4 shrink-0 cursor-pointer accent-[#1980C0]"
            checked={selected.includes(item.id)}
            onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
          />
          <FacilityIcon iconKey={item.iconKey} className="size-5 shrink-0 text-[#1980C0]" />
          {item.name}
        </label>
      ))}
    </div>
  );
}
