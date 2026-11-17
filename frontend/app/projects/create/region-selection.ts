import type { Province } from "./region-select";

type Regency = Province["r"][number];
type District = Regency["d"][number];
type Village = District["v"][number];
type Option = { c: string; n: string };

export const SAVED_PROVINCE = "__saved_province";
export const SAVED_CITY = "__saved_city";
export const SAVED_DISTRICT = "__saved_district";
export const SAVED_VILLAGE = "__saved_village";

/** Pilihan baru user per level (kode wilayah). `undefined` = belum diubah, "" = sengaja dikosongkan. */
export type RegionEdits = { province?: string; city?: string; district?: string; village?: string };
/** Nama wilayah yang tersimpan di proyek (kolom `products`). */
export type SavedRegion = { province?: string; city?: string; subdistrict?: string; village?: string };

export function matchRegion<T extends Option>(items: T[], name: string): T | undefined {
  const exact = items.find((item) => item.n.toLowerCase() === name.toLowerCase());
  if (exact) return exact;
  const simple = (value: string) => value.toLowerCase().replace(/^(kota|kabupaten)\s+/, "").trim();
  const matches = items.filter((item) => simple(item.n) === simple(name));
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Kode terpilih satu level: pilihan user > kode wilayah yang namanya cocok dengan nilai tersimpan >
 * opsi sementara bernama nilai tersimpan (saat wilayah.json belum termuat / nama tidak dikenal),
 * sehingga nilai tersimpan selalu tampil sebagai selected option.
 */
function resolveLevel<T extends Option>(items: T[], savedName: string | undefined, editedCode: string | undefined, savedCode: string, makeSaved: (name: string) => T) {
  const code = editedCode ?? matchRegion(items, savedName ?? "")?.c ?? (savedName ? savedCode : "");
  const options = code === savedCode && savedName ? [makeSaved(savedName), ...items] : items;
  return { code, options, selected: options.find((option) => option.c === code) };
}

export function resolveRegionSelection(regions: Province[] | null, saved: SavedRegion | undefined, edited: RegionEdits) {
  const province = resolveLevel<Province>(regions ?? [], saved?.province, edited.province, SAVED_PROVINCE, (n) => ({ c: SAVED_PROVINCE, n, r: [] }));
  const city = resolveLevel<Regency>(province.selected?.r ?? [], saved?.city, edited.city, SAVED_CITY, (n) => ({ c: SAVED_CITY, n, d: [] }));
  const district = resolveLevel<District>(city.selected?.d ?? [], saved?.subdistrict, edited.district, SAVED_DISTRICT, (n) => ({ c: SAVED_DISTRICT, n, v: [] }));
  const village = resolveLevel<Village>(district.selected?.v ?? [], saved?.village, edited.village, SAVED_VILLAGE, (n) => ({ c: SAVED_VILLAGE, n }));
  return { province, city, district, village };
}
