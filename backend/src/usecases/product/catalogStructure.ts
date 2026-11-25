import type { ProductCategoryType, ProductUnitStatus } from '@prisma/client';

/** A node of the location tree sent with a new product. `key` is a client-side id. */
export type LocationInput = {
  id?: string;
  key: string;
  parentKey?: string | null;
  name: string;
  code?: string;
  type: ProductCategoryType;
};

/** A physical unit sent with a new product. Variant is referenced by its index in `variants`. */
export type UnitInput = {
  id?: string;
  code: string;
  name?: string | null;
  variantIndex: number;
  /** Index of the dynamic child variant within the selected unit type. */
  typeVariantIndex?: number;
  locationKey?: string;
  status?: ProductUnitStatus;
  isHook?: boolean;
};

/** Urutan nama lokasi dengan angka dibaca sebagai angka: Lantai 2 sebelum Lantai 10. */
export const byLocationName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' });

/** Orders locations parent-first. Rejects duplicate keys, unknown parents and cycles. */
export function orderLocations(locations: LocationInput[]): LocationInput[] {
  const byKey = new Map<string, LocationInput>();
  for (const location of locations) {
    if (byKey.has(location.key)) throw new Error(`Duplicate location key: ${location.key}`);
    byKey.set(location.key, location);
  }

  const ordered: LocationInput[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (location: LocationInput) => {
    const current = state.get(location.key);
    if (current === 'done') return;
    if (current === 'visiting') throw new Error('Location hierarchy contains a cycle');
    state.set(location.key, 'visiting');
    if (location.parentKey) {
      const parent = byKey.get(location.parentKey);
      if (!parent) throw new Error(`Unknown parentKey: ${location.parentKey}`);
      visit(parent);
    }
    state.set(location.key, 'done');
    ordered.push(location);
  };
  locations.forEach(visit);
  return ordered;
}

/** Checks that every unit points to an existing variant and location, with unique codes. */
export function assertUnits(units: UnitInput[], variantCounts: number[] | number, locationKeys: Set<string>) {
  const counts = Array.isArray(variantCounts) ? variantCounts : Array.from({ length: variantCounts }, () => 1);
  const codes = new Set<string>();
  for (const unit of units) {
    if (unit.variantIndex < 0 || unit.variantIndex >= counts.length) {
      throw new Error(`Unit ${unit.code} refers to a variant that does not exist`);
    }
    const typeVariantIndex = unit.typeVariantIndex ?? 0;
    if (typeVariantIndex < 0 || typeVariantIndex >= (counts[unit.variantIndex] ?? 0)) {
      throw new Error(`Unit ${unit.code} refers to a type variant that does not exist`);
    }
    if (unit.locationKey && !locationKeys.has(unit.locationKey)) {
      throw new Error(`Unit ${unit.code} refers to an unknown location`);
    }
    if (codes.has(unit.code)) throw new Error(`Duplicate unit code: ${unit.code}`);
    codes.add(unit.code);
  }
}

/** Jumlah unit fisik per tipe tidak boleh melebihi total slot (stock) tipe tersebut. */
export function assertUnitsWithinStock(
  units: UnitInput[],
  variants: { name?: string | undefined; stock?: number; typeVariants?: { name?: string | undefined; stock: number }[] }[],
) {
  variants.forEach((variant, variantIndex) => {
    const options = variant.typeVariants ?? [{ name: 'Default', stock: variant.stock ?? 0 }];
    options.forEach((typeVariant, typeVariantIndex) => {
      const count = units.filter((unit) =>
        unit.variantIndex === variantIndex && (unit.typeVariantIndex ?? 0) === typeVariantIndex
      ).length;
      if (count > typeVariant.stock) {
        const label = `${variant.name ?? `Type ${variantIndex + 1}`} / ${typeVariant.name ?? `Variant ${typeVariantIndex + 1}`}`;
        throw new Error(`Invalid unit count: ${label} has ${count} units, exceeding its total of ${typeVariant.stock} slots`);
      }
    });
  });
}
