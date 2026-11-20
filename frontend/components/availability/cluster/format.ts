export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace("Rp", "Rp ");
}

const HIERARCHY_LABEL: Record<string, string> = {
  PROJECT: "Proyek",
  CATEGORY: "Kategori",
  CLUSTER: "Cluster",
  ZONE: "Zona",
  BLOCK: "Blok",
  TOWER: "Tower",
  FLOOR: "Lantai",
  WAREHOUSE: "Gudang",
  RACK: "Rak",
  BIN: "Bin",
};

export function formatHierarchyLevel(level: string) {
  return (
    HIERARCHY_LABEL[level] ??
    level
      .toLocaleLowerCase("id-ID")
      .replaceAll("_", " ")
      .replace(/(^|\s)\S/g, (character) => character.toLocaleUpperCase("id-ID"))
  );
}

export function formatUnitType(type: string) {
  const normalized = type.trim();
  if (!normalized) return "—";
  return /^type\b/i.test(normalized) ? normalized : `Type ${normalized}`;
}
