"use client";

import { useId, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { ImageProcessingOverlay } from "@/app/projects/create/image-processing-overlay";
import { compressImage, PHOTO_MAX_EDGE } from "@/lib/compress-image";
import { MAX_TYPE_PHOTOS, type Photo } from "@/lib/photos";
import { cn } from "@/lib/utils";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

/** Beberapa foto dengan satu foto utama; foto disimpan utuh dan dikompres. */
export function PhotoPicker({
  label,
  photos,
  onChange,
}: {
  label: string;
  photos: Photo[];
  onChange: (update: (photos: Photo[]) => Photo[]) => void;
}) {
  const inputId = useId();
  const [processing, setProcessing] = useState(false);
  const remaining = Math.max(0, MAX_TYPE_PHOTOS - photos.length);

  const add = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []);
    input.value = "";
    const valid = files.filter((file) => ACCEPT.includes(file.type) && file.size <= MAX_BYTES);
    if (valid.length < files.length) toast.error("Gunakan JPEG, PNG, atau WebP maksimal 10 MB per foto.");
    if (valid.length > remaining) toast.error(`Maksimal ${MAX_TYPE_PHOTOS} foto. Hanya ${remaining} foto yang ditambahkan.`);
    const accepted = valid.slice(0, remaining);
    if (accepted.length === 0) return;
    setProcessing(true);
    const results = await Promise.allSettled(accepted.map((file) => compressImage(file, PHOTO_MAX_EDGE)));
    const added = results.flatMap((result): Photo[] =>
      result.status === "fulfilled"
        ? [{ key: crypto.randomUUID(), url: URL.createObjectURL(result.value), file: result.value }]
        : [],
    );
    if (added.length < accepted.length) toast.error("Sebagian foto tidak dapat diproses. Pilih berkas lain.");
    if (added.length) onChange((current) => [...current, ...added]);
    setProcessing(false);
  };

  return (
    <div>
      <p className="mb-2 flex items-center justify-between gap-2 text-sm font-medium text-[#1f1f1f]">
        <span>{label} (opsional)</span>
        <span className={cn("text-xs font-normal", photos.length > MAX_TYPE_PHOTOS ? "text-[#D64545]" : "text-[#667085]")}>
          {photos.length}/{MAX_TYPE_PHOTOS}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <div key={photo.key} className="group relative size-20 overflow-hidden rounded-lg border border-[#E4E4E7] bg-[#F6F7F9]">
            <img src={photo.url} alt={`${label} ${index + 1}`} className="size-full object-cover" />
            {index === 0 ? (
              <span className="absolute left-1 top-1 rounded bg-[#1980C0] px-1.5 py-0.5 text-[10px] font-medium text-white">Utama</span>
            ) : (
              <button
                type="button"
                onClick={() => onChange((current) => [photo, ...current.filter((item) => item.key !== photo.key)])}
                className="absolute inset-x-1 bottom-1 cursor-pointer rounded bg-white/95 py-0.5 text-[10px] font-medium text-[#1f1f1f] opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
              >
                Jadikan utama
              </button>
            )}
            <button
              type="button"
              aria-label={`Hapus ${label.toLowerCase()} ${index + 1}`}
              onClick={() => onChange((current) => current.filter((item) => item.key !== photo.key))}
              className="absolute right-1 top-1 grid size-5 cursor-pointer place-items-center rounded-full border border-[#E4E4E7] bg-white text-[#475467] hover:text-[#D64545]"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <label
            htmlFor={inputId}
            className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#8FC9E8] bg-[#E8F3FA] text-[11px] font-medium text-[#1980C0] transition hover:bg-[#D9EEF9] focus-within:ring-2 focus-within:ring-[#1980C0]/40"
          >
            <ImagePlus className="size-5" />
            Tambah foto
            <input
              id={inputId}
              type="file"
              accept={ACCEPT.join(",")}
              multiple
              className="sr-only"
              onChange={(event) => void add(event.target)}
            />
          </label>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-[#667085]">JPEG, PNG, atau WebP; maksimal 10 MB per foto.</p>
      {processing && <ImageProcessingOverlay />}
    </div>
  );
}
