"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProjectDetail } from "@/hooks/use-projects";
import { NoImagePlaceholder } from "@/components/projects/no-image-placeholder";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function CoverGallery({ project }: { project: ProjectDetail }) {
  // Hanya gambar level proyek; gambar tipe unit (variantId) / unit (unitId) bukan cover proyek.
  const images = project.media.filter(
    (media) => media.mediaType === "IMAGE" && !media.variantId && !media.unitId,
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [main, ...rest] = images;
  const hiddenCount = Math.max(0, images.length - 3);

  const showImage = (index: number) => {
    if (!images[index]) return;
    setActiveIndex(index);
    setOpen(true);
  };

  const move = (offset: number) => {
    setActiveIndex(
      (current) => (current + offset + images.length) % images.length,
    );
  };

  useEffect(() => {
    if (!open || images.length < 2) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, images.length]);

  return (
    <>
      <div className="grid aspect-[10/3] w-full grid-cols-[1fr_28%] gap-1.5 sm:grid-cols-[1fr_21%]">
        <button
          type="button"
          disabled={!main}
          onClick={() => showImage(0)}
          className="relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-[#F4F4F5] disabled:cursor-default"
          aria-label={
            main ? "Buka galeri foto proyek" : "Belum ada foto proyek"
          }
        >
          {main ? (
            <Image
              src={main.fileUrl}
              alt={project.name}
              fill
              unoptimized
              className="object-cover transition-transform duration-200 hover:scale-[1.01]"
            />
          ) : (
            <NoImagePlaceholder className="absolute inset-0" />
          )}
        </button>
        <div className="grid grid-rows-2 gap-1.5">
          {[0, 1].map((index) => {
            const image = rest[index];
            const imageIndex = index + 1;
            return (
              <button
                type="button"
                key={index}
                disabled={!image}
                onClick={() => showImage(imageIndex)}
                className="relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-[#F4F4F5] disabled:cursor-default"
                aria-label={
                  image ? `Buka foto ${imageIndex + 1}` : "Foto belum tersedia"
                }
              >
                {image ? (
                  <Image
                    src={image.fileUrl}
                    alt={`${project.name} ${imageIndex + 1}`}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-200 hover:scale-[1.02]"
                  />
                ) : (
                  <NoImagePlaceholder compact className="absolute inset-0" />
                )}
                {index === 1 && hiddenCount > 0 && (
                  <span className="absolute inset-0 grid place-items-center bg-black/55 text-xl font-semibold text-white">
                    +{hiddenCount} lainnya
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[min(92vh,820px)] max-w-[calc(100%-1rem)] flex-col gap-3 overflow-hidden bg-white p-4 text-[#1f1f1f] sm:max-w-5xl">
          <div className="flex items-baseline gap-2 pr-10">
            <DialogTitle>Semua Foto</DialogTitle>
            <DialogDescription className="text-xs text-[#6b6b6b]">
              {images.length > 0
                ? `(${activeIndex + 1}/${images.length})`
                : "(Belum ada foto)"}
            </DialogDescription>
          </div>

          <div className="relative isolate min-h-0 flex-1 overflow-hidden rounded-lg bg-[#F4F4F5]">
            {images[activeIndex] && (
              <Image
                src={images[activeIndex].fileUrl}
                alt={`${project.name} ${activeIndex + 1}`}
                fill
                unoptimized
                className="object-contain"
              />
            )}
            {images.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => move(-1)}
                  className="absolute inset-y-0 left-3 z-10 my-auto rounded-full border-[#E4E4E7] bg-white text-[#1f1f1f] shadow-md hover:bg-[#F4F4F5]"
                  aria-label="Foto sebelumnya"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => move(1)}
                  className="absolute inset-y-0 right-3 z-10 my-auto rounded-full border-[#E4E4E7] bg-white text-[#1f1f1f] shadow-md hover:bg-[#F4F4F5]"
                  aria-label="Foto berikutnya"
                >
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>

          <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => (
              <button
                type="button"
                key={image.id}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative h-16 w-24 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 bg-[#F4F4F5]",
                  index === activeIndex
                    ? "border-[#1980C0]"
                    : "border-transparent opacity-65 hover:opacity-100",
                )}
                aria-label={`Tampilkan foto ${index + 1}`}
                aria-current={index === activeIndex}
              >
                <Image
                  src={image.fileUrl}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
