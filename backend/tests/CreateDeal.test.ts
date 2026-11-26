import { jest } from '@jest/globals';
import { parseCreateDeal } from '../src/presentation/validation/crm/createDeal.js';
import { CreateDealUseCase } from '../src/usecases/deal/CreateDealUseCase.js';
import { checkDealDocuments } from '../src/usecases/deal/dealDocuments.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

const pdf = { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4'), originalname: 'ktp.pdf', size: 8 } as Express.Multer.File;
const fake = { ...pdf, buffer: Buffer.from('<html>') } as Express.Multer.File;
const requirement = (name: string, over = {}) => ({ name, fileTypes: ['PDF'], isRequired: true, paymentMethods: null, ...over });
const input = {
  leadId: 'l-1', unitId: 'u-1', amount: 500, paymentMethod: 'CASH' as const, expectedClosingDate: '2999-01-01',
  documents: [{ name: 'KTP', fileIndex: 0 }],
};
const owner = { tenantId: 't-1', userId: 'o-1', role: 'owner' };

function setup(over: { lead?: unknown; stage?: unknown; leadClaim?: number; deals?: number; unitClaim?: number; bank?: unknown; unit?: unknown } = {}) {
  const tx = {
    lead: { updateMany: fn({ count: over.leadClaim ?? 1 }) },
    productUnit: {
      findFirst: fn('unit' in over ? over.unit : { id: 'u-1', code: 'A-01', categoryId: 'c', typeVariantId: 'tv', typeVariant: { basePrice: 500n }, variant: { product: { name: 'Griya', isActive: true } } }),
      updateMany: fn({ count: over.unitClaim ?? 1 }),
    },
    productCategory: { findMany: fn([]) },
    productVariantPriceLog: { findMany: fn([]) },
    unitPriceAdjustment: { findMany: fn([]) },
    deal: { count: fn(over.deals ?? 0), create: jest.fn(async ({ data }: any) => data) },
    attachment: { createMany: fn({}) },
    leadActivity: { create: fn({}) },
    dealActivity: { create: fn({}) },
    auditLog: { create: fn({}) },
  };
  const prisma = {
    lead: {
      findFirst: fn('lead' in over ? over.lead : { id: 'l-1', customerId: 'c-1', assignedUserId: 's-1', sourceId: null, type: null }),
      findMany: fn([]),
      count: fn(0),
    },
    stage: { findFirst: fn('stage' in over ? over.stage : { id: 'st-1', evidences: [requirement('KTP')] }) },
    financingBank: { findFirst: fn(over.bank ?? null) },
    reservation: { findMany: fn([]) },
    $transaction: jest.fn(async (action: any) => action(tx)),
  };
  const storage = { upload: fn(), remove: fn(), getPublicUrl: (path: string) => ({ publicUrl: `http://x/${path}` }) };
  return { tx, prisma, storage, useCase: new CreateDealUseCase(prisma as never, storage as never) };
}

describe('CreateDealUseCase', () => {
  it('claims the lead and unit and saves the deal with its documents', async () => {
    const { tx, storage, useCase } = setup();
    const deal = (await useCase.create(owner, input, [pdf])) as any;
    expect(deal).toMatchObject({
      tenantId: 't-1', leadId: 'l-1', unitId: 'u-1', unitClaimed: true, stageId: 'st-1', assignedUserId: 's-1',
      amount: 500, currency: 'IDR', bankName: null,
    });
    expect(tx.lead.updateMany.mock.calls[0]![0].where).toEqual({
      id: 'l-1', tenantId: 't-1', isDeleted: false, archivedAt: null, converted: false,
    });
    expect(tx.productUnit.updateMany).toHaveBeenCalledWith({
      where: { id: 'u-1', tenantId: 't-1', status: 'AVAILABLE' }, data: { status: 'RESERVED' },
    });
    expect(tx.attachment.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      tenantId: 't-1', dealId: deal.id, documentName: 'KTP', documentStageId: 'st-1', uploadedById: 'o-1',
    });
    expect(storage.upload.mock.calls[0]![0]).toMatch(/^t-1\/deal\/.+\.pdf$/);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it.each([
    ['lead already taken', { leadClaim: 0 }, {}, /already converted/],
    ['lead with an older deal', { deals: 1 }, {}, /already converted/],
    ['unit already taken', { unitClaim: 0 }, {}, /Unit is not available/],
    ['unit of another tenant', { unit: null }, {}, /Unit not found/],
    ['unit of an inactive project', { unit: { code: 'A-01', variant: { product: { name: 'Griya', isActive: false } } } }, {}, /Invalid unit: project Griya sedang nonaktif/],
    ['price below the official price', {}, { amount: 499 }, /tidak boleh lebih rendah/],
  ])('removes uploaded files when the transaction fails: %s', async (_name, over, change, message) => {
    const { tx, storage, useCase } = setup(over);
    await expect(useCase.create(owner, { ...input, ...change }, [pdf])).rejects.toThrow(message);
    expect(tx.deal.create).not.toHaveBeenCalled();
    expect(storage.remove.mock.calls[0]![0]).toEqual([storage.upload.mock.calls[0]![0]]);
  });

  it.each([
    ['inaccessible lead', { lead: null }, {}, /Lead not found/],
    ['no default stage', { stage: null }, {}, /^No default Deal stage configured/],
    ['missing document', {}, { documents: [] }, /missing: KTP/],
    ['past closing date', {}, { expectedClosingDate: '2020-01-01' }, /Invalid expectedClosingDate/],
    ['KPR without bank', {}, { paymentMethod: 'KPR' as const }, /Bank is required/],
    ['bank of another tenant', {}, { paymentMethod: 'KPR' as const, financingBankId: 'b' }, /Financing bank not found/],
    ['cash with bank', {}, { financingBankId: 'b' }, /must be empty/],
  ])('rejects before uploading: %s', async (_name, over, change, message) => {
    const { prisma, storage, useCase } = setup(over);
    const data = { ...input, ...change };
    await expect(useCase.create(owner, data, data.documents.length ? [pdf] : [])).rejects.toThrow(message);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('limits sales to their own leads', async () => {
    const { prisma, tx, useCase } = setup();
    const sales = { tenantId: 't-1', userId: 's-1', role: 'member' };
    await useCase.create(sales, input, [pdf]);
    expect(prisma.lead.findFirst.mock.calls[0]![0].where).toMatchObject({ tenantId: 't-1', assignedUserId: 's-1' });
    expect(tx.lead.updateMany.mock.calls[0]![0].where).toMatchObject({ assignedUserId: 's-1' });
    await useCase.leadOptions(sales, { page: 1, limit: 10, search: 'siti' });
    expect(prisma.lead.findMany.mock.calls[0]![0].where).toMatchObject({
      tenantId: 't-1', assignedUserId: 's-1', converted: false, archivedAt: null, deals: { none: {} },
    });
  });
});

describe('checkDealDocuments', () => {
  const rows = [requirement('KTP'), requirement('Slip Gaji', { paymentMethods: ['KPR'] }), requirement('Foto', { fileTypes: ['IMAGE'], isRequired: false })];
  const doc = (name: string, fileIndex = 0) => ({ name, fileIndex });

  it('follows the payment method', () => {
    expect(checkDealDocuments(rows, 'CASH', [doc('KTP')], [pdf])).toHaveLength(1);
    expect(() => checkDealDocuments(rows, 'KPR', [doc('KTP')], [pdf])).toThrow(/missing: Slip Gaji/);
    expect(() => checkDealDocuments(rows, 'CASH', [doc('KTP'), doc('Slip Gaji', 1)], [pdf, pdf])).toThrow(/Invalid deal document/);
  });

  it('accepts the extra document and rejects bad files', () => {
    expect(checkDealDocuments(rows, 'CASH', [doc('KTP'), doc('Dokumen Tambahan', 1)], [pdf, pdf])).toHaveLength(2);
    expect(() => checkDealDocuments(rows, 'CASH', [doc('KTP'), doc('Foto', 1)], [pdf, pdf])).toThrow(/Unsupported file type: Foto/);
    expect(() => checkDealDocuments(rows, 'CASH', [doc('KTP')], [fake])).toThrow(/Unsupported file type/);
    expect(() => checkDealDocuments(rows, 'CASH', [doc('KTP')], [pdf, pdf])).toThrow(/Invalid deal documents/);
    expect(() => checkDealDocuments(rows, 'CASH', [doc('KTP'), doc('Dokumen Tambahan')], [pdf, pdf])).toThrow(/Invalid deal documents/);
  });
});

describe('parseCreateDeal', () => {
  const { documents, ...fields } = input;
  it('reads multipart payloads', () => {
    expect(parseCreateDeal({ payload: JSON.stringify({ ...fields, documents }) })).toEqual(input);
    expect(parseCreateDeal(fields).documents).toEqual([]);
  });

  it('rejects invalid input', () => {
    expect(() => parseCreateDeal({ payload: '{' })).toThrow(/Invalid deal payload/);
    expect(() => parseCreateDeal({ payload: 'null' })).toThrow();
    expect(() => parseCreateDeal({ ...fields, expectedClosingDate: '2026-02-31' })).toThrow(/valid date/);
    expect(() => parseCreateDeal({ ...fields, amount: 1.5 })).toThrow(/integer/);
    expect(() => parseCreateDeal({ ...fields, tenantId: 't-2' })).toThrow(/Unsupported field/);
    expect(() => parseCreateDeal({ ...fields, documents: [{ name: 'A', fileIndex: 99 }] })).toThrow(/fileIndex/);
  });
});
