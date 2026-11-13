/** Aturan perhitungan harga jual unit. Fungsi murni, tanpa akses database. */

export const PRICE_TIME_ZONE = 'Asia/Jakarta';

export type PriceLogRow = {
  id: string;
  variantId: string;
  categoryId: string | null;
  adjustmentPrice: bigint;
  effectiveStart: Date;
  endDate: Date | null;
  reason: string;
};

export type AdjustmentRow = {
  unitId: string;
  amount: bigint;
  effectiveDate: Date;
  approvedAt: Date | null;
};

/** Today in the pricing time zone as YYYY-MM-DD. */
export function todayInPriceZone(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PRICE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Converts YYYY-MM-DD to the Date Prisma uses for a DATE column. */
export function toDateValue(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Formats a DATE column value back to YYYY-MM-DD. */
export function fromDateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** The category and all its ancestors, nearest first. */
export function ancestorChain(categoryId: string, parentOf: Map<string, string | null>) {
  const chain: string[] = [];
  let current: string | null | undefined = categoryId;
  while (current && !chain.includes(current)) {
    chain.push(current);
    current = parentOf.get(current);
  }
  return chain;
}

/** A price log is active when the date falls inside its period. */
export function isLogActive(log: Pick<PriceLogRow, 'effectiveStart' | 'endDate'>, day: string) {
  const start = fromDateValue(log.effectiveStart);
  const end = log.endDate ? fromDateValue(log.endDate) : null;
  return start <= day && (end === null || end >= day);
}

/** Price logs of the variant that apply to a unit located in the given chain. */
export function activeLogsForUnit(
  logs: PriceLogRow[],
  variantId: string,
  locationChain: string[],
  day: string
) {
  return logs.filter(
    (log) =>
      log.variantId === variantId &&
      (log.categoryId === null || locationChain.includes(log.categoryId)) &&
      isLogActive(log, day)
  );
}

/**
 * The adjustment in force on the date: the approved row with the latest
 * effective date (then latest approval). Rows must already be APPROVED.
 */
export function activeAdjustment<T extends AdjustmentRow>(rows: T[], day: string): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (fromDateValue(row.effectiveDate) > day) continue;
    if (
      !best ||
      row.effectiveDate > best.effectiveDate ||
      (row.effectiveDate.getTime() === best.effectiveDate.getTime() &&
        (row.approvedAt?.getTime() ?? 0) > (best.approvedAt?.getTime() ?? 0))
    ) {
      best = row;
    }
  }
  return best;
}

export function sumLogs(logs: Pick<PriceLogRow, 'adjustmentPrice'>[]) {
  return logs.reduce((total, log) => total + log.adjustmentPrice, BigInt(0));
}

export function sellingPrice(basePrice: bigint, logTotal: bigint, adjustment: bigint) {
  return basePrice + logTotal + adjustment;
}

/**
 * Approval penyesuaian di bawah harga minimum. Dinonaktifkan pada tahap awal:
 * semua penyesuaian langsung APPROVED. Ubah ke true untuk menyalakan alur approval.
 */
export const PRICE_APPROVAL_ENABLED = false;

/** Decides whether a new adjustment needs approval. */
export function needsApproval(
  priceAfter: bigint,
  minPrice: bigint | null,
  approvalEnabled = PRICE_APPROVAL_ENABLED
) {
  return approvalEnabled && minPrice !== null && priceAfter < minPrice;
}
