"use client";

import { useMemo, useState } from "react";
import { Code2, Crosshair, ExternalLink, Link2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { mapsLink, parseMapsInput } from "./parse-maps-link";

/** Format isian titik lokasi yang diterima parseMapsInput. */
const LOCATION_FORMATS = [
  {
    icon: Crosshair,
    title: "Koordinat",
    description: "Di Google Maps, klik kanan titik lokasi lalu klik angka koordinat paling atas untuk menyalinnya.",
    example: "-7.983908, 112.621391",
  },
  {
    icon: Link2,
    title: "Link Google Maps",
    description: "Pilih lokasi di Google Maps, lalu salin URL dari address bar browser.",
    example: "https://www.google.com/maps/place/...",
  },
  {
    icon: Code2,
    title: "Kode embed",
    description: "Di Google Maps: Bagikan → Sematkan peta → Salin HTML.",
    example: '<iframe src="https://www.google.com/maps/embed?...">',
  },
];

export function LocationPicker({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  const result = useMemo(() => parseMapsInput(value), [value]);
  const preview = result.ok ? result.preview : null;
  const error = !result.ok && value.trim() ? result.error : null;

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="Tempel link Google Maps, kode embed, atau koordinat (lat, lng)"
        aria-label="Link Google Maps"
        aria-invalid={!!error}
        className={cn(
          "w-full resize-none rounded-md border border-[#D9D9DE] p-3 text-xs text-[#1f1f1f] outline-none focus-visible:border-[#1980C0] focus-visible:ring-2 focus-visible:ring-[#1980C0]/20",
          error && "border-[#D64545]",
        )}
      />

      {preview ? (
        <>
          <iframe
            key={preview.embedUrl}
            src={preview.embedUrl}
            title="Preview lokasi proyek"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            // Tanpa allow-top-navigation: isi iframe tidak bisa membelokkan halaman CRM.
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="h-72 w-full rounded-lg border border-[#E4E4E7]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6b6b6b]">
            {preview.lat !== undefined && preview.lng !== undefined ? (
              <p className="font-mono text-[#1f1f1f]">
                {preview.lat.toFixed(6)}, {preview.lng.toFixed(6)}
              </p>
            ) : (
              <p>Koordinat tidak terbaca, tapi lokasi tetap ditampilkan.</p>
            )}
            <a
              href={mapsLink(preview)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#1980C0] hover:underline"
            >
              Buka di Google Maps <ExternalLink className="size-3" />
            </a>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-[#D9D9DE] bg-[#FAFBFC] p-4">
          {error ? (
            <p className="py-6 text-center text-xs text-[#D64545]">{error}</p>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-xs font-medium text-[#1f1f1f]">
                <MapPin className="size-3.5 text-[#1980C0]" />
                Isi dengan salah satu format berikut, preview peta akan muncul di sini.
              </p>
              <ul className="mt-3 divide-y divide-[#EDEDED] rounded-lg border border-[#E4E4E7] bg-white">
                {LOCATION_FORMATS.map(({ icon: Icon, title, description, example }) => (
                  <li key={title} className="flex items-start gap-3 px-3 py-2.5">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-[#E8F3FA] text-[#1980C0]">
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-semibold text-[#1f1f1f]">{title}</p>
                      <p className="mt-0.5 leading-4 text-[#667085]">{description}</p>
                    </div>
                    <code className="hidden max-w-[40%] shrink-0 truncate rounded bg-[#F4F5F7] px-2 py-1 font-mono text-[10px] text-[#344054] sm:block" title={example}>
                      {example}
                    </code>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Simpan URL Google Maps hasil normalisasi (bukan teks/HTML mentah yang ditempel user). */}
      <input type="hidden" name="mapsUrl" value={preview ? preview.embedUrl.replace("&output=embed", "") : ""} />
      <input type="hidden" name="latitude" value={preview?.lat ?? ""} />
      <input type="hidden" name="longitude" value={preview?.lng ?? ""} />
    </div>
  );
}
