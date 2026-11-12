import type { ProductCategoryType, ProductUnitStatus } from '@prisma/client';

/** A node of the location tree sent with a new product. `key` is a client-side id. */
export type LocationInput = {
  key: string;
  parentKey?: string | null;
  name: string;
  code?: string;
  type: ProductCategoryType;
};

/** A physical unit sent with a new product. Variant is referenced by its index in `variants`. */
export type UnitInput = {
  code: string;
  name?: string | null;
  variantIndex: number;
  locationKey?: string;
  status?: ProductUnitStatus;
};

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
export function assertUnits(units: UnitInput[], variantCount: number, locationKeys: Set<string>) {
  const codes = new Set<string>();
  for (const unit of units) {
    if (unit.variantIndex >= variantCount) {
      throw new Error(`Unit ${unit.code} refers to a variant that does not exist`);
    }
    if (unit.locationKey && !locationKeys.has(unit.locationKey)) {
      throw new Error(`Unit ${unit.code} refers to an unknown location`);
    }
    if (codes.has(unit.code)) throw new Error(`Duplicate unit code: ${unit.code}`);
    codes.add(unit.code);
  }
}
