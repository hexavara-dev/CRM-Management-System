type StageRef = { id: string; position: number };

/**
 * Deal/Lead bebas evidence untuk fase yang pernah dicapainya sebelum aturan
 * berlaku dan semua fase di bawahnya, sehingga bisa kembali ke fase awal tanpa
 * unggah ulang. Harus sejalan dengan `isEvidenceGrandfathered` di backend.
 */
export function isEvidenceGrandfathered(
  grandfatheredStageIds: string[] | null | undefined,
  target: StageRef,
  stages: (StageRef & { isActive: boolean })[],
) {
  const ids = grandfatheredStageIds ?? [];
  if (ids.includes(target.id)) return true;
  return stages.some(
    (stage) => stage.isActive && ids.includes(stage.id) && stage.position >= target.position,
  );
}
