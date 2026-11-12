"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseMapsInput } from "./parse-maps-link";

export function LocationPicker() {
  const [value, setValue] = useState("");
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
              href={preview.embedUrl.replace("&output=embed", "")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#1980C0] hover:underline"
            >
              Buka di Google Maps <ExternalLink className="size-3" />
            </a>
          </div>
        </>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-[#D9D9DE] px-6 text-center text-xs text-[#6b6b6b]">
          {error ?? "Di Google Maps: pilih lokasi, lalu salin URL dari address bar atau Bagikan → Sematkan peta → Salin HTML. Preview muncul di sini."}
        </div>
      )}

      <input type="hidden" name="mapsUrl" value={preview ? value.trim() : ""} />
      <input type="hidden" name="latitude" value={preview?.lat ?? ""} />
      <input type="hidden" name="longitude" value={preview?.lng ?? ""} />
    </div>
  );
}
