import { PhotoGalleryDialog, type GalleryPhoto } from "@/components/projects/photo-gallery-dialog";
import type { ProjectTypeRow } from "@/hooks/use-project-types";

/** Foto tipe, lalu foto tiap varian yang memilikinya. */
export const typeGalleryPhotos = (type: ProjectTypeRow): GalleryPhoto[] => [
  ...type.photos.map(({ key, url }) => ({ key, url, label: "Foto tipe" })),
  ...type.typeVariants.flatMap((variant) =>
    variant.photos.map(({ key, url }) => ({ key, url, label: `Varian ${variant.name}` })),
  ),
];

export function TypeGallery({ type, onClose }: { type: ProjectTypeRow; onClose: () => void }) {
  return <PhotoGalleryDialog title={type.name} photos={typeGalleryPhotos(type)} onClose={onClose} />;
}
