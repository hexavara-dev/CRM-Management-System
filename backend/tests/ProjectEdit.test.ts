import { jest } from '@jest/globals';
import { ProductUseCase } from '../src/usecases/product/ProductUseCase.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

const project = { id: 'p-1', categoryId: 'root', variants: [], media: [], category: { id: 'root', type: 'PROJECT' } };
const baseInput = {
  name: 'Project Updated',
  code: 'PRJ',
  variants: [{ id: 'v-1', name: 'Type 36', basePrice: 500, stock: 1, attributes: [] }],
  locations: [{ id: 'c-1', key: 'c-1', parentKey: null, name: 'Cluster A', type: 'CLUSTER' as const }],
  units: [{ id: 'u-1', code: 'A-01', variantIndex: 0, locationKey: 'c-1', status: 'AVAILABLE' as const }],
};

function fixture(unitStatus = 'AVAILABLE') {
  const tx = {
    product: { update: fn() },
    productCategory: {
      update: fn({ id: 'c-1' }),
      findMany: fn([
        { id: 'root', parentId: null, code: 'PRJ' },
        { id: 'c-1', parentId: 'root', code: 'PRJ-001' },
      ]),
    },
    productVariant: {
      findMany: fn([{ id: 'v-1', basePrice: BigInt(500), currentPrice: BigInt(500) }]),
      update: fn({ id: 'v-1' }),
    },
    productUnit: {
      findMany: fn([{ id: 'u-1', variantId: 'v-1', categoryId: 'c-1', status: unitStatus }]),
      update: fn({ id: 'u-1' }),
      deleteMany: fn(),
    },
    reservation: { count: fn(0) },
    unitPriceAdjustment: { count: fn(0) },
    productMedia: { count: fn(0), createMany: fn(), deleteMany: fn(), updateMany: fn(), update: fn(), findFirst: fn(null) },
  };
  const prisma = {
    product: { findFirst: fn(project) },
    $transaction: jest.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
  };
  return { tx, prisma };
}

describe('project edit wizard persistence', () => {
  it('updates existing type, location and unit IDs in one transaction', async () => {
    const { tx, prisma } = fixture();
    await new ProductUseCase(prisma as never).update('p-1', 't-1', baseInput);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 'p-1' }, data: expect.objectContaining({ name: 'Project Updated' }) });
    expect(tx.productVariant.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'v-1' } }));
    expect(tx.productCategory.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c-1' } }));
    expect(tx.productUnit.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u-1' } }));
    expect(tx.productUnit.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects removing a reserved unit before deleting any unit', async () => {
    const { tx, prisma } = fixture('RESERVED');
    await expect(new ProductUseCase(prisma as never).update('p-1', 't-1', {
      ...baseInput, units: [],
    })).rejects.toThrow(/Conflict: units/);
    expect(tx.productUnit.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects an existing ID from another project', async () => {
    const { tx, prisma } = fixture();
    await expect(new ProductUseCase(prisma as never).update('p-1', 't-1', {
      ...baseInput, variants: [{ ...baseInput.variants[0], id: 'foreign-variant' }],
    })).rejects.toThrow(/Invalid variant IDs/);
    expect(tx.productVariant.update).not.toHaveBeenCalled();
  });

  it('removes staged cover files when edit transaction fails', async () => {
    const { tx, prisma } = fixture();
    tx.product.update.mockRejectedValueOnce(new Error('write failed'));
    const storage = {
      upload: fn(),
      remove: fn(),
      getPublicUrl: jest.fn((path: string) => ({ publicUrl: `http://localhost:3000/uploads/${path}` })),
    };
    const cover = {
      originalname: 'cover.jpg', mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), size: 4,
    } as Express.Multer.File;
    await expect(new ProductUseCase(prisma as never, storage as never).update('p-1', 't-1', {
      description: 'Changed',
    }, [cover])).rejects.toThrow('write failed');
    expect(storage.remove).toHaveBeenCalledWith([storage.upload.mock.calls[0][0]]);
  });

  it('saves existing cover changes in the transaction and removes old files after commit', async () => {
    const { tx, prisma } = fixture();
    prisma.product.findFirst.mockResolvedValue({
      ...project,
      media: [
        { id: 'm-1', mediaType: 'IMAGE', variantId: null, unitId: null, isPrimary: true, fileUrl: 'http://localhost:3000/uploads/t-1/old.jpg' },
        { id: 'm-2', mediaType: 'IMAGE', variantId: null, unitId: null, isPrimary: false, fileUrl: 'http://localhost:3000/uploads/t-1/keep.jpg' },
      ],
    });
    const storage = {
      upload: fn(), remove: fn(),
      getFilePathFromPublicUrl: jest.fn(() => 't-1/old.jpg'),
    };
    await new ProductUseCase(prisma as never, storage as never).update('p-1', 't-1', {
      description: 'New', removeMediaIds: ['m-1'], primaryMediaId: 'm-2',
    });
    expect(tx.productMedia.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 't-1', productId: 'p-1', id: { in: ['m-1'] } },
    });
    expect(tx.productMedia.update).toHaveBeenCalledWith({ where: { id: 'm-2' }, data: { isPrimary: true } });
    expect(storage.remove).toHaveBeenCalledWith(['t-1/old.jpg']);
  });
});
