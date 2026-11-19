/**
 * Jumlah kolom (baris unit) yang ditambahkan sekali klik. Dibatasi 1..`max`, dengan `max` = sisa slot
 * tipe aktif dikurangi baris yang sudah ditambahkan di dialog. `max` <= 0 berarti tidak ada slot: hasil 0.
 */
export function clampAddCount(raw: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 0;
  const wanted = Number.isFinite(raw) ? Math.floor(raw) : 1;
  return Math.min(Math.max(wanted, 1), Math.floor(max));
}
