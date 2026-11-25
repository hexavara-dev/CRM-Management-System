"use client";

import { useState } from "react";
import { Images, Search } from "lucide-react";
import { PhotoGalleryDialog, type GalleryPhoto } from "@/components/projects/photo-gallery-dialog";
import { SimplePagination } from "@/components/availability/simple-pagination";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage, type ProjectDetail, type UnitPhotos, useUnitPhotos } from "@/hooks/use-projects";
import { typePhotos, typeVariantPhotos, type Photo } from "@/lib/photos";
import { cn } from "@/lib/utils";

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";

type Section = { key: string; title: string; photos: GalleryPhoto[] };

const labeled = (photos: Photo[], label: string): GalleryPhoto[] =>
  photos.map(({ key, url }) => ({ key, url, label }));

const PHOTOS_PER_SECTION = 10;
const UNITS_PER_PAGE = 20;
const UNIT_FILTER = "units";

/** Foto proyek dan foto tiap tipe beserta variannya. */
function mediaSections(project: ProjectDetail): Section[] {
  const images = project.media.filter((media) => media.mediaType === "IMAGE");
  const toPhotos = (items: typeof images): Photo[] => items.map(({ id, fileUrl }) => ({ key: id, url: fileUrl }));
  return [
    {
      key: "project",
      title: "Foto Proyek",
      photos: labeled(toPhotos(images.filter((media) => !media.variantId)), "Foto proyek"),
    },
    ...project.variants.map((type) => ({
      key: type.id,
      title: type.name,
      photos: [
        ...labeled(typePhotos(images, type.id), `${type.name} · Foto tipe`),
        ...type.typeVariants.flatMap((variant) =>
          labeled(typeVariantPhotos(images, variant.id), `${type.name} · Varian ${variant.name}`),
        ),
      ],
    })),
  ].filter((section) => section.photos.length > 0);
}

function PhotoTile({ url, label, caption, count = 1, onClick }: { url: string; label: string; caption: React.ReactNode; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-xl border border-[#E4E4E7] bg-white text-left outline-none transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#1980C0]"
    >
      <span className="relative block aspect-[4/3] overflow-hidden bg-[#F4F4F5]">
        <img src={url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-200 group-hover:scale-105" />
        {count > 1 && (
          <span className="absolute bottom-2 right-2 rounded bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white">{count} foto</span>
        )}
      </span>
      <span className="block px-3 py-2 text-xs text-[#475467]">{caption}</span>
    </button>
  );
}

function PhotoSection({ section, onOpen }: { section: Section; onOpen: (key: string) => void }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(section.photos.length / PHOTOS_PER_SECTION));
  const current = Math.min(page, pages);
  const start = (current - 1) * PHOTOS_PER_SECTION;
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-[#1f1f1f]">{section.title}</h3>
      <div className={GRID}>
        {section.photos.slice(start, start + PHOTOS_PER_SECTION).map((photo, index) => (
          <PhotoTile
            key={photo.key}
            url={photo.url}
            label={`Lihat ${photo.label ?? section.title} ${start + index + 1}`}
            // Untuk tipe, cukup bagian setelah nama tipe: "Foto tipe" atau "Varian Premium".
            caption={photo.label?.split(" · ").at(-1)}
            onClick={() => onOpen(photo.key)}
          />
        ))}
      </div>
      {pages > 1 && (
        <SimplePagination page={current} pageSize={PHOTOS_PER_SECTION} total={section.photos.length} itemLabel="foto" onPageChange={setPage} />
      )}
    </section>
  );
}

/** Satu kartu per unit; dimuat per halaman karena foto unit bisa ribuan. */
function UnitPhotoSection({ project }: { project: ProjectDetail }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<string>();
  const [openUnit, setOpenUnit] = useState<UnitPhotos | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const [kind, scopeId] = scope?.split(":") ?? [];
  const query = useUnitPhotos(project.id, {
    page,
    limit: UNITS_PER_PAGE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(kind === "type" ? { variantId: scopeId } : kind === "variant" ? { typeVariantId: scopeId } : {}),
  });
  const units = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-[#1f1f1f]">Foto Unit</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchableSelect
            className="sm:w-56"
            triggerClassName="h-9 text-sm"
            value={scope}
            onChange={(value) => {
              setScope(value);
              setPage(1);
            }}
            placeholder="Semua tipe dan varian"
            options={project.variants.flatMap((type) => [
              { value: `type:${type.id}`, label: type.name },
              ...type.typeVariants.map((variant) => ({ value: `variant:${variant.id}`, label: `${type.name} · ${variant.name}` })),
            ])}
          />
          <span className="relative block sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]" />
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Cari nomor unit"
              aria-label="Cari nomor unit"
              className="h-9 pl-9 text-sm"
            />
          </span>
        </div>
      </div>

      {query.isPending ? (
        <div className={GRID}>
          {Array.from({ length: 10 }, (_, index) => <Skeleton key={index} className="h-44 rounded-xl" />)}
        </div>
      ) : query.isError ? (
        <p role="alert" className="py-12 text-center text-sm text-[#D64545]">{errorMessage(query.error, "Gagal memuat foto unit.")}</p>
      ) : units.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#E4E4E7] py-12 text-center text-sm text-[#6b6b6b]">
          {debouncedSearch || scope ? "Tidak ada foto unit yang cocok." : "Belum ada unit yang punya foto sendiri."}
        </p>
      ) : (
        <>
          <div className={cn(GRID, query.isPlaceholderData && "opacity-60")}>
            {units.map((unit) => (
              <PhotoTile
                key={unit.id}
                url={unit.photos[0].fileUrl}
                label={`Lihat foto unit ${unit.code}`}
                count={unit.photos.length}
                caption={
                  <>
                    <span className="block font-semibold text-[#1f1f1f]">{unit.code}</span>
                    {unit.type} · {unit.variant}
                  </>
                }
                onClick={() => setOpenUnit(unit)}
              />
            ))}
          </div>
          <SimplePagination page={page} pageSize={UNITS_PER_PAGE} total={total} itemLabel="unit" onPageChange={setPage} />
        </>
      )}

      {openUnit && (
        <PhotoGalleryDialog
          title={`Unit ${openUnit.code}`}
          photos={openUnit.photos.map(({ id, fileUrl }) => ({ key: id, url: fileUrl, label: `${openUnit.type} · ${openUnit.variant}` }))}
          onClose={() => setOpenUnit(null)}
        />
      )}
    </section>
  );
}

export function MediaTab({ project }: { project: ProjectDetail }) {
  const sections = mediaSections(project);
  const photos = sections.flatMap((section) => section.photos);
  const [filter, setFilter] = useState("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const unitTotal = useUnitPhotos(project.id, { page: 1, limit: UNITS_PER_PAGE }).data?.meta.total;
  const unitsOnly = filter === UNIT_FILTER || photos.length === 0;
  const visible = sections.some((section) => section.key === filter)
    ? sections.filter((section) => section.key === filter)
    : sections;
  const gallery = visible.flatMap((section) => section.photos);
  const openIndex = gallery.findIndex((photo) => photo.key === openKey);

  if (photos.length === 0 && unitTotal === 0) {
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
          ...(photos.length ? [{ key: "all", title: "Semua", count: photos.length }] : []),
          ...sections.map(({ key, title, photos: items }) => ({ key, title, count: items.length })),
          { key: UNIT_FILTER, title: "Foto Unit", count: unitTotal },
        ].map((section) => {
          const active = section.key === "all" ? !unitsOnly && visible === sections : section.key === UNIT_FILTER ? unitsOnly : section.key === filter;
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
              {section.title}
              {section.count !== undefined && ` (${section.count.toLocaleString("id-ID")}${section.key === UNIT_FILTER ? " unit" : ""})`}
            </button>
          );
        })}
      </div>

      {unitsOnly ? (
        <UnitPhotoSection project={project} />
      ) : (
        <>
          {visible.map((section) => (
            <PhotoSection key={section.key} section={section} onOpen={setOpenKey} />
          ))}
          {visible === sections && !!unitTotal && (
            <button type="button" onClick={() => setFilter(UNIT_FILTER)} className="cursor-pointer text-sm font-medium text-[#1980C0] hover:underline">
              Lihat foto unit ({unitTotal.toLocaleString("id-ID")} unit)
            </button>
          )}
        </>
      )}

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
