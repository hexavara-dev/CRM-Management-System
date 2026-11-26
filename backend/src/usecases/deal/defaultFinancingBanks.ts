import type { Prisma } from '@prisma/client';

/**
 * Bank yang umum dipakai untuk KPR di Indonesia, sebagai pilihan bank pembiayaan awal setiap company.
 * Dapat dinonaktifkan atau dihapus per company.
 */
export const DEFAULT_FINANCING_BANKS: readonly string[] = [
  'Bank BRI',
  'Bank Mandiri',
  'Bank BNI',
  'Bank BTN',
  'Bank BCA',
  'Bank Syariah Indonesia (BSI)',
  'Bank BCA Syariah',
  'Bank Muamalat',
  'Bank CIMB Niaga',
  'Bank Danamon',
  'Bank Permata',
  'Bank OCBC Indonesia',
  'Bank Maybank Indonesia',
  'Bank Panin',
  'Bank Mega',
  'Bank UOB Indonesia',
  'Bank DBS Indonesia',
  'Bank HSBC Indonesia',
];

/** Data createMany bank pembiayaan awal untuk satu company. */
export function defaultFinancingBanks(tenantId: string): Prisma.FinancingBankCreateManyInput[] {
  return DEFAULT_FINANCING_BANKS.map((name) => ({ tenantId, name, isActive: true }));
}
