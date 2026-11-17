import Image from "next/image";
import type { ProjectDetail } from "@/hooks/use-projects";
import { NoImagePlaceholder } from "@/components/projects/no-image-placeholder";

export function CoverGallery({ project }: { project: ProjectDetail }) {
  // Hanya gambar level proyek; gambar tipe unit (variantId) / unit (unitId) bukan cover proyek.
  const images = project.media.filter((m) => m.mediaType === "IMAGE" && !m.variantId && !m.unitId);
  const [main, ...rest] = images;
  return (
    <div className="grid h-44 grid-cols-[1fr_28%] gap-1.5 sm:h-64 sm:grid-cols-[1fr_21%]">
      <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-[#F4F4F5]">
        {main ? (
          <Image src={main.fileUrl} alt={project.name} fill unoptimized className="object-contain" />
        ) : (
          <NoImagePlaceholder className="absolute inset-0" />
        )}
      </div>
      <div className="grid grid-rows-2 gap-1.5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="relative flex items-center justify-center overflow-hidden rounded-lg bg-[#F4F4F5]"
          >
            {rest[i] ? (
              <Image src={rest[i].fileUrl} alt={`${project.name} ${i + 2}`} fill unoptimized className="object-contain" />
            ) : (
              <NoImagePlaceholder compact className="absolute inset-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
