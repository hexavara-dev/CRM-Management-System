import { jest } from '@jest/globals';
import { ReservationUseCase } from '../src/usecases/reservation/ReservationUseCase.js';
import { unitStatusForReservation } from '../src/usecases/reservation/reservationStatus.js';

const pricing = (adjustments: unknown[] = []) => ({
  productCategory: { findMany: jest.fn().mockResolvedValue([{ id: 'block', parentId: null }]) },
  productVariantPriceLog: { findMany: jest.fn().mockResolvedValue([]) },
  unitPriceAdjustment: { findMany: jest.fn().mockResolvedValue(adjustments) },
});

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
          categoryId: 'block',
          typeVariantId: 'tv-1',
          typeVariant: { basePrice: 500_000_000n },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      ...pricing(),
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
    ).rejects.toThrow('tidak boleh lebih rendah dari harga jual resmi');
  });

  it('accepts the official price when Pricing lowers it below the base price', async () => {
    const run = (price: number) => {
      const tx = {
        productUnit: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'unit-1', code: 'A-01', categoryId: 'block', typeVariantId: 'tv-1', typeVariant: { basePrice: 500_000_000n },
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        ...pricing([{ unitId: 'unit-1', amount: -20_000_000n, effectiveDate: new Date('2020-01-01'), approvedAt: null }]),
        user: { findFirst: jest.fn().mockResolvedValue({ id: 'sales-1' }) },
      };
      const prisma = { $transaction: jest.fn(async (action: (client: typeof tx) => unknown) => action(tx)) };
      return new ReservationUseCase(prisma as never).create({ unitId: 'unit-1', customerName: 'C', price }, 'tenant-1', 'sales-1');
    };
    // Lolos pemeriksaan harga, lalu berhenti di klaim unit.
    await expect(run(480_000_000)).rejects.toThrow('Unit is not available');
    await expect(run(479_999_999)).rejects.toThrow('tidak boleh lebih rendah dari harga jual');
  });

  it('rejects the base price when Pricing raised the unit', async () => {
    const tx = {
      productUnit: { findFirst: jest.fn().mockResolvedValue({ id: 'unit-1', code: 'A-01', categoryId: 'block', typeVariantId: 'tv-1', typeVariant: { basePrice: 310n } }) },
      ...pricing([{ unitId: 'unit-1', amount: 100n, effectiveDate: new Date('2020-01-01'), approvedAt: null }]),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'sales-1' }) },
    };
    const prisma = { $transaction: jest.fn(async (action: (client: typeof tx) => unknown) => action(tx)) };
    await expect(
      new ReservationUseCase(prisma as never).create({ unitId: 'unit-1', customerName: 'C', price: 310 }, 'tenant-1', 'sales-1')
    ).rejects.toThrow('harga jual resmi');
  });

  it('keeps an agreed price on edit but checks a new price or a new unit', async () => {
    const run = (dto: Record<string, unknown>) => {
      const tx = {
        reservation: {
          findFirst: jest.fn().mockResolvedValue({ id: 'r-1', unitId: 'unit-1', status: 'ACTIVE', price: 400n }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        productUnit: {
          findFirst: jest.fn().mockResolvedValue({ id: 'unit-2', code: 'A-02', categoryId: 'block', typeVariantId: 'tv-1', typeVariant: { basePrice: 500n } }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        ...pricing(),
      };
      const prisma = { $transaction: jest.fn(async (action: (client: typeof tx) => unknown) => action(tx)) };
      return new ReservationUseCase(prisma as never).update('r-1', 'tenant-1', dto as never);
    };
    // Lolos pemeriksaan harga, lalu berhenti di penyimpanan.
    await expect(run({ price: 400, customerName: 'Baru' })).rejects.toThrow('Reservation status conflict');
    await expect(run({ price: 399 })).rejects.toThrow('harga jual resmi');
    await expect(run({ unitId: 'unit-2' })).rejects.toThrow('harga jual resmi');
  });

  it('maps reservation lifecycle to the authoritative unit status', () => {
    expect(unitStatusForReservation('ACTIVE')).toBe('RESERVED');
    expect(unitStatusForReservation('PAYMENT_PENDING')).toBe('BOOKED');
    expect(unitStatusForReservation('CANCELLED')).toBe('AVAILABLE');
    expect(unitStatusForReservation('EXPIRED')).toBe('AVAILABLE');
    expect(unitStatusForReservation('COMPLETED')).toBe('SOLD');
  });
});
