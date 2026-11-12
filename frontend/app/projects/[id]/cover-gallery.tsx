import Image from "next/image";
import { Building2, Images } from "lucide-react";
import type { ProjectDetail } from "@/hooks/use-projects";

export function CoverGallery({ project }: { project: ProjectDetail }) {
  const images = project.media.filter((m) => m.mediaType === "IMAGE");
  const [main, ...rest] = images;
  return (
    <div className="grid h-44 grid-cols-[1fr_28%] gap-1.5 sm:h-64 sm:grid-cols-[1fr_21%]">
      <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#DCE9F2] to-[#F3F7FA]">
        {main ? (
          <Image src={main.fileUrl} alt={project.name} fill unoptimized className="object-cover" />
        ) : (
          <Building2 className="size-14 text-[#1980C0]/40" />
        )}
      </div>
      <div className="grid grid-rows-2 gap-1.5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="relative flex items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#E4EAEE] to-[#F6F8FA]"
          >
            {rest[i] ? (
              <Image src={rest[i].fileUrl} alt={`${project.name} ${i + 2}`} fill unoptimized className="object-cover" />
            ) : (
              <Images className="size-6 text-[#6b6b6b]/40" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
