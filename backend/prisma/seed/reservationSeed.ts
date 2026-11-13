import type { PrismaClient, ProductUnitStatus, ReservationStatus } from '@prisma/client';

type SeedSalesUser = {
  id: string;
  name: string | null;
  email: string;
};

const projectDefinitions = [
  {
    code: 'GRIYA-REJO-ASRI',
    name: 'Griya Rejo Asri',
    image: '/images/projects/griya-rejo-asri.svg',
  },
  {
    code: 'GRIYA-REJO-INDAH',
    name: 'Griya Rejo Indah',
    image: '/images/projects/griya-rejo-indah.svg',
  },
  { code: 'GREEN-HARMONY', name: 'Green Harmony', image: '/images/projects/green-harmony.svg' },
  { code: 'ROYAL-MUTIARA', name: 'Royal Mutiara', image: '/images/projects/royal-mutiara.svg' },
  { code: 'GREEN-SUKMA', name: 'Green Sukma', image: '/images/projects/green-sukma.svg' },
  {
    code: 'RUKASA-PANORAMA',
    name: 'Rukasa Panorama',
    image: '/images/projects/rukasa-panorama.svg',
  },
] as const;

const clusterDefinitions = [
  { code: 'MELATI', name: 'Melati' },
  { code: 'KAMBOJA', name: 'Kamboja' },
  { code: 'BOUGENVILLE', name: 'Bougenville' },
  { code: 'TERATAI', name: 'Teratai' },
  { code: 'MATAHARI', name: 'Matahari' },
  { code: 'LAVENDER', name: 'Lavender' },
] as const;

const blockDefinitions = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const customerNames = [
  'Andi Permana',
  'Siti Nurhaliza',
  'Budi Santoso',
  'Ratna Sari',
  'Hendra Wijaya',
  'Intan Permata',
  'Fajar Nugroho',
  'Dian Oktavia',
  'Muhammad Iqbal',
  'Rina Oktaviani',
  'Agus Setiawan',
  'Nadia Putri',
] as const;

const getReservationStatus = (index: number): ReservationStatus => {
  if (index % 15 === 0) return 'EXPIRED';
  if (index % 10 === 4) return 'PAYMENT_PENDING';
  return 'ACTIVE';
};

const getUnitStatus = (status: ReservationStatus): ProductUnitStatus =>
  status === 'ACTIVE' || status === 'PAYMENT_PENDING' ? 'RESERVED' : 'AVAILABLE';

async function upsertCategory(
  prisma: PrismaClient,
  tenantId: string,
  input: {
    code: string;
    name: string;
    type: 'PROJECT' | 'CLUSTER' | 'BLOCK';
    parentId?: string;
  }
) {
  return prisma.productCategory.upsert({
    where: { tenantId_code: { tenantId, code: input.code } },
    update: {
      name: input.name,
      type: input.type,
      parentId: input.parentId ?? null,
      isActive: true,
    },
    create: {
      tenantId,
      code: input.code,
      name: input.name,
      type: input.type,
      isActive: true,
      parentId: input.parentId ?? null,
    },
  });
}

export async function seedReservationData(
  prisma: PrismaClient,
  tenantId: string,
  salesUsers: SeedSalesUser[]
) {
  if (salesUsers.length === 0)
    throw new Error('At least one sales user is required for reservation seed data.');

  const seededUnits: { id: string; index: number; price: bigint }[] = [];

  for (const [projectIndex, projectDefinition] of projectDefinitions.entries()) {
    const projectCategory = await upsertCategory(prisma, tenantId, {
      code: projectDefinition.code,
      name: projectDefinition.name,
      type: 'PROJECT',
    });

    const product = await prisma.product.upsert({
      where: { tenantId_code: { tenantId, code: projectDefinition.code } },
      update: {
        name: projectDefinition.name,
        categoryId: projectCategory.id,
        isActive: true,
      },
      create: {
        tenantId,
        categoryId: projectCategory.id,
        name: projectDefinition.name,
        code: projectDefinition.code,
        description: `Hunian modern ${projectDefinition.name}`,
        city: 'Bandung',
        province: 'Jawa Barat',
        isActive: true,
      },
    });

    const variant =
      (await prisma.productVariant.findFirst({
        where: { tenantId, productId: product.id, name: 'Standard House' },
      })) ??
      (await prisma.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          name: 'Standard House',
          basePrice: BigInt(450_000_000 + projectIndex * 50_000_000),
          currentPrice: BigInt(450_000_000 + projectIndex * 50_000_000),
          stock: 20,
        },
      }));

    const existingMedia = await prisma.productMedia.findFirst({
      where: { productId: product.id, fileUrl: projectDefinition.image },
      select: { id: true },
    });
    if (!existingMedia) {
      await prisma.productMedia.create({
        data: {
          tenantId,
          productId: product.id,
          title: `${projectDefinition.name} cover`,
          mediaType: 'IMAGE',
          fileUrl: projectDefinition.image,
          fileName: projectDefinition.image.split('/').pop(),
          fileType: 'image/svg+xml',
          isPrimary: true,
          sortOrder: 0,
        },
      });
    }

    for (let clusterOffset = 0; clusterOffset < 2; clusterOffset += 1) {
      const clusterDefinition =
        clusterDefinitions[(projectIndex * 2 + clusterOffset) % clusterDefinitions.length];
      const cluster = await upsertCategory(prisma, tenantId, {
        code: `${projectDefinition.code}-${clusterDefinition.code}`,
        name: clusterDefinition.name,
        type: 'CLUSTER',
        parentId: projectCategory.id,
      });

      for (let blockOffset = 0; blockOffset < 2; blockOffset += 1) {
        const block =
          blockDefinitions[
            (projectIndex * 2 + clusterOffset * 2 + blockOffset) % blockDefinitions.length
          ];
        const blockCategory = await upsertCategory(prisma, tenantId, {
          code: `${projectDefinition.code}-${clusterDefinition.code}-${block}`,
          name: block,
          type: 'BLOCK',
          parentId: cluster.id,
        });

        for (let unitOffset = 0; unitOffset < 5; unitOffset += 1) {
          const index = seededUnits.length;
          const unitCode = `${block}-${String(index + 1).padStart(3, '0')}`;
          const price = BigInt(450_000_000 + (index % 9) * 75_000_000);
          const reservationStatus = getReservationStatus(index);
          const unit = await prisma.productUnit.upsert({
            where: { tenantId_code: { tenantId, code: unitCode } },
            update: {
              variantId: variant.id,
              categoryId: blockCategory.id,
              name: `Unit ${unitCode}`,
              status: getUnitStatus(reservationStatus),
            },
            create: {
              tenantId,
              variantId: variant.id,
              categoryId: blockCategory.id,
              code: unitCode,
              name: `Unit ${unitCode}`,
              status: getUnitStatus(reservationStatus),
            },
          });
          seededUnits.push({ id: unit.id, index, price });
        }
      }
    }
  }

  const now = new Date();
  for (const { id: unitId, index, price } of seededUnits) {
    const status = getReservationStatus(index);
    const daysAgo = index % 13;
    const reservedAt = new Date(now);
    reservedAt.setDate(reservedAt.getDate() - daysAgo);
    const expiresAt = new Date(reservedAt);
    expiresAt.setDate(expiresAt.getDate() + (status === 'PAYMENT_PENDING' ? 2 : 7));
    if (status === 'EXPIRED') expiresAt.setDate(expiresAt.getDate() - 8);

    await prisma.reservation.upsert({
      where: {
        tenantId_refCode: { tenantId, refCode: `RSV-${String(index + 1).padStart(3, '0')}` },
      },
      update: {
        unitId,
        salesId: salesUsers[index % salesUsers.length]!.id,
        customerName: customerNames[index % customerNames.length]!,
        customerEmail: `customer${index + 1}@example.com`,
        customerPhone: `0812${String(index + 1).padStart(8, '0')}`,
        reservedAt,
        expiresAt,
        price,
        status,
        notes: null,
      },
      create: {
        tenantId,
        unitId,
        salesId: salesUsers[index % salesUsers.length]!.id,
        refCode: `RSV-${String(index + 1).padStart(3, '0')}`,
        customerName: customerNames[index % customerNames.length]!,
        customerEmail: `customer${index + 1}@example.com`,
        customerPhone: `0812${String(index + 1).padStart(8, '0')}`,
        reservedAt,
        expiresAt,
        price,
        status,
      },
    });
  }

  console.log(`Seeded ${seededUnits.length} units and ${seededUnits.length} reservations.`);
}
