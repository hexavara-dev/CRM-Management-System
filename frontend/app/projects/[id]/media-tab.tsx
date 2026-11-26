"use client";

import { useState } from "react";
import { Images } from "lucide-react";
import { PhotoGalleryDialog, type GalleryPhoto } from "@/components/projects/photo-gallery-dialog";
import { SimplePagination } from "@/components/availability/simple-pagination";
import type { ProjectDetail } from "@/hooks/use-projects";
import { typePhotos, typeVariantPhotos, type Photo } from "@/lib/photos";
import { cn } from "@/lib/utils";

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";

type PhotoGroup = { key: string; title?: string; photos: GalleryPhoto[] };
/** Satu filter: foto proyek, atau satu tipe dengan kelompok foto tipe dan tiap variannya. */
type Section = { key: string; title: string; groups: PhotoGroup[] };

const photosOf = (section: Section) => section.groups.flatMap((group) => group.photos);

const labeled = (photos: Photo[], label: string): GalleryPhoto[] =>
  photos.map(({ key, url }) => ({ key, url, label }));

const PHOTOS_PER_GROUP = 10;

/** Foto proyek dan foto tiap tipe beserta variannya. */
function mediaSections(project: ProjectDetail): Section[] {
  const images = project.media.filter((media) => media.mediaType === "IMAGE");
  const toPhotos = (items: typeof images): Photo[] => items.map(({ id, fileUrl }) => ({ key: id, url: fileUrl }));
  const sections: Section[] = [
    {
      key: "project",
      title: "Foto Proyek",
      groups: [{ key: "project", photos: labeled(toPhotos(images.filter((media) => !media.variantId && !media.unitId)), "Foto proyek") }],
    },
    ...project.variants.map((type) => ({
      key: type.id,
      title: type.name,
      groups: [
        { key: type.id, title: "Foto Tipe", photos: labeled(typePhotos(images, type.id), `${type.name} · Foto tipe`) },
        ...type.typeVariants.map((variant) => ({
          key: variant.id,
          title: `Varian ${variant.name}`,
          photos: labeled(typeVariantPhotos(images, variant.id), `${type.name} · Varian ${variant.name}`),
        })),
      ],
    })),
  ];
  return sections
    .map((section) => ({ ...section, groups: section.groups.filter((group) => group.photos.length > 0) }))
    .filter((section) => section.groups.length > 0);
}

function PhotoTile({ url, label, onClick }: { url: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] outline-none transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#1980C0]"
    >
      <img src={url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-105" />
    </button>
  );
}

function PhotoGroupGrid({ group, onOpen }: { group: PhotoGroup; onOpen: (key: string) => void }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(group.photos.length / PHOTOS_PER_GROUP));
  const current = Math.min(page, pages);
  const start = (current - 1) * PHOTOS_PER_GROUP;
  return (
    <div className="space-y-2">
      {group.title && (
        <h4 className="text-sm font-medium text-[#475467]">
          {group.title} ({group.photos.length})
        </h4>
      )}
      <div className={GRID}>
        {group.photos.slice(start, start + PHOTOS_PER_GROUP).map((photo, index) => (
          <PhotoTile
            key={photo.key}
            url={photo.url}
            label={`Lihat ${photo.label ?? "foto"} ${start + index + 1}`}
            onClick={() => onOpen(photo.key)}
          />
        ))}
      </div>
      {pages > 1 && (
        <SimplePagination page={current} pageSize={PHOTOS_PER_GROUP} total={group.photos.length} itemLabel="foto" onPageChange={setPage} />
      )}
    </div>
  );
}

function PhotoSection({ section, onOpen }: { section: Section; onOpen: (key: string) => void }) {
  return (
    <section className="space-y-4">
      <h3 className="text-base font-semibold text-[#1f1f1f]">{section.title}</h3>
      {section.groups.map((group) => (
        <PhotoGroupGrid key={group.key} group={group} onOpen={onOpen} />
      ))}
    </section>
  );
}

export function MediaTab({ project }: { project: ProjectDetail }) {
  const sections = mediaSections(project);
  const total = sections.flatMap(photosOf).length;
  const [filter, setFilter] = useState("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const visible = sections.some((section) => section.key === filter)
    ? sections.filter((section) => section.key === filter)
    : sections;
  const gallery = visible.flatMap(photosOf);
  const openIndex = gallery.findIndex((photo) => photo.key === openKey);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#E4E4E7] py-16 text-center text-sm text-[#6b6b6b]">
        <Images className="size-8 text-[#9CA3AF]" />
        Belum ada foto. Tambahkan lewat Ubah Proyek.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", title: "Semua", count: total },
          ...sections.map((section) => ({ key: section.key, title: section.title, count: photosOf(section).length })),
        ].map((section) => {
          const active = section.key === "all" ? visible === sections : section.key === filter;
          return (
            <button
              key={section.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(section.key)}
              className={cn(
                "h-9 cursor-pointer rounded-full border px-4 text-sm transition",
                active ? "border-[#1980C0] bg-[#E5F1FA] font-medium text-[#1980C0]" : "border-[#E4E4E7] text-[#475467] hover:bg-[#F4F4F5]",
              )}
            >
              {section.title} ({section.count.toLocaleString("id-ID")})
            </button>
          );
        })}
      </div>

      {visible.map((section) => (
        <PhotoSection key={section.key} section={section} onOpen={setOpenKey} />
      ))}

      {openIndex >= 0 && (
        <PhotoGalleryDialog
          title={project.name}
          photos={gallery}
          initialIndex={openIndex}
          onClose={() => setOpenKey(null)}
        />
      )}
    </div>
  );
}
