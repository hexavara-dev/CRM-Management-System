import type { Photo } from "./photos";

/** Spesifikasi unit yang disimpan per varian (`product_attributes`, nilai INT). */
export const SPEC_FIELDS = [
  { code: "building_area", name: "Building Area", short: "LB", unit: "m²" },
  { code: "surface_area", name: "Surface Area", short: "LT", unit: "m²" },
  { code: "floors", name: "Floors", short: "Lt" },
  { code: "bedroom", name: "Bedroom", short: "KT" },
  { code: "bathroom", name: "Bathroom", short: "KM" },
  { code: "carport", name: "Carport", short: "CP" },
] as const;

export type SpecCode = (typeof SPEC_FIELDS)[number]["code"];
export type SpecValues = Record<SpecCode, string>;

/** Varian yang sedang diisi di form; angka disimpan sebagai teks input. */
export type VariantDraft = {
  id?: string;
  key: string;
  name: string;
  code: string;
  stock: string;
  basePrice: string;
  specs: SpecValues;
  photos: Photo[];
};

const specsFrom = (value: (code: SpecCode) => string) =>
  Object.fromEntries(SPEC_FIELDS.map(({ code }) => [code, value(code)])) as SpecValues;

/** Varian baru; spesifikasi disalin dari varian lain bila diberikan. */
export function newVariant(name = "", copyFrom?: VariantDraft): VariantDraft {
  return {
    key: crypto.randomUUID(),
    name,
    code: "",
    stock: "",
    basePrice: "",
    specs: copyFrom ? { ...copyFrom.specs } : specsFrom(() => ""),
    photos: [],
  };
}

/** Spesifikasi tersimpan milik satu varian; yang belum ada bernilai 0. */
export function specsOfVariant(
  attributes: { typeVariantId: string | null; value: number; attribute: { code: string } }[],
  typeVariantId: string,
): SpecValues {
  return specsFrom((code) =>
    String(attributes.find((row) => row.typeVariantId === typeVariantId && row.attribute.code === code)?.value ?? 0),
  );
}

/** Body `attributes` satu varian; kosong dikirim 0 dan pecahan dibulatkan. */
export const specPayload = (specs: SpecValues) =>
  SPEC_FIELDS.map((field) => ({
    name: field.name,
    code: field.code,
    dataType: "NUMBER" as const,
    value: Math.round(Number(specs[field.code]) || 0),
    ...("unit" in field ? { unit: field.unit } : {}),
  }));

/** Nilai satu spesifikasi pada beberapa varian: "2", atau rentang "2–3" bila berbeda. */
export function specRange(variants: { specs: SpecValues }[], code: SpecCode): string {
  const values = variants.map(({ specs }) => Number(specs[code]) || 0);
  if (values.length === 0) return "0";
  const format = (value: number) => value.toLocaleString("id-ID");
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? format(min) : `${format(min)}–${format(max)}`;
}

/** Ringkasan satu baris untuk kartu varian tertutup. */
export const specSummary = (specs: SpecValues) =>
  SPEC_FIELDS.filter(({ code }) => specs[code] !== "")
    .map(({ code, short }) => (short === "LB" || short === "LT" ? `${short} ${specs[code]}` : `${specs[code]} ${short}`))
    .join(" · ");
