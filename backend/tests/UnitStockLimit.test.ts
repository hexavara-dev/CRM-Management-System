import { jest } from '@jest/globals';
import { ProductUseCase } from '../src/usecases/product/ProductUseCase.js';
import { assertUnitsWithinStock } from '../src/usecases/product/catalogStructure.js';
import { mapHttpError } from '../src/infrastructure/utils/HttpErrorMapper.js';

const unit = (code: string, variantIndex: number) => ({ code, variantIndex, locationKey: 'b' });

describe('assertUnitsWithinStock', () => {
  it('allows units up to the total slots (stock) of each type', () => {
    expect(() => assertUnitsWithinStock([unit('A-01', 0), unit('A-02', 0), unit('A-03', 0)], [{ name: 'Type 50', stock: 3 }])).not.toThrow();
  });

  it('rejects units beyond the total slots with a 400-mapped message', () => {
    const units = [unit('A-01', 0), unit('A-02', 0), unit('A-03', 0), unit('A-04', 0)];
    let error: unknown;
    try {
      assertUnitsWithinStock(units, [{ name: 'Type 50', stock: 3 }]);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/Type 50/);
    expect(mapHttpError(error).status).toBe(400);
  });

  it('counts slots per type independently', () => {
    expect(() => assertUnitsWithinStock([unit('A-01', 0), unit('B-01', 1), unit('B-02', 1)], [
      { name: 'Type 36', stock: 1 },
      { name: 'Type 45', stock: 1 },
    ])).toThrow(/Type 45/);
  });
});

describe('ProductUseCase.create unit slots', () => {
  it('rejects a project whose units exceed a type stock before writing anything', async () => {
    const prisma = { $transaction: jest.fn() };
    const useCase = new ProductUseCase(prisma as never);
    await expect(useCase.create('t-1', {
      name: 'Citraland',
      code: 'CL',
      variants: [{ name: 'Type 50', basePrice: 1, stock: 3 }],
      locations: [{ key: 'b', name: 'Blok A', type: 'BLOCK' }],
      units: [unit('A-01', 0), unit('A-02', 0), unit('A-03', 0), unit('A-04', 0)],
    })).rejects.toThrow(/Type 50/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
