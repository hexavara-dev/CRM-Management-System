"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** `label`: asal foto (mis. "Varian Premium"); pergantian label diberi jarak di baris thumbnail. */
export type GalleryPhoto = { key: string; url: string; label?: string };

/** Galeri foto: bingkai mengikuti rasio foto dan satu baris thumbnail. */
export function PhotoGalleryDialog({
  title,
  photos,
  initialIndex = 0,
  initialRatio = 1,
  onClose,
}: {
  title: string;
  photos: GalleryPhoto[];
  initialIndex?: number;
  /** Rasio sebelum foto dimuat. */
  initialRatio?: number;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(initialIndex);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const count = photos.length;
  const index = Math.min(selected, count - 1);
  const active = photos[index];

  useEffect(() => {
    if (count < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (step) setSelected((current) => (Math.min(current, count - 1) + step + count) % count);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count]);

  if (!active) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-[calc(100%-1rem)] flex-col gap-3 overflow-hidden bg-white p-4 text-[#1f1f1f] sm:max-w-5xl">
        <div className="flex flex-wrap items-baseline gap-x-2 pr-10">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-xs text-[#6b6b6b]">
            {active.label ? `${active.label} ` : ""}({index + 1}/{count})
          </DialogDescription>
        </div>

        {/* Tinggi bingkai mengikuti rasio foto; sisa ruang di samping diisi foto yang sama (blur). */}
        <div
          className="relative isolate max-h-[68vh] min-h-40 w-full shrink overflow-hidden rounded-lg bg-[#F4F4F5]"
          style={{ aspectRatio: ratios[active.key] ?? initialRatio }}
        >
          <img src={active.url} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl" />
          <img
            key={active.key}
            src={active.url}
            alt={`${title} ${index + 1}`}
            className="absolute inset-0 size-full object-contain"
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth && naturalHeight)
                setRatios((current) => ({ ...current, [active.key]: naturalWidth / naturalHeight }));
            }}
          />
          {count > 1 &&
            ([
              { label: "Foto sebelumnya", step: -1, side: "left-3", Icon: ChevronLeft },
              { label: "Foto berikutnya", step: 1, side: "right-3", Icon: ChevronRight },
            ] as const).map(({ label, step, side, Icon }) => (
              <Button
                key={label}
                type="button"
                variant="outline"
                size="icon"
                aria-label={label}
                onClick={() => setSelected((index + step + count) % count)}
                className={cn(
                  "absolute inset-y-0 z-10 my-auto rounded-full border-[#E4E4E7] bg-white text-[#1f1f1f] shadow-md hover:bg-[#F4F4F5]",
                  side,
                )}
              >
                <Icon />
              </Button>
            ))}
        </div>

        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
          {photos.map((photo, photoIndex) => {
            const newGroup = photoIndex > 0 && photos[photoIndex - 1]?.label !== photo.label;
            return (
              <button
                key={photo.key}
                type="button"
                title={photo.label}
                aria-label={`Tampilkan foto ${photoIndex + 1}${photo.label ? `, ${photo.label}` : ""}`}
                aria-current={photoIndex === index}
                onClick={() => setSelected(photoIndex)}
                className={cn(
                  "size-16 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 bg-[#F4F4F5]",
                  photoIndex === index ? "border-[#1980C0]" : "border-transparent opacity-65 hover:opacity-100",
                  newGroup && "ml-4",
                )}
              >
                <img src={photo.url} alt="" className="size-full object-cover" />
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
