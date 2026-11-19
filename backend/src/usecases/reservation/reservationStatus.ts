import type { PrismaClient, ProductUnitStatus, ReservationStatus } from '@prisma/client';

export function unitStatusForReservation(status: ReservationStatus): ProductUnitStatus {
  if (status === 'ACTIVE') return 'RESERVED';
  if (status === 'PAYMENT_PENDING') return 'BOOKED';
  if (status === 'COMPLETED') return 'SOLD';
  return 'AVAILABLE';
}

/**
 * Releases overdue reservations before availability is read. The guarded updates
 * make this safe when several requests/processes reconcile the same row.
 */
export async function expireOverdueReservations(prisma: PrismaClient, tenantId: string) {
  const overdue = await prisma.reservation.findMany({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'PAYMENT_PENDING'] },
      expiresAt: { not: null, lte: new Date() },
    },
    select: { id: true, unitId: true, status: true },
  });

  for (const reservation of overdue) {
    await prisma.$transaction(async (tx) => {
      const expired = await tx.reservation.updateMany({
        where: { id: reservation.id, tenantId, status: reservation.status },
        data: { status: 'EXPIRED' },
      });
      if (expired.count !== 1) return;
      await tx.productUnit.updateMany({
        where: {
          id: reservation.unitId,
          tenantId,
          status: unitStatusForReservation(reservation.status),
        },
        data: { status: 'AVAILABLE' },
      });
    });
  }
}
