"use client";

import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { UnitDetail } from "./types";

export function UnitGallery({ unit }: { unit: UnitDetail }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (unit.images.length === 0) {
    return (
      <div className="flex h-[355px] items-center justify-center rounded-xl bg-gradient-to-br from-[#e8f4ff] via-[#f5f9fc] to-[#e9eef5]">
        <div className="text-center">
          <Building2 className="mx-auto size-12 text-[#2695ff]/45" />
          <p className="mt-3 text-xs font-medium text-[#667085]">
            Foto unit belum tersedia
          </p>
        </div>
      </div>
    );
  }

  const next = () =>
    setActiveIndex((current) =>
      current === unit.images.length - 1 ? 0 : current + 1,
    );
  const previous = () =>
    setActiveIndex((current) =>
      current === 0 ? unit.images.length - 1 : current - 1,
    );
  return (
    <div>
      <div className="group relative h-[285px] overflow-hidden rounded-xl bg-muted">
        <img
          src={unit.images[activeIndex]}
          alt={`Unit ${unit.number}`}
          className="h-full w-full object-cover"
        />
        <button
          type="button"
          onClick={previous}
          className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#344054] shadow-md transition hover:scale-105"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={next}
          className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#344054] shadow-md transition hover:scale-105"
        >
          <ChevronRight className="size-5" />
        </button>
        <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white">
          {activeIndex + 1} / {unit.images.length}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {unit.images.map((image, index) => (
          <button
            key={image}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`h-[62px] overflow-hidden rounded-lg border-2 transition ${activeIndex === index ? "border-[#1684ff]" : "border-transparent"}`}
          >
            <img
              src={image}
              alt={`Thumbnail ${index + 1}`}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
