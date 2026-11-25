import type { PrismaClient } from '@prisma/client';
import { DEFAULT_PROJECT_FACILITIES } from '../../src/usecases/product/projectFacilities.js';

const unitTypeAttributes = [
  { code: 'building_area', name: 'Luas Bangunan', unit: 'm²' },
  { code: 'surface_area', name: 'Luas Tanah', unit: 'm²' },
  { code: 'floors', name: 'Lantai', unit: null },
  { code: 'bedroom', name: 'Kamar Tidur', unit: null },
  { code: 'bathroom', name: 'Kamar Mandi', unit: null },
  { code: 'carport', name: 'Carport', unit: null },
] as const;

export async function seedAttributeCatalog(prisma: PrismaClient, tenantId: string) {
  for (const item of unitTypeAttributes) {
    await prisma.attribute.upsert({
      where: { tenantId_code: { tenantId, code: item.code } },
      create: { tenantId, ...item, dataType: 'NUMBER', source: 'UNIT_TYPE' },
      update: { source: 'UNIT_TYPE' },
    });
  }
  for (const item of DEFAULT_PROJECT_FACILITIES) {
    await prisma.attribute.upsert({
      where: { tenantId_code: { tenantId, code: item.code } },
      create: { tenantId, ...item, dataType: 'NUMBER', source: 'PROJECT' },
      // Nama, ikon, dan status mengikuti konfigurasi company.
      update: { source: 'PROJECT' },
    });
  }
}
