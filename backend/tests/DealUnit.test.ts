import { jest } from '@jest/globals';
import { DealUseCases } from '../src/usecases/deal/DealUseCases.js';
import { syncDealUnit } from '../src/usecases/deal/dealUnit.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);
const open = { unitId: 'u-1', unitClaimed: true, stage: { isWonStage: false }, status: null };
const won = { ...open, stage: { isWonStage: true } };
const closed = { ...open, status: { isFailedStatus: false, isClosingStatus: true } };
const lost = { ...open, status: { isFailedStatus: true, isClosingStatus: false } };
const legacy = { ...open, unitClaimed: false };

async function moves(before: any, after: any, count = 1) {
  const updateMany = fn({ count });
  await syncDealUnit({ productUnit: { updateMany } } as never, 't-1', before, after);
  return updateMany.mock.calls.map(([{ where, data }]: any) => {
    expect(where.tenantId).toBe('t-1');
    return `${where.id}:${typeof where.status === 'string' ? where.status : 'HELD'}>${data.status}`;
  });
}

describe('syncDealUnit', () => {
  it.each([
    ['won stage', open, won, ['u-1:HELD>SOLD']],
    ['closing status', open, closed, ['u-1:HELD>SOLD']],
    ['back from won', won, open, ['u-1:HELD>RESERVED']],
    ['lost', open, lost, ['u-1:HELD>AVAILABLE']],
    ['reopened', lost, open, ['u-1:AVAILABLE>RESERVED']],
    ['deleted', won, null, ['u-1:HELD>AVAILABLE']],
    ['deleted after lost', lost, null, []],
    ['changed unit', open, { ...open, unitId: 'u-2' }, ['u-2:AVAILABLE>RESERVED', 'u-1:HELD>AVAILABLE']],
    ['no change', open, open, []],
    ['older deal won', legacy, { ...won, unitClaimed: false }, []],
    ['older deal deleted', legacy, null, []],
  ])('%s', async (_name, before, after, expected) => {
    expect(await moves(before, after)).toEqual(expected);
  });

  it('fails when someone else took the unit', async () => {
    await expect(moves(lost, open, 0)).rejects.toThrow('Unit is not available');
    await expect(moves(open, won, 0)).rejects.toThrow(/conflict/);
    await expect(moves(open, null, 0)).rejects.toThrow(/conflict/);
  });
});

function setup(over: Record<string, unknown> = {}) {
  const current = { id: 'd-1', tenantId: 't-1', leadId: 'l-1', amount: 500, stageId: 's-1', payments: [], ...open, ...over };
  const tx = {
    record: { updateMany: fn({}) },
    attachment: { deleteMany: fn({}) },
    deal: {
      updateMany: fn({ count: 1 }),
      findFirst: fn(current),
      update: jest.fn(async ({ data }: any) => ({ ...current, ...data })),
      deleteMany: fn({ count: 1 }),
      count: fn(0),
    },
    lead: { updateMany: fn({ count: 1 }) },
    productUnit: {
      updateMany: fn({ count: 1 }),
      findFirst: fn({ id: 'u', code: 'A-01', categoryId: 'c', typeVariantId: 'tv', typeVariant: { basePrice: 500n }, variant: { product: { name: 'Griya', isActive: over.projectActive ?? true } } }),
    },
    productCategory: { findMany: fn([]) },
    productVariantPriceLog: { findMany: fn([]) },
    unitPriceAdjustment: { findMany: fn([]) },
    dealActivity: { create: fn({}) },
    auditLog: { create: fn({}) },
  };
  const prisma = {
    deal: { findFirst: fn(current) },
    productUnit: { findFirst: fn({ id: 'u-2' }) },
    reservation: { findMany: fn([]) },
    $transaction: jest.fn(async (action: any) => action(tx)),
  };
  return { tx, useCases: new DealUseCases({} as never, undefined, undefined, undefined, undefined, undefined, prisma as never) };
}

describe('deal updates', () => {
  it('moves the unit and checks the price of the new unit', async () => {
    const { tx, useCases } = setup();
    await useCases.updateDeal('d-1', { unitId: 'u-2' }, 't-1');
    expect(tx.productUnit.updateMany).toHaveBeenCalledTimes(2);
    const low = setup({ amount: 400 });
    await expect(low.useCases.updateDeal('d-1', { unitId: 'u-2' }, 't-1')).rejects.toThrow(/tidak boleh lebih rendah/);
  });

  it('rejects moving to a unit of an inactive project', async () => {
    const { tx, useCases } = setup({ projectActive: false });
    await expect(useCases.updateDeal('d-1', { unitId: 'u-2' }, 't-1')).rejects.toThrow(/Invalid unit: project Griya sedang nonaktif/);
    expect(tx.productUnit.updateMany).not.toHaveBeenCalled();
  });

  it('keeps an agreed price but checks a new one', async () => {
    const same = setup({ amount: 400 });
    await same.useCases.updateDeal('d-1', { amount: 400, unitId: 'u-1' }, 't-1');
    expect(same.tx.productUnit.findFirst).not.toHaveBeenCalled();
    await expect(setup().useCases.updateDeal('d-1', { amount: 499 }, 't-1')).rejects.toThrow(/tidak boleh lebih rendah/);
    await setup({ unitClaimed: false }).useCases.updateDeal('d-1', { amount: 1 }, 't-1');
  });

  it('does not move a deal to another lead', async () => {
    await expect(setup().useCases.updateDeal('d-1', { leadId: 'l-2' }, 't-1')).rejects.toThrow(/Invalid leadId/);
  });

  it('releases the unit and reopens the lead on delete', async () => {
    const { tx, useCases } = setup();
    await useCases.deleteDeal('d-1', 't-1');
    expect(tx.productUnit.updateMany.mock.calls[0]![0].data).toEqual({ status: 'AVAILABLE' });
    expect(tx.lead.updateMany).toHaveBeenCalledWith({
      where: { id: 'l-1', tenantId: 't-1' }, data: { converted: false, convertedDate: null },
    });
    const other = setup();
    other.tx.deal.count.mockResolvedValue(1);
    await other.useCases.deleteDeal('d-1', 't-1');
    expect(other.tx.lead.updateMany).not.toHaveBeenCalled();
  });
});
