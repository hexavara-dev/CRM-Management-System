import { jest } from '@jest/globals';
import { ReservationUseCase } from '../src/usecases/reservation/ReservationUseCase.js';

describe('ReservationUseCase tenant isolation', () => {
  it('does not return a reservation outside the authenticated tenant', async () => {
    const reservation = {
      findFirst: jest.fn().mockResolvedValue(null),
    };
    const useCase = new ReservationUseCase({ reservation } as never);

    await expect(useCase.get('reservation-1', 'tenant-1')).rejects.toThrow('Reservation not found');

    expect(reservation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'reservation-1', tenantId: 'tenant-1' } })
    );
  });

  it('rejects an expiration date before the reservation date', async () => {
    const prisma = { $transaction: jest.fn() };
    const useCase = new ReservationUseCase(prisma as never);
    const reservedAt = new Date('2026-11-13T10:00:00.000Z');
    const expiresAt = new Date('2026-11-13T09:00:00.000Z');

    await expect(
      useCase.create(
        {
          unitId: 'unit-1',
          customerName: 'Customer',
          price: 500_000_000,
          reservedAt,
          expiresAt,
        },
        'tenant-1',
        'sales-1'
      )
    ).rejects.toThrow('expiresAt must be after reservedAt');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
