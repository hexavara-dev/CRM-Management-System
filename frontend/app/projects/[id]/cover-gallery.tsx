"use client";

import { useState } from "react";
import Image from "next/image";
import type { ProjectDetail } from "@/hooks/use-projects";
import { NoImagePlaceholder } from "@/components/projects/no-image-placeholder";
import { PhotoGalleryDialog } from "@/components/projects/photo-gallery-dialog";

export function CoverGallery({ project }: { project: ProjectDetail }) {
  // Hanya gambar level proyek; gambar tipe unit (variantId) / unit (unitId) bukan cover proyek.
  const images = project.media.filter(
    (media) => media.mediaType === "IMAGE" && !media.variantId && !media.unitId,
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [main, ...rest] = images;
  const hiddenCount = Math.max(0, images.length - 3);

  const showImage = (index: number) => {
    if (images[index]) setOpenIndex(index);
  };

  return (
    <>
      <div className="grid aspect-[10/3] w-full grid-cols-[1fr_15%] gap-1.5">
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
                  <span className="absolute inset-0 grid place-items-center bg-black/55 text-center text-xs font-semibold text-white md:text-base">
                    +{hiddenCount} lainnya
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {openIndex !== null && (
        <PhotoGalleryDialog
          title="Semua Foto"
          photos={images.map(({ id, fileUrl }) => ({ key: id, url: fileUrl }))}
          initialIndex={openIndex}
          initialRatio={openIndex === 0 ? 10 / 3 : 1}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
