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
  /** Hanya untuk seeder; posisi hook kini dibuat sebagai varian. */
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

/** Checks that every unit points to an existing variant and location, with codes unique per location. */
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
    // Kolasi database tidak membedakan huruf besar/kecil.
    const key = JSON.stringify([unit.locationKey ?? null, unit.code.trim().toLowerCase()]);
    if (codes.has(key)) throw new Error(`Invalid units: Duplicate unit code ${unit.code} in the same location`);
    codes.add(key);
  }
}

/**
 * Unit hanya boleh berada di lokasi paling bawah, agar tetap tampil di wizard.
 * Yang diperiksa hanya penempatan baru; data lama yang terlanjur tetap dapat disimpan.
 */
export function assertUnitsOnLeaves(
  units: UnitInput[],
  locations: LocationInput[],
  isNew: { location: (location: LocationInput) => boolean; unit: (unit: UnitInput) => boolean }
) {
  const nameOf = new Map(locations.map((location) => [location.key, location.name]));
  const withUnits = new Set(units.flatMap((unit) => (unit.locationKey ? [unit.locationKey] : [])));
  const withChildren = new Set(locations.flatMap((location) => (location.parentKey ? [location.parentKey] : [])));
  for (const location of locations) {
    if (location.parentKey && withUnits.has(location.parentKey) && isNew.location(location)) {
      throw new Error(`Invalid location: ${nameOf.get(location.parentKey)} sudah memiliki unit, jadi tidak dapat diberi sub-lokasi.`);
    }
  }
  for (const unit of units) {
    if (unit.locationKey && withChildren.has(unit.locationKey) && isNew.unit(unit)) {
      throw new Error(`Invalid unit location: ${nameOf.get(unit.locationKey)} memiliki sub-lokasi, jadi unit ${unit.code} tidak dapat ditempatkan di sana.`);
    }
  }
}

const nameKey = (name: string) => name.trim().toLowerCase();

/** Nama lokasi unik di antara saudaranya; data lama yang terlanjur kembar tetap dapat disimpan. */
export function assertLocationNames(locations: LocationInput[], isChanged: (location: LocationInput) => boolean) {
  const siblings = new Map<string, LocationInput>();
  for (const location of locations) {
    const key = JSON.stringify([location.parentKey ?? null, nameKey(location.name)]);
    const other = siblings.get(key);
    if (other && (isChanged(location) || isChanged(other))) {
      throw new Error(`Invalid location name: "${location.name.trim()}" sudah ada di lokasi induk yang sama.`);
    }
    siblings.set(key, location);
  }
}

/**
 * Varian yang namanya dipakai varian lain sebelum penyimpanan (mis. nama ditukar) perlu nama sementara,
 * karena database menolak nama kembar di tengah jalan.
 */
export function swappedNames(current: { id: string; name: string }[], requested: { id?: string | undefined; name?: string | undefined }[]) {
  return current.filter((row) => {
    const next = requested.find((item) => item.id === row.id)?.name;
    return next !== undefined && nameKey(next) !== nameKey(row.name) &&
      requested.some((item) => item.id !== row.id && item.name !== undefined && nameKey(item.name) === nameKey(row.name));
  }).map((row) => row.id);
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
