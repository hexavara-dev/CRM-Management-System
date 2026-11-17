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
    variants: [
      {
        name: 'Type 36',
        buildingArea: 36,
        surfaceArea: 72,
        floors: 1,
        bedroom: 2,
        bathroom: 1,
        carport: 1,
        basePrice: 350_000_000,
      },
      {
        name: 'Type 45',
        buildingArea: 45,
        surfaceArea: 90,
        floors: 1,
        bedroom: 2,
        bathroom: 1,
        carport: 1,
        basePrice: 450_000_000,
      },
    ],
  },
  {
    code: 'GRIYA-REJO-INDAH',
    name: 'Griya Rejo Indah',
    variants: [
      {
        name: 'Type 36',
        buildingArea: 36,
        surfaceArea: 72,
        floors: 1,
        bedroom: 2,
        bathroom: 1,
        carport: 1,
        basePrice: 375_000_000,
      },
      {
        name: 'Type 45',
        buildingArea: 45,
        surfaceArea: 90,
        floors: 1,
        bedroom: 2,
        bathroom: 1,
        carport: 1,
        basePrice: 475_000_000,
      },
    ],
  },
  {
    code: 'GREEN-HARMONY',
    name: 'Green Harmony',
    variants: [
      {
        name: 'Type 60',
        buildingArea: 60,
        surfaceArea: 120,
        floors: 1,
        bedroom: 3,
        bathroom: 2,
        carport: 2,
        basePrice: 650_000_000,
      },
    ],
  },
  {
    code: 'ROYAL-MUTIARA',
    name: 'Royal Mutiara',
    variants: [
      {
        name: 'Type 72',
        buildingArea: 72,
        surfaceArea: 120,
        floors: 1,
        bedroom: 3,
        bathroom: 2,
        carport: 2,
        basePrice: 750_000_000,
      },
    ],
  },
  {
    code: 'GREEN-SUKMA',
    name: 'Green Sukma',
    variants: [
      {
        name: 'Type 45',
        buildingArea: 45,
        surfaceArea: 90,
        floors: 1,
        bedroom: 2,
        bathroom: 1,
        carport: 1,
        basePrice: 550_000_000,
      },
    ],
  },
  {
    code: 'RUKASA-PANORAMA',
    name: 'Rukasa Panorama',
    variants: [
      {
        name: 'Type 36',
        buildingArea: 36,
        surfaceArea: 72,
        floors: 1,
        bedroom: 2,
        bathroom: 1,
        carport: 1,
        basePrice: 400_000_000,
      },
      {
        name: 'Type 45',
        buildingArea: 45,
        surfaceArea: 90,
        floors: 1,
        bedroom: 2,
        bathroom: 1,
        carport: 1,
        basePrice: 500_000_000,
      },
    ],
  },
] as const;

const variantAttributeDefinitions = [
  { code: 'building_area', name: 'Building Area', unit: 'm²' },
  { code: 'surface_area', name: 'Surface Area', unit: 'm²' },
  { code: 'floors', name: 'Floors', unit: null },
  { code: 'bedroom', name: 'Bedroom', unit: null },
  { code: 'bathroom', name: 'Bathroom', unit: null },
  { code: 'carport', name: 'Carport', unit: null },
] as const;

const clusterDefinitions = [
  { code: 'MELATI', name: 'Melati' },
  { code: 'KAMBOJA', name: 'Kamboja' },
  { code: 'BOUGENVILLE', name: 'Bougenville' },
  { code: 'TERATAI', name: 'Teratai' },
  { code: 'MATAHARI', name: 'Matahari' },
  { code: 'LAVENDER', name: 'Lavender' },
] as const;

// Lokasi contoh mengikuti nama wilayah di frontend/public/data/wilayah.json.
// Link peta menunjuk area kelurahan, bukan titik persil proyek fiktif.
const demoLocations = [
  { province: 'Jawa Timur', city: 'Kabupaten Malang', district: 'Bululawang', village: 'Bululawang', postalCode: '65171', address: 'Lingkungan Bululawang, Kabupaten Malang' },
  { province: 'Jawa Tengah', city: 'Kota Semarang', district: 'Pedurungan', village: 'Tlogomulyo', postalCode: '50195', address: 'Area Tlogomulyo, Pedurungan, Semarang' },
  { province: 'Jawa Barat', city: 'Kota Bandung', district: 'Bandung Wetan', village: 'Cihapit', postalCode: '40114', address: 'Kawasan Cihapit, Bandung Wetan, Kota Bandung' },
  { province: 'Jawa Timur', city: 'Kota Surabaya', district: 'Rungkut', village: 'Kalirungkut', postalCode: '60293', address: 'Koridor Kalirungkut, Rungkut, Surabaya' },
  { province: 'Jawa Barat', city: 'Kota Bogor', district: 'Bogor Utara', village: 'Bantarjati', postalCode: '16153', address: 'Lingkungan Bantarjati, Bogor Utara, Kota Bogor' },
  { province: 'Daerah Istimewa Yogyakarta', city: 'Kota Yogyakarta', district: 'Gondokusuman', village: 'Demangan', postalCode: '55221', address: 'Area Demangan, Gondokusuman, Yogyakarta' },
] as const;

const previousDemoAddresses = [
  'Area hunian Dago, Coblong, Kota Bandung',
  'Lingkungan Sukarasa, Sukasari, Kota Bandung',
  'Kawasan Cihapit, Bandung Wetan, Kota Bandung',
  'Area Pasteur, Sukajadi, Kota Bandung',
  'Lingkungan Antapani Wetan, Kota Bandung',
  'Kawasan Braga, Sumur Bandung, Kota Bandung',
] as const;

const demoFacilityCodes = [
  ['facility_security', 'facility_parking', 'facility_park'],
  ['facility_security', 'facility_playground'],
  ['facility_security', 'facility_parking', 'facility_pool', 'facility_park'],
  ['facility_security', 'facility_parking', 'facility_smart_home', 'facility_pool', 'facility_park'],
  ['facility_security', 'facility_park', 'facility_playground'],
  ['facility_security', 'facility_parking', 'facility_mosque'],
] as const;

const blockDefinitions = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const additionalAvailableUnitsPerBlock = 3;
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
    update: {},
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
  const seededBlocks: { variantId: string; categoryId: string; code: string }[] = [];
  const variantIds = new Set<string>();

  for (const [projectIndex, projectDefinition] of projectDefinitions.entries()) {
    const demoLocation = demoLocations[projectIndex];
    const address = demoLocation.address;
    const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${demoLocation.village}, ${demoLocation.district}, ${demoLocation.city}, ${demoLocation.province}`)}`;
    const projectCategory = await upsertCategory(prisma, tenantId, {
      code: projectDefinition.code,
      name: projectDefinition.name,
      type: 'PROJECT',
    });

    const existingProduct = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId, code: projectDefinition.code } },
    });
    const replacePreviousDemo = existingProduct?.address === previousDemoAddresses[projectIndex];
    const product = await prisma.product.upsert({
      where: { tenantId_code: { tenantId, code: projectDefinition.code } },
      update: {
        // Lengkapi proyek seed lama tanpa menimpa alamat yang sudah diubah pengguna.
        ...(replacePreviousDemo || existingProduct?.province == null ? { province: demoLocation.province } : {}),
        ...(replacePreviousDemo || existingProduct?.city == null ? { city: demoLocation.city } : {}),
        ...(replacePreviousDemo || existingProduct?.subdistrict == null ? { subdistrict: demoLocation.district } : {}),
        ...(replacePreviousDemo || existingProduct?.village == null ? { village: demoLocation.village } : {}),
        ...(replacePreviousDemo || existingProduct?.address == null ? { address } : {}),
        ...(replacePreviousDemo || existingProduct?.postalCode == null ? { postalCode: demoLocation.postalCode } : {}),
        ...(replacePreviousDemo || existingProduct?.mapsUrl == null ? { mapsUrl } : {}),
      },
      create: {
        tenantId,
        categoryId: projectCategory.id,
        name: projectDefinition.name,
        code: projectDefinition.code,
        description: `Hunian modern ${projectDefinition.name}`,
        city: demoLocation.city,
        province: demoLocation.province,
        subdistrict: demoLocation.district,
        village: demoLocation.village,
        address,
        postalCode: demoLocation.postalCode,
        mapsUrl,
        isActive: true,
      },
    });

    const existingFacilities = await prisma.productAttribute.count({
      where: { tenantId, productId: product.id, variantId: null, attribute: { source: 'PROJECT' } },
    });
    if (existingFacilities === 0) {
      const facilities = await prisma.attribute.findMany({
        where: { tenantId, source: 'PROJECT', code: { in: [...demoFacilityCodes[projectIndex]] } },
        select: { id: true },
      });
      if (facilities.length !== demoFacilityCodes[projectIndex].length) {
        throw new Error(`Missing seeded facility attributes for ${projectDefinition.code}`);
      }
      await prisma.productAttribute.createMany({
        data: facilities.map((attribute) => ({ tenantId, productId: product.id, variantId: null, attributeId: attribute.id, value: 1 })),
      });
    }

    const existingVariants = await prisma.productVariant.findMany({
      where: { tenantId, productId: product.id },
    });
    const legacyStandardVariant = existingVariants.find(
      (variant) => variant.name === 'Standard House'
    );
    const variants = [];
    for (const [variantIndex, definition] of projectDefinition.variants.entries()) {
      const existing = existingVariants.find((variant) => variant.name === definition.name);
      const legacyToRename = !existing && variantIndex === 0 ? legacyStandardVariant : undefined;
      const basePrice = BigInt(definition.basePrice);
      const variant = existing
        ? await prisma.productVariant.update({
            where: { id: existing.id },
            data: { basePrice, currentPrice: basePrice },
          })
        : legacyToRename
          ? await prisma.productVariant.update({
              where: { id: legacyToRename.id },
              data: { name: definition.name, basePrice, currentPrice: basePrice },
            })
          : await prisma.productVariant.create({
              data: {
                tenantId,
                productId: product.id,
                name: definition.name,
                basePrice,
                currentPrice: basePrice,
              },
            });

      for (const [attributeIndex, attributeDefinition] of variantAttributeDefinitions.entries()) {
        const attribute = await prisma.attribute.upsert({
          where: { tenantId_code: { tenantId, code: attributeDefinition.code } },
          update: {
            name: attributeDefinition.name,
            dataType: 'NUMBER',
            unit: attributeDefinition.unit,
          },
          create: {
            tenantId,
            name: attributeDefinition.name,
            code: attributeDefinition.code,
            dataType: 'NUMBER',
            unit: attributeDefinition.unit,
          },
        });
        const value = [
          definition.buildingArea,
          definition.surfaceArea,
          definition.floors,
          definition.bedroom,
          definition.bathroom,
          definition.carport,
        ][attributeIndex];
        const existingValue = await prisma.productAttribute.findFirst({
          where: {
            tenantId,
            productId: product.id,
            variantId: variant.id,
            attributeId: attribute.id,
          },
        });
        if (existingValue) {
          await prisma.productAttribute.update({
            where: { id: existingValue.id },
            data: { value },
          });
        } else {
          await prisma.productAttribute.create({
            data: {
              tenantId,
              productId: product.id,
              variantId: variant.id,
              attributeId: attribute.id,
              value,
            },
          });
        }
      }

      variants.push(variant);
      variantIds.add(variant.id);
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
        const variant = variants[blockOffset % variants.length]!;
        seededBlocks.push({ variantId: variant.id, categoryId: blockCategory.id, code: block });

        for (let unitOffset = 0; unitOffset < 5; unitOffset += 1) {
          const index = seededUnits.length;
          const unitCode = `${block}-${String(index + 1).padStart(3, '0')}`;
          const price = BigInt(450_000_000 + (index % 9) * 75_000_000);
          const reservationStatus = getReservationStatus(index);
          const unit = await prisma.productUnit.upsert({
            where: { tenantId_code: { tenantId, code: unitCode } },
            update: { variantId: variant.id },
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

  let additionalUnits = 0;
  for (const [blockIndex, block] of seededBlocks.entries()) {
    for (let offset = 0; offset < additionalAvailableUnitsPerBlock; offset += 1) {
      const unitCode = `${block.code}-AV-${String(blockIndex * additionalAvailableUnitsPerBlock + offset + 1).padStart(3, '0')}`;
      const unit = await prisma.productUnit.upsert({
        where: { tenantId_code: { tenantId, code: unitCode } },
        update: { variantId: block.variantId },
        create: {
          tenantId,
          variantId: block.variantId,
          categoryId: block.categoryId,
          code: unitCode,
          name: `Unit ${unitCode}`,
          status: 'AVAILABLE',
        },
      });
      if (unit.status === 'AVAILABLE') additionalUnits += 1;
    }
  }

  for (const variantId of variantIds) {
    const unitCount = await prisma.productUnit.count({ where: { tenantId, variantId } });
    await prisma.productVariant.updateMany({
      where: { id: variantId, tenantId },
      data: { stock: unitCount },
    });
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
      update: {},
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

  console.log(
    `Seeded ${seededUnits.length} original units, ${additionalUnits} available units, and ${seededUnits.length} reservations.`
  );
}
