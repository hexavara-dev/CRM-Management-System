import type { PrismaClient } from '@prisma/client';

type StageCounter = Pick<PrismaClient, 'stage'>;

export function grandfatheredStageIds(record: { evidenceGrandfatheredStageIds?: unknown }): string[] {
  return Array.isArray(record.evidenceGrandfatheredStageIds)
    ? record.evidenceGrandfatheredStageIds.filter((id): id is string => typeof id === 'string')
    : [];
}

/**
 * Deal/Lead yang pernah mencapai suatu fase sebelum evidence diwajibkan boleh
 * kembali ke fase itu maupun fase mana pun di bawahnya tanpa evidence. Karena
 * perpindahan maju hanya satu fase, pengecualian per-ID saja akan mengunci data
 * di fase perantara yang tidak pernah tercatat di riwayatnya.
 * Harus sejalan dengan `isEvidenceGrandfathered` di frontend.
 */
export async function isEvidenceGrandfathered(
  db: StageCounter,
  tenantId: string,
  entityType: 'deal' | 'lead',
  record: { evidenceGrandfatheredStageIds?: unknown },
  target: { id: string; position: number },
) {
  const ids = grandfatheredStageIds(record);
  if (!ids.length) return false;
  if (ids.includes(target.id)) return true;
  const reachedAtOrAbove = await db.stage.count({
    where: { tenantId, entityType, isActive: true, id: { in: ids }, position: { gte: target.position } },
  });
  return reachedAtOrAbove > 0;
}
