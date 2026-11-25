/** Batas foto per tipe dan per varian, sama dengan validasi backend. */
export const MAX_TYPE_PHOTOS = 5;

/** Foto tersimpan (`id`) atau foto baru (`file`); yang pertama di daftar adalah foto utama. */
export type Photo = { key: string; url: string; id?: string; file?: File };

type SavedMedia = {
  id: string;
  fileUrl: string;
  mediaType: string;
  variantId: string | null;
  typeVariantId: string | null;
};

const toPhoto = ({ id, fileUrl }: SavedMedia): Photo => ({ key: id, id, url: fileUrl });

/** Foto tipe; foto varian juga menyimpan ID tipe sehingga harus disaring. */
export const typePhotos = (media: SavedMedia[], variantId: string): Photo[] =>
  media
    .filter((item) => item.mediaType === "IMAGE" && item.variantId === variantId && !item.typeVariantId)
    .map(toPhoto);

export const typeVariantPhotos = (media: SavedMedia[], typeVariantId: string): Photo[] =>
  media.filter((item) => item.mediaType === "IMAGE" && item.typeVariantId === typeVariantId).map(toPhoto);

export const newPhotoFiles = (photos: Photo[]): File[] =>
  photos.flatMap((photo) => (!photo.id && photo.file ? [photo.file] : []));

/** Urutan akhir untuk API: ID foto tersimpan atau "new:N" sesuai urutan newPhotoFiles. */
export function photoOrder(photos: Photo[]): string[] {
  let next = 0;
  return photos.flatMap((photo) => (photo.id ? [photo.id] : photo.file ? [`new:${next++}`] : []));
}
