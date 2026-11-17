import type { PrismaClient } from '@prisma/client';

const unitTypeAttributes = [
  { code: 'building_area', name: 'Luas Bangunan', unit: 'm²' },
  { code: 'surface_area', name: 'Luas Tanah', unit: 'm²' },
  { code: 'floors', name: 'Lantai', unit: null },
  { code: 'bedroom', name: 'Kamar Tidur', unit: null },
  { code: 'bathroom', name: 'Kamar Mandi', unit: null },
  { code: 'carport', name: 'Carport', unit: null },
] as const;

const projectFacilities = [
  { code: 'facility_security', name: 'Keamanan 24 Jam', iconKey: 'shield-check' },
  { code: 'facility_parking', name: 'Area Parkir', iconKey: 'parking-square' },
  { code: 'facility_park', name: 'Taman', iconKey: 'trees' },
  { code: 'facility_pool', name: 'Kolam Renang', iconKey: 'waves' },
  { code: 'facility_playground', name: 'Area Bermain', iconKey: 'shapes' },
  { code: 'facility_mosque', name: 'Tempat Ibadah', iconKey: 'landmark' },
  { code: 'facility_smart_home', name: 'Smart Home', iconKey: 'house' },
] as const;

export async function seedAttributeCatalog(prisma: PrismaClient, tenantId: string) {
  for (const item of unitTypeAttributes) {
    await prisma.attribute.upsert({
      where: { tenantId_code: { tenantId, code: item.code } },
      create: { tenantId, ...item, dataType: 'NUMBER', source: 'UNIT_TYPE' },
      update: { source: 'UNIT_TYPE' },
    });
  }
  for (const item of projectFacilities) {
    await prisma.attribute.upsert({
      where: { tenantId_code: { tenantId, code: item.code } },
      create: { tenantId, ...item, dataType: 'NUMBER', source: 'PROJECT' },
      update: { source: 'PROJECT', iconKey: item.iconKey },
    });
  }
}
