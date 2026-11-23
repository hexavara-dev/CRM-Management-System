import { jest } from '@jest/globals';
import { LeadCampaignUseCase } from '../src/usecases/crm/LeadCampaignUseCase.js';
import {
  parseLeadCampaignFilters,
  validateLeadCampaignCreate,
  validateLeadCampaignUpdate,
} from '../src/presentation/validation/crm/leadCampaign.js';

type Mock = jest.Mock<(...args: any[]) => any>;
const fn = (value?: unknown): Mock => jest.fn<(...args: any[]) => any>().mockResolvedValue(value);

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

const row = (over: Record<string, unknown> = {}) => ({
  id: 'c-1',
  sourceId: 'src-1',
  name: 'Promo Oktober',
  description: null,
  startDate: day('2026-10-01'),
  endDate: day('2026-10-31'),
  isActive: true,
  ...over,
});

function prisma(over: { found?: unknown; source?: unknown; duplicate?: unknown; used?: number } = {}) {
  return {
    lead: { count: fn(over.used ?? 0) },
    source: { findFirst: fn('source' in over ? over.source : { id: 'src-1' }) },
    leadCampaign: {
      findMany: fn([row()]),
      // Dengan `name`: cek duplikat; tanpa `name`: cek campaign ada.
      findFirst: jest.fn<(...args: any[]) => any>().mockImplementation(async (args: { where: { name?: string } }) =>
        args.where.name !== undefined ? (over.duplicate ?? null) : 'found' in over ? over.found : row()
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c-new', ...data })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => row(data)),
      delete: fn({}),
    },
  };
}

describe('LeadCampaignUseCase', () => {
  it('lists campaigns of the tenant by source and returns plain dates', async () => {
    const db = prisma();
    const [campaign] = await new LeadCampaignUseCase(db as never).list('t-1', { sourceId: 'src-1', isActive: true });
    expect(db.leadCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1', sourceId: 'src-1', isActive: true } })
    );
    expect(campaign).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-31' });
  });

  it('lists only active campaigns of active sources running today when available', async () => {
    const db = prisma();
    await new LeadCampaignUseCase(db as never).list('t-1', { available: true }, new Date('2026-11-20T10:00:00Z'));
    const today = day('2026-11-20');
    expect(db.leadCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 't-1',
          isActive: true,
          source: { isActive: true },
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: today } }] },
            { OR: [{ endDate: null }, { endDate: { gte: today } }] },
          ],
        },
      })
    );
  });

  it('creates a campaign without a period', async () => {
    const db = prisma();
    const campaign = await new LeadCampaignUseCase(db as never).create('t-1', { sourceId: 'src-1', name: 'Launching' });
    expect(db.source.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'src-1', tenantId: 't-1', type: 'lead' } })
    );
    expect(campaign).toMatchObject({ tenantId: 't-1', startDate: null, endDate: null, isActive: true });
  });

  it('rejects a source of another tenant', async () => {
    const db = prisma({ source: null });
    await expect(
      new LeadCampaignUseCase(db as never).create('t-1', { sourceId: 'src-9', name: 'Launching' })
    ).rejects.toThrow(/source not found/);
    expect(db.leadCampaign.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate names within the same source', async () => {
    const db = prisma({ duplicate: { id: 'c-2' } });
    await expect(
      new LeadCampaignUseCase(db as never).create('t-1', { sourceId: 'src-1', name: 'promo oktober' })
    ).rejects.toThrow(/already exists/);
    expect(db.leadCampaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sourceId: 'src-1', name: 'promo oktober' } })
    );
  });

  it('rejects an end date before the start date, including the stored period on update', async () => {
    const useCase = new LeadCampaignUseCase(prisma() as never);
    await expect(
      useCase.create('t-1', { sourceId: 'src-1', name: 'A', startDate: '2026-12-10', endDate: '2026-12-01' })
    ).rejects.toThrow(/endDate/);
    // Periode tersimpan 1–31 Okt; mengubah akhir ke September tidak valid.
    await expect(useCase.update('c-1', 't-1', { endDate: '2026-09-30' })).rejects.toThrow(/endDate/);
  });

  it('updates fields and can clear the period', async () => {
    const db = prisma();
    const campaign = await new LeadCampaignUseCase(db as never).update('c-1', 't-1', {
      startDate: null,
      endDate: null,
      isActive: false,
    });
    expect(db.leadCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c-1' }, data: { startDate: null, endDate: null, isActive: false } })
    );
    expect(campaign).toMatchObject({ startDate: null, endDate: null, isActive: false });
  });

  it('returns not found for a campaign of another tenant', async () => {
    const db = prisma({ found: null });
    const useCase = new LeadCampaignUseCase(db as never);
    await expect(useCase.update('c-9', 't-1', { name: 'X' })).rejects.toThrow(/not found/);
    await expect(useCase.remove('c-9', 't-1')).rejects.toThrow(/not found/);
    expect(db.leadCampaign.delete).not.toHaveBeenCalled();
  });

  it('deletes a campaign of the tenant', async () => {
    const db = prisma();
    await new LeadCampaignUseCase(db as never).remove('c-1', 't-1');
    expect(db.leadCampaign.delete).toHaveBeenCalledWith({ where: { id: 'c-1' } });
  });

  it('rejects deleting a campaign that is used by leads', async () => {
    const db = prisma({ used: 3 });
    await expect(new LeadCampaignUseCase(db as never).remove('c-1', 't-1')).rejects.toThrow(/used by 3 leads/);
    expect(db.lead.count).toHaveBeenCalledWith({ where: { tenantId: 't-1', campaignId: 'c-1' } });
    expect(db.leadCampaign.delete).not.toHaveBeenCalled();
  });
});

describe('lead campaign validation', () => {
  it('trims input and turns empty optional values into null', () => {
    expect(
      validateLeadCampaignCreate({ sourceId: 'src-1', name: ' Promo ', description: ' ', startDate: '', endDate: null })
    ).toEqual({ sourceId: 'src-1', name: 'Promo', description: null, startDate: null, endDate: null });
  });

  it('rejects invalid dates, missing source, and moving a campaign to another source', () => {
    expect(() => validateLeadCampaignCreate({ sourceId: 'src-1', name: 'A', startDate: '2026-02-30' })).toThrow(
      /startDate/
    );
    expect(() => validateLeadCampaignCreate({ sourceId: 'src-1', name: 'A', endDate: '20-11-2026' })).toThrow(/endDate/);
    expect(() => validateLeadCampaignCreate({ name: 'A' })).toThrow();
    expect(() => validateLeadCampaignUpdate({ sourceId: 'src-2' })).toThrow();
  });

  it('parses filters', () => {
    expect(parseLeadCampaignFilters({ sourceId: 'src-1', status: 'inactive', available: 'true' })).toEqual({
      sourceId: 'src-1',
      isActive: false,
      available: true,
    });
    expect(() => parseLeadCampaignFilters({ available: 'yes' })).toThrow(/available/);
    expect(() => parseLeadCampaignFilters({ status: 'archived' })).toThrow(/status/);
  });
});
