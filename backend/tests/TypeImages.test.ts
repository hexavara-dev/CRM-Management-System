import { jest } from '@jest/globals';
import { AvailabilityUseCase } from '../src/usecases/availability/AvailabilityUseCase.js';
import { ProductUseCase } from '../src/usecases/product/ProductUseCase.js';
import { saveOwnerImages } from '../src/usecases/product/typeImages.js';
import { mapHttpError } from '../src/infrastructure/utils/HttpErrorMapper.js';
import { validateVariant } from '../src/presentation/validation/ProductRequestValidation.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);
const owner = { tenantId: 't-1', productId: 'p-1', variantId: 'v-1', typeVariantId: 'tv-1' };
const file = { originalname: 'a.jpg', mimetype: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0]), size: 4 } as Express.Multer.File;
const stored = (url: string) => ({ file, path: url, url });
const saved = (id: string, sortOrder: number) => ({ id, fileUrl: `url-${id}`, sortOrder, isPrimary: sortOrder === 0 });
const mediaTx = (rows: unknown[]) => ({ productMedia: { findMany: fn(rows), deleteMany: fn(), update: fn(), create: fn() } });

describe('saveOwnerImages', () => {
  it('reorders, replaces, and adds photos; the first becomes primary', async () => {
    const tx = mediaTx([saved('m1', 0), saved('m2', 1)]);
    await expect(saveOwnerImages(tx as never, owner, ['new:0', 'm2'], [stored('n0')])).resolves.toEqual(['url-m1']);
    expect(tx.productMedia.findMany.mock.calls[0][0].where).toEqual({ ...owner, unitId: null, mediaType: 'IMAGE' });
    expect(tx.productMedia.deleteMany).toHaveBeenCalledWith({ where: { ...owner, id: { in: ['m1'] } } });
    expect(tx.productMedia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...owner, fileUrl: 'n0', sortOrder: 0, isPrimary: true }),
    });
    expect(tx.productMedia.update).not.toHaveBeenCalled();
  });

  it('appends without an order and leaves photos alone when nothing is sent', async () => {
    const tx = mediaTx([saved('m1', 0)]);
    await saveOwnerImages(tx as never, owner, undefined, [stored('n0')]);
    expect(tx.productMedia.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sortOrder: 1, isPrimary: false }) });
    const untouched = mediaTx([]);
    await saveOwnerImages(untouched as never, owner, undefined, []);
    expect(untouched.productMedia.findMany).not.toHaveBeenCalled();
  });

  it('rejects foreign IDs, missing uploads, duplicates, and more than 5 photos', async () => {
    const run = (rows: unknown[], order: string[] | undefined, uploads: ReturnType<typeof stored>[]) =>
      saveOwnerImages(mediaTx(rows) as never, owner, order, uploads);
    await expect(run([saved('m1', 0)], ['other'], [])).rejects.toThrow('Invalid media order');
    await expect(run([], [], [stored('n0')])).rejects.toThrow('Invalid media order');
    await expect(run([saved('m1', 0)], ['m1', 'm1'], [])).rejects.toThrow('Invalid media order');
    const error = await run([0, 1, 2, 3, 4].map((i) => saved(`m${i}`, i)), undefined, [stored('n0')]).catch((e: unknown) => e);
    expect(mapHttpError(error).status).toBe(400);
  });
});

describe('type routes with photos', () => {
  const option = { id: 'tv-1', name: 'Standard', code: null, basePrice: BigInt(1), currentPrice: BigInt(1), minPrice: null, stock: 1, isActive: true };
  function fixture() {
    const tx = {
      productVariant: { update: fn({ id: 'v-1' }) },
      productTypeVariant: { findMany: fn([option]), update: fn({ id: 'tv-1' }) },
      productUnit: { count: fn(0) },
      ...mediaTx([]),
    };
    const prisma = { productVariant: { findFirst: fn({ id: 'v-1' }) }, $transaction: jest.fn(async (cb: any) => cb(tx)) };
    const storage = { upload: fn(), remove: fn(), getPublicUrl: (path: string) => ({ publicUrl: path }), getFilePathFromPublicUrl: (url: string) => url };
    return { tx, prisma, storage, useCase: new ProductUseCase(prisma as never, storage as never) };
  }
  const input = { typeVariants: [{ id: 'tv-1', name: 'Standard', basePrice: 1, stock: 1 }] };

  it('keeps type photos and variant photos separate', async () => {
    const { tx, useCase } = fixture();
    await useCase.updateVariant('p-1', 'v-1', 't-1', input, { type: [file], variants: [{ typeVariantIndex: 0, file }] });
    expect(tx.productMedia.create.mock.calls.map((call) => [call[0].data.variantId, call[0].data.typeVariantId])).toEqual([
      ['v-1', null],
      ['v-1', 'tv-1'],
    ]);
  });

  it('cleans new files when the transaction fails and rejects bad indexes before storing', async () => {
    const failing = fixture();
    failing.tx.productMedia.create.mockRejectedValue(new Error('write failed'));
    await expect(failing.useCase.updateVariant('p-1', 'v-1', 't-1', input, { type: [file], variants: [] })).rejects.toThrow('write failed');
    expect(failing.storage.remove).toHaveBeenCalledWith([failing.storage.upload.mock.calls[0][0]]);

    const bad = fixture();
    await expect(
      bad.useCase.updateVariant('p-1', 'v-1', 't-1', input, { type: [], variants: [{ typeVariantIndex: 3, file }] })
    ).rejects.toThrow('Invalid type variant image indexes');
    expect(bad.storage.upload).not.toHaveBeenCalled();
  });

  it('validates mediaOrder', () => {
    expect(validateVariant({ mediaOrder: ['a', 'new:0'] }, true).mediaOrder).toEqual(['a', 'new:0']);
    expect(() => validateVariant({ mediaOrder: ['1', '2', '3', '4', '5', '6'] }, true)).toThrow(/at most 5/);
    expect(() => validateVariant({ typeVariants: [{ ...input.typeVariants[0], mediaOrder: [1] }] }, true)).toThrow(/Invalid mediaOrder/);
  });
});

describe('unit photo fallback', () => {
  const rows = [
    { fileUrl: 'cover', variantId: null, typeVariantId: null },
    { fileUrl: 'type', variantId: 'v-1', typeVariantId: null },
    { fileUrl: 'variant', variantId: 'v-1', typeVariantId: 'tv-1' },
  ];
  const detail = (unitMedia: unknown[], media: unknown[]) => {
    const prisma = {
      product: { findUnique: fn({ id: 'p-1', code: 'PRJ', name: 'X', categoryId: 'root', variants: [{ typeVariants: [{ stock: 1 }] }], media: [] }), findFirst: fn(null) },
      productCategory: { findMany: fn([
        { id: 'root', code: 'ROOT', parentId: null, name: 'X', type: 'PROJECT' },
        { id: 'c-1', code: 'C1', parentId: 'root', name: 'C1', type: 'CLUSTER' },
      ]) },
      productUnit: { findMany: fn([{
        id: 'u-1', code: 'A-01', name: null, categoryId: 'c-1', status: 'AVAILABLE', variantId: 'v-1', typeVariantId: 'tv-1',
        variant: { id: 'v-1', name: 'Type 36' }, typeVariant: { id: 'tv-1', name: 'Standard', basePrice: BigInt(1), attributes: [] }, media: unitMedia, reservations: [],
      }]) },
      reservation: { findMany: fn([]) },
      productVariantPriceLog: { findMany: fn([]) },
      unitPriceAdjustment: { findMany: fn([]) },
      productMedia: { findMany: fn(media) },
    };
    return new AvailabilityUseCase(prisma as never).unit('t-1', 'PRJ', 'C1', 'A-01').then((unit) => unit?.images);
  };

  it('prefers unit, then variant, then type, then project photos', async () => {
    await expect(detail([{ fileUrl: 'unit' }], rows)).resolves.toEqual(['unit']);
    await expect(detail([], rows)).resolves.toEqual(['variant']);
    await expect(detail([], rows.slice(0, 2))).resolves.toEqual(['type']);
    await expect(detail([], rows.slice(0, 1))).resolves.toEqual(['cover']);
    await expect(detail([], [])).resolves.toEqual([]);
  });
});
