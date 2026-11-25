import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';

/** Kunci ikon fasilitas. Harus sama dengan FACILITY_ICONS di frontend. */
export const FACILITY_ICONS = [
  // Keamanan dan akses
  'shield-check',
  'cctv',
  'fingerprint',
  'parking-square',
  'car',
  'bike',
  'bus',
  'train',
  // Olahraga dan rekreasi
  'waves',
  'dumbbell',
  'footprints',
  'volleyball',
  'trees',
  'flower',
  'shapes',
  'baby',
  'tent',
  // Sosial dan komersial
  'landmark',
  'moon-star',
  'church',
  'school',
  'hospital',
  'library',
  'users',
  'coffee',
  'utensils',
  'shopping-cart',
  'store',
  // Bangunan dan utilitas
  'house',
  'building',
  'wifi',
  'zap',
  'droplets',
  'recycle',
] as const;
export type FacilityIcon = (typeof FACILITY_ICONS)[number];

/** Fasilitas awal untuk company baru; dapat diubah atau dihapus owner. */
export const DEFAULT_PROJECT_FACILITIES: { code: string; name: string; iconKey: FacilityIcon }[] = [
  { code: 'facility_security', name: 'Keamanan 24 Jam', iconKey: 'shield-check' },
  { code: 'facility_parking', name: 'Area Parkir', iconKey: 'parking-square' },
  { code: 'facility_park', name: 'Taman', iconKey: 'trees' },
  { code: 'facility_pool', name: 'Kolam Renang', iconKey: 'waves' },
  { code: 'facility_playground', name: 'Area Bermain', iconKey: 'shapes' },
  { code: 'facility_mosque', name: 'Tempat Ibadah', iconKey: 'landmark' },
  { code: 'facility_smart_home', name: 'Smart Home', iconKey: 'house' },
];

/** Data createMany fasilitas awal untuk satu company. */
export function defaultProjectFacilities(tenantId: string): Prisma.AttributeCreateManyInput[] {
  return DEFAULT_PROJECT_FACILITIES.map((item) => ({ ...item, tenantId, dataType: 'NUMBER', source: 'PROJECT' }));
}

/** Kode internal fasilitas baru; unik dan tidak berubah saat nama diganti. */
export const newFacilityCode = () => `facility_${randomUUID()}`;
