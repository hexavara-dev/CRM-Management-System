"use client";

import { FacilityIcon } from "@/components/projects/facility-icon";
import { useProjectFacilities } from "@/hooks/use-projects";

export function FacilityPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const query = useProjectFacilities();
  if (query.isLoading) return <p className="text-xs text-muted-foreground">Memuat fasilitas...</p>;
  if (query.isError) return <p role="alert" className="text-xs text-destructive">Gagal memuat pilihan fasilitas.</p>;
  if (!query.data?.length) return <p className="text-xs text-muted-foreground">Belum ada fasilitas dalam katalog atribut. Jalankan seeder terlebih dahulu.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {query.data.map((item) => (
        <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs">
          <input
            type="checkbox"
            checked={selected.includes(item.id)}
            onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
          />
          <FacilityIcon iconKey={item.iconKey} className="size-4 shrink-0" />
          {item.name}
        </label>
      ))}
    </div>
  );
}
