import { jest } from '@jest/globals';
import { ReservationUseCase } from '../src/usecases/reservation/ReservationUseCase.js';
import { unitStatusForReservation } from '../src/usecases/reservation/reservationStatus.js';

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

  it('rejects a reservation price below the unit base price', async () => {
    const tx = {
      productUnit: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'unit-1',
          code: 'A-01',
          typeVariant: { basePrice: 500_000_000n },
        }),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'sales-1' }) },
    };
    const prisma = {
      $transaction: jest.fn(async (action: (client: typeof tx) => unknown) => action(tx)),
    };
    const useCase = new ReservationUseCase(prisma as never);

    await expect(
      useCase.create(
        { unitId: 'unit-1', customerName: 'Customer', price: 499_999_999 },
        'tenant-1',
        'sales-1'
      )
    ).rejects.toThrow('tidak boleh lebih rendah dari harga dasar');
  });

  it('maps reservation lifecycle to the authoritative unit status', () => {
    expect(unitStatusForReservation('ACTIVE')).toBe('RESERVED');
    expect(unitStatusForReservation('PAYMENT_PENDING')).toBe('BOOKED');
    expect(unitStatusForReservation('CANCELLED')).toBe('AVAILABLE');
    expect(unitStatusForReservation('EXPIRED')).toBe('AVAILABLE');
    expect(unitStatusForReservation('COMPLETED')).toBe('SOLD');
  });
});
