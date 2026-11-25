import type { ProjectTypeRow } from "@/hooks/use-project-types";
import { SPEC_FIELDS } from "../../lib/unit-specs";

const SPEC_LABELS: Record<(typeof SPEC_FIELDS)[number]["code"], string> = {
  building_area: "Luas Bangunan",
  surface_area: "Luas Tanah",
  floors: "Lantai",
  bedroom: "Kamar Tidur",
  bathroom: "Kamar Mandi",
  carport: "Carport",
};

/** Sel satu kolom yang digabung dari baris `start` sampai `end` (indeks data, mulai 0). */
export type ExportMerge = { column: number; start: number; end: number };

const PROJECT_COLUMNS = [0, 1, 2];
const TYPE_COLUMN = 3;

/** Baris ekspor: satu baris per varian, kolom proyek dan tipe digabung. */
export function buildTypeExport(types: ProjectTypeRow[]) {
  const columns = [
    "Project",
    "Kode Project",
    "Lokasi",
    "Tipe",
    "Varian",
    ...SPEC_FIELDS.map(({ code }) => SPEC_LABELS[code]),
    "Unit Dibuat",
  ];
  const compare = (a: string, b: string) => a.localeCompare(b, "id-ID", { numeric: true });
  // projectId memisahkan dua proyek yang namanya sama.
  const sorted = [...types].sort(
    (a, b) => compare(a.projectName, b.projectName) || compare(a.projectId, b.projectId) || compare(a.name, b.name),
  );

  const rows: (string | number)[][] = [];
  const merges: ExportMerge[] = [];
  let projectId: string | null = null;
  let projectMerges: ExportMerge[] = [];
  for (const type of sorted) {
    if (type.typeVariants.length === 0) continue;
    const start = rows.length;
    type.typeVariants.forEach((variant, index) => {
      const first = index === 0;
      const firstOfProject = first && type.projectId !== projectId;
      rows.push([
        ...(firstOfProject ? [type.projectName, type.projectCode, type.location] : ["", "", ""]),
        first ? type.name : "",
        variant.name,
        ...SPEC_FIELDS.map(({ code }) => Number(variant.specs[code]) || 0),
        variant.unitCount ?? 0,
      ]);
    });
    const end = rows.length - 1;
    if (type.projectId !== projectId) {
      projectId = type.projectId;
      projectMerges = PROJECT_COLUMNS.map((column) => ({ column, start, end }));
      merges.push(...projectMerges);
    }
    for (const merge of projectMerges) merge.end = end;
    merges.push({ column: TYPE_COLUMN, start, end });
  }
  return { columns, rows, merges };
}
