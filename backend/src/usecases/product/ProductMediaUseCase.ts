import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { localStorage } from '../../infrastructure/storage/localStorage.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_TYPES = ['application/pdf'];

export type MediaMetaInput = {
  title?: string | null;
  variantId?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
};

export type MediaLinkInput = MediaMetaInput & { fileUrl?: string };

export class ProductMediaUseCase {
  constructor(
    private prisma: PrismaClient,
    private storage: typeof localStorage = localStorage
  ) {}

  private async assertProduct(productId: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!product) throw new Error('Product not found');
  }

  private async assertVariant(productId: string, variantId: string, tenantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, tenantId },
      select: { id: true },
    });
    if (!variant) throw new Error('Variant not found');
  }

  /** Clears the primary flag of the other media of the same product/variant. */
  private async clearPrimary(
    tx: Prisma.TransactionClient,
    productId: string,
    variantId: string | null,
    exceptId?: string
  ) {
    await tx.productMedia.updateMany({
      where: { productId, variantId, isPrimary: true, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      data: { isPrimary: false },
    });
  }

  async list(productId: string, tenantId: string) {
    await this.assertProduct(productId, tenantId);
    const data = await this.prisma.productMedia.findMany({
      where: { productId, tenantId },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return { data };
  }

  async upload(
    productId: string,
    tenantId: string,
    file: Express.Multer.File,
    meta: MediaMetaInput
  ) {
    await this.assertProduct(productId, tenantId);
    const variantId = meta.variantId ?? null;
    if (variantId) await this.assertVariant(productId, variantId, tenantId);

    let mediaType: 'IMAGE' | 'DOCUMENT';
    if (IMAGE_TYPES.includes(file.mimetype)) mediaType = 'IMAGE';
    else if (DOCUMENT_TYPES.includes(file.mimetype)) mediaType = 'DOCUMENT';
    else throw new Error('Unsupported file type');

    const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const filePath = `${tenantId}/product/${productId}/${randomUUID()}.${ext}`;
    await this.storage.upload(filePath, file.buffer);
    const { publicUrl } = this.storage.getPublicUrl(filePath);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (meta.isPrimary) await this.clearPrimary(tx, productId, variantId);
        return tx.productMedia.create({
          data: {
            tenantId,
            productId,
            variantId,
            title: meta.title ?? null,
            mediaType,
            fileName: file.originalname.slice(0, 255),
            fileUrl: publicUrl,
            fileType: file.mimetype,
            fileSize: file.size,
            sortOrder: meta.sortOrder ?? 0,
            isPrimary: meta.isPrimary ?? false,
          },
        });
      });
    } catch (error) {
      await this.storage.remove([filePath]);
      throw error;
    }
  }

  async addLink(productId: string, tenantId: string, input: MediaLinkInput) {
    await this.assertProduct(productId, tenantId);
    const variantId = input.variantId ?? null;
    if (variantId) await this.assertVariant(productId, variantId, tenantId);
    let url: URL;
    try {
      url = new URL(input.fileUrl ?? '');
    } catch {
      throw new Error('fileUrl must be a valid https URL');
    }
    if (url.protocol !== 'https:') throw new Error('fileUrl must be a valid https URL');

    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) await this.clearPrimary(tx, productId, variantId);
      return tx.productMedia.create({
        data: {
          tenantId,
          productId,
          variantId,
          title: input.title ?? null,
          mediaType: 'VIDEO_LINK',
          fileUrl: url.toString(),
          sortOrder: input.sortOrder ?? 0,
          isPrimary: input.isPrimary ?? false,
        },
      });
    });
  }

  private async find(id: string, tenantId: string) {
    const media = await this.prisma.productMedia.findFirst({ where: { id, tenantId } });
    if (!media) throw new Error('Media not found');
    return media;
  }

  async update(id: string, tenantId: string, input: MediaMetaInput) {
    const media = await this.find(id, tenantId);
    const variantId = input.variantId !== undefined ? input.variantId : media.variantId;
    if (variantId) await this.assertVariant(media.productId, variantId, tenantId);

    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) await this.clearPrimary(tx, media.productId, variantId, id);
      const data: Prisma.ProductMediaUncheckedUpdateInput = { variantId };
      if (input.title !== undefined) data.title = input.title;
      if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
      if (input.isPrimary !== undefined) data.isPrimary = input.isPrimary;
      return tx.productMedia.update({ where: { id }, data });
    });
  }

  async remove(id: string, tenantId: string) {
    const media = await this.find(id, tenantId);
    await this.prisma.productMedia.delete({ where: { id } });
    if (media.mediaType !== 'VIDEO_LINK') await this.removeFiles([media.fileUrl]);
  }

  /** Best-effort removal of stored files; never throws. */
  async removeFiles(fileUrls: string[]) {
    const paths: string[] = [];
    for (const url of fileUrls) {
      try {
        paths.push(this.storage.getFilePathFromPublicUrl(url));
      } catch {
        // File URL is not managed by local storage.
      }
    }
    await this.storage.remove(paths);
  }
}
