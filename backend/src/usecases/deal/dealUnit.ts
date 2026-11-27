import type { Prisma, ProductUnitStatus } from '@prisma/client';
import { unitSellingPrices } from '../pricing/unitPrices.js';

type Tx = Prisma.TransactionClient;

export const dealUnitSelect = {
  stageId: true,
  statusId: true,
  unitId: true,
  unitClaimed: true,
  amount: true,
  leadId: true,
  stage: { select: { isWonStage: true } },
  status: { select: { isFailedStatus: true, isClosingStatus: true } },
} satisfies Prisma.DealSelect;

type DealUnitState = {
  stageId?: string | null;
  statusId?: string | null;
  unitId: string | null;
  unitClaimed: boolean;
  stage?: { isWonStage: boolean } | null;
  status?: { isFailedStatus: boolean; isClosingStatus: boolean } | null;
};

/** Unit yang dipegang Deal dan statusnya; null bila Lost, tanpa unit, atau Deal lama yang tidak memegang unit. */
function heldUnit(deal: DealUnitState): { unitId: string; status: ProductUnitStatus } | null {
  if (!deal.unitClaimed || !deal.unitId || deal.status?.isFailedStatus) return null;
  const won = deal.stage?.isWonStage || deal.status?.isClosingStatus;
  return { unitId: deal.unitId, status: won ? 'SOLD' : 'RESERVED' };
}

/** Mengunci baris Deal lalu membaca keadaannya, supaya perubahan bersamaan berjalan berurutan. */
export async function lockDeal(tx: Tx, id: string, tenantId: string) {
  const locked = await tx.deal.updateMany({ where: { id, tenantId }, data: { updatedAt: new Date() } });
  const deal = locked.count === 1 ? await tx.deal.findFirst({ where: { id, tenantId }, select: dealUnitSelect }) : null;
  if (!deal) throw new Error('Deal not found');
  return deal;
}

/** Menyamakan status unit dengan keadaan Deal. `after` null berarti Deal dihapus. */
export async function syncDealUnit(tx: Tx, tenantId: string, before: DealUnitState, after: DealUnitState | null) {
  const from = heldUnit(before);
  const to = after && heldUnit(after);
  if (from && to && from.unitId === to.unitId) {
    if (from.status === to.status) return;
    const changed = await tx.productUnit.updateMany({
      where: { id: to.unitId, tenantId, status: { in: ['RESERVED', 'SOLD'] } },
      data: { status: to.status },
    });
    if (changed.count !== 1) throw new Error('Deal unit status conflict');
    return;
  }
  if (to) {
    const claimed = await tx.productUnit.updateMany({
      where: { id: to.unitId, tenantId, status: 'AVAILABLE' },
      data: { status: to.status },
    });
    if (claimed.count !== 1) throw new Error('Unit is not available');
  }
  if (from) {
    const released = await tx.productUnit.updateMany({
      where: { id: from.unitId, tenantId, status: { in: ['RESERVED', 'SOLD'] } },
      data: { status: 'AVAILABLE' },
    });
    if (released.count !== 1) throw new Error('Deal unit status conflict');
  }
}

/** Unit dari project nonaktif tidak dijual, jadi tidak boleh dipilih untuk Deal. */
export async function assertUnitSellable(tx: Tx, tenantId: string, unitId: string) {
  const unit = await tx.productUnit.findFirst({
    where: { id: unitId, tenantId },
    select: { code: true, variant: { select: { product: { select: { name: true, isActive: true } } } } },
  });
  if (!unit) throw new Error('Unit not found');
  if (!unit.variant.product.isActive) {
    throw new Error(`Invalid unit: project ${unit.variant.product.name} sedang nonaktif, unit ${unit.code} tidak dapat dipilih untuk deal.`);
  }
}

/** Harga Deal minimal harga jual resmi unit hari ini. */
export async function assertDealPrice(tx: Tx, tenantId: string, unitId: string, amount: number) {
  const unit = await tx.productUnit.findFirst({
    where: { id: unitId, tenantId },
    select: { id: true, code: true, categoryId: true, typeVariantId: true, typeVariant: { select: { basePrice: true } } },
  });
  if (!unit) throw new Error('Unit not found');
  const minimum = (await unitSellingPrices(tx, tenantId, [unit])).get(unit.id) ?? unit.typeVariant.basePrice;
  if (amount < Number(minimum)) {
    throw new Error(
      `Harga deal unit ${unit.code} tidak boleh lebih rendah dari harga jual resmi Rp ${new Intl.NumberFormat('id-ID').format(minimum)}.`
    );
  }
}
