import type { Prisma, PrismaClient } from '@prisma/client';
import {
  activeAdjustment,
  activeLogsForUnit,
  ancestorChain,
  sellingPrice,
  sumLogs,
  toDateValue,
  todayInPriceZone,
  type AdjustmentRow,
  type PriceLogRow,
} from './priceRules.js';

type Db = PrismaClient | Prisma.TransactionClient;
export type PricedUnit = {
  id: string;
  categoryId: string;
  typeVariantId: string;
  typeVariant: { basePrice: bigint };
};

/**
 * Satu-satunya perhitungan harga jual unit:
 * harga dasar varian + penyesuaian varian/lokasi + penyesuaian unit yang berlaku.
 */
export function computeUnitPrices<U extends PricedUnit, A extends AdjustmentRow>(
  units: U[],
  parents: Map<string, string | null>,
  logs: PriceLogRow[],
  adjustments: A[],
  day: string
) {
  const adjustmentsByUnit = new Map<string, A[]>();
  for (const row of adjustments) {
    const rows = adjustmentsByUnit.get(row.unitId);
    if (rows) rows.push(row);
    else adjustmentsByUnit.set(row.unitId, [row]);
  }
  return units.map((unit) => {
    const { basePrice } = unit.typeVariant;
    const activeLogs = activeLogsForUnit(logs, unit.typeVariantId, ancestorChain(unit.categoryId, parents), day);
    const adjustment = activeAdjustment(adjustmentsByUnit.get(unit.id) ?? [], day);
    const logTotal = sumLogs(activeLogs);
    const amount = adjustment?.amount ?? BigInt(0);
    return { unit, activeLogs, adjustment, basePrice, logTotal, amount, price: sellingPrice(basePrice, logTotal, amount) };
  });
}

export async function loadCategoryParents(db: Db, tenantId: string) {
  const rows = await db.productCategory.findMany({ where: { tenantId }, select: { id: true, parentId: true } });
  return new Map(rows.map((row) => [row.id, row.parentId]));
}

export async function loadPriceLogs(db: Db, tenantId: string, units: PricedUnit[]): Promise<PriceLogRow[]> {
  const typeVariantIds = [...new Set(units.map((unit) => unit.typeVariantId))];
  if (typeVariantIds.length === 0) return [];
  return db.productVariantPriceLog.findMany({
    where: { tenantId, typeVariantId: { in: typeVariantIds } },
    select: {
      id: true,
      typeVariantId: true,
      categoryId: true,
      adjustmentPrice: true,
      effectiveStart: true,
      endDate: true,
      reason: true,
    },
  });
}

/** Harga jual hari ini (zona waktu harga) per ID unit, dengan beberapa query sekaligus. */
export async function unitSellingPrices(db: Db, tenantId: string, units: PricedUnit[], day = todayInPriceZone()) {
  if (units.length === 0) return new Map<string, bigint>();
  const [parents, logs, adjustments] = await Promise.all([
    loadCategoryParents(db, tenantId),
    loadPriceLogs(db, tenantId, units),
    db.unitPriceAdjustment.findMany({
      where: {
        tenantId,
        unitId: { in: units.map((unit) => unit.id) },
        status: 'APPROVED',
        effectiveDate: { lte: toDateValue(day) },
      },
      select: { unitId: true, amount: true, effectiveDate: true, approvedAt: true },
    }),
  ]);
  return new Map(computeUnitPrices(units, parents, logs, adjustments, day).map(({ unit, price }) => [unit.id, price]));
}
