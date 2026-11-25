import type { Prisma } from '@prisma/client';

/** Maksimal foto per tipe dan per varian. */
export const MAX_TYPE_IMAGES = 5;

export type StoredImage = { file: Express.Multer.File; path: string; url: string };
export type ImageOwner = { tenantId: string; productId: string; variantId: string; typeVariantId: string | null };

/**
 * Menyimpan foto satu tipe atau varian sesuai urutan akhir; yang pertama menjadi foto utama.
 * `order` berisi ID foto tersimpan dan "new:N" (foto baru ke-N). Foto tersimpan yang tidak disebut dihapus.
 * Tanpa `order`, foto baru ditambahkan di belakang.
 * Mengembalikan URL foto yang dihapus agar berkasnya dibersihkan setelah transaksi berhasil.
 */
export async function saveOwnerImages(
  tx: Prisma.TransactionClient,
  owner: ImageOwner,
  order: string[] | undefined,
  uploads: StoredImage[]
): Promise<string[]> {
  if (order === undefined && uploads.length === 0) return [];
  const existing = await tx.productMedia.findMany({
    where: { ...owner, unitId: null, mediaType: 'IMAGE' },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, fileUrl: true, sortOrder: true, isPrimary: true },
  });
  const uploadKeys = uploads.map((_, index) => `new:${index}`);
  const final = order ?? [...existing.map((media) => media.id), ...uploadKeys];
  const known = new Set([...existing.map((media) => media.id), ...uploadKeys]);
  if (new Set(final).size !== final.length || final.some((key) => !known.has(key)) || uploadKeys.some((key) => !final.includes(key))) {
    throw new Error('Invalid media order');
  }
  if (final.length > MAX_TYPE_IMAGES) {
    throw new Error(`Invalid photos: at most ${MAX_TYPE_IMAGES} photos are allowed per type or variant`);
  }

  const removed = existing.filter((media) => !final.includes(media.id));
  if (removed.length) {
    await tx.productMedia.deleteMany({ where: { ...owner, id: { in: removed.map((media) => media.id) } } });
  }
  for (const [sortOrder, key] of final.entries()) {
    const isPrimary = sortOrder === 0;
    const saved = existing.find((media) => media.id === key);
    if (saved) {
      if (saved.sortOrder !== sortOrder || saved.isPrimary !== isPrimary) {
        await tx.productMedia.update({ where: { id: saved.id }, data: { sortOrder, isPrimary } });
      }
      continue;
    }
    const { file, url } = uploads[uploadKeys.indexOf(key)] as StoredImage;
    await tx.productMedia.create({
      data: {
        ...owner, mediaType: 'IMAGE', fileName: file.originalname.slice(0, 255), fileUrl: url,
        fileType: file.mimetype, fileSize: file.buffer.length, sortOrder, isPrimary,
      },
    });
  }
  return removed.map((media) => media.fileUrl);
}
