import type { CreateProjectPayload } from "@/hooks/use-projects";
import type { LocationNode, UnitItem } from "./hierarchy-step";
import type { ProjectInfo } from "./preview-step";
import type { UnitType } from "./unit-type-step";

const ROOT = "root";

/** Level pada pohon lokasi -> enum `product_categories.type` di backend. */
const LEVEL_TYPE: Record<string, CreateProjectPayload["locations"][number]["type"]> = {
  cluster: "CLUSTER",
  zone: "ZONE",
  block: "BLOCK",
  tower: "TOWER",
  floor: "FLOOR",
};

const UNIT_STATUS: Record<string, NonNullable<CreateProjectPayload["units"][number]["status"]>> = {
  available: "AVAILABLE",
  reserved: "RESERVED",
  sold: "SOLD",
  booked: "BOOKED",
  blocked: "BLOCKED",
};

/** Field unit type -> `product_attributes` (INT; kosong dikirim 0, luas dibulatkan). */
const ATTRIBUTES: { key: keyof UnitType; name: string; code: string; unit?: string }[] = [
  { key: "buildingArea", name: "Building Area", code: "building_area", unit: "m²" },
  { key: "surfaceArea", name: "Surface Area", code: "surface_area", unit: "m²" },
  { key: "floors", name: "Floors", code: "floors" },
  { key: "bedroom", name: "Bedroom", code: "bedroom" },
  { key: "bathroom", name: "Bathroom", code: "bathroom" },
  { key: "carport", name: "Carport", code: "carport" },
];

/** Isian lokasi step 1 -> kolom `products`; yang kosong tidak dikirim. */
const LOCATION_FIELDS = ["province", "city", "subdistrict", "village", "address", "postalCode", "mapsUrl"] as const;

/** Menyusun body `POST /api/products` dari state wizard. Melempar Error berisi pesan untuk user. */
export function buildProjectPayload(input: {
  info: ProjectInfo;
  unitTypes: UnitType[];
  nodes: LocationNode[];
  units: UnitItem[];
  facilityAttributeIds?: string[];
  includeEmpty?: boolean;
}): CreateProjectPayload {
  const { info, unitTypes, nodes, units } = input;

  const names = unitTypes.map((t) => t.name.trim());
  if (new Set(names).size !== names.length) throw new Error("Nama unit type tidak boleh sama.");

  const variants = unitTypes.map((t) => ({
    ...(t.id ? { id: t.id } : {}),
    name: t.name.trim(),
    typeVariants: t.variants.map((option) => ({
      ...(option.id ? { id: option.id } : {}),
      name: option.name.trim(),
      ...(option.code.trim() ? { code: option.code.trim() } : {}),
      basePrice: Math.round(Number(option.basePrice) || 0),
      stock: Math.round(Number(option.stock) || 0),
    })),
    attributes: ATTRIBUTES.map((a) => ({
      name: a.name,
      code: a.code,
      dataType: "NUMBER" as const,
      value: Math.round(Number(t[a.key]) || 0),
      ...(a.unit ? { unit: a.unit } : {}),
    })),
  }));

  const locations = nodes.map((n) => {
    const type = LEVEL_TYPE[n.level.trim().toLowerCase()];
    if (!type) throw new Error(`Level "${n.level}" belum didukung.`);
    return { ...(n.persistedId ? { id: n.persistedId } : {}), key: n.id, parentKey: n.parentId === ROOT ? null : n.parentId, name: n.name, type };
  });

  const payloadUnits = units.map((u) => {
    const variantIndex = names.indexOf(u.type.trim());
    if (variantIndex < 0) throw new Error(`Unit ${u.code}: tipe "${u.type}" tidak ada di Unit Type.`);
    const typeVariantIndex = unitTypes[variantIndex]?.variants.findIndex((option) => option.key === u.typeVariantKey) ?? -1;
    if (typeVariantIndex < 0) throw new Error(`Unit ${u.code}: varian "${u.typeVariantName}" tidak ada pada ${u.type}.`);
    return {
      ...(u.persistedId ? { id: u.persistedId } : {}),
      code: u.code,
      variantIndex,
      typeVariantIndex,
      // Unit yang menempel di akar (tanpa node) memakai akar proyek di backend.
      ...(nodes.some((n) => n.id === u.locationId) ? { locationKey: u.locationId } : {}),
      status: UNIT_STATUS[u.status.trim().toLowerCase()] ?? "AVAILABLE",
      isHook: u.hook === "Ya",
    };
  });

  return {
    name: info.name.trim(),
    code: info.code.trim(),
    ...(input.includeEmpty || info.description.trim() ? { description: info.description.trim() } : {}),
    ...Object.fromEntries(
      LOCATION_FIELDS.filter((k) => input.includeEmpty || info[k].trim()).map((k) => [k, info[k].trim()]),
    ),
    // "In Development" belum punya kolom; hanya Inactive yang dibedakan.
    isActive: info.status !== "Inactive",
    facilityAttributeIds: input.facilityAttributeIds ?? [],
    variants,
    locations,
    units: payloadUnits,
  };
}
