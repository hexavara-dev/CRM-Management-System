import { randomUUID } from 'crypto';
import type { DealPaymentMethod, Prisma, PrismaClient } from '@prisma/client';
import { localStorage } from '../../infrastructure/storage/localStorage.js';
import { toDateValue, todayInPriceZone } from '../pricing/priceRules.js';
import { expireOverdueReservations } from '../reservation/reservationStatus.js';
import { checkDealDocuments, type DealDocumentInput } from './dealDocuments.js';
import { assertDealPrice, assertUnitSellable } from './dealUnit.js';
import { LeadFormSubmissionUseCase, type LeadFormSubmission } from '../crm/LeadFormSubmissionUseCase.js';

export type CreateDealInput = {
  leadId: string;
  unitId: string;
  amount: number;
  paymentMethod: DealPaymentMethod;
  financingBankId?: string | null;
  /** YYYY-MM-DD */
  expectedClosingDate: string;
  notes?: string | null;
  documents: DealDocumentInput[];
};

export type DealCreator = { tenantId: string; userId: string; role: string };
type DealLead = { id: string; customerId: string; assignedUserId: string | null; sourceId: string | null; type: string | null };
type CreateInTransaction = { transaction?: Prisma.TransactionClient; lead?: DealLead; skipReservationExpiry?: boolean };

/** Lead yang boleh dibuatkan Deal oleh user: belum converted, tidak diarsipkan, dan dapat diakses. */
function openLead({ tenantId, userId, role }: DealCreator): Prisma.LeadWhereInput {
  return {
    tenantId,
    isDeleted: false,
    archivedAt: null,
    converted: false,
    ...(role === 'owner' ? {} : { assignedUserId: userId }),
  };
}

/** Membuat Deal dari Lead yang sudah ada (Tambah Deal). */
export class CreateDealUseCase {
  constructor(
    private prisma: PrismaClient,
    private storage: Pick<typeof localStorage, 'upload' | 'remove' | 'getPublicUrl'> = localStorage
  ) {}

  async leadOptions(creator: DealCreator, filters: { search?: string; page: number; limit: number }) {
    const where: Prisma.LeadWhereInput = {
      ...openLead(creator),
      deals: { none: {} },
      ...(filters.search
        ? {
            customer: {
              is: {
                OR: [
                  { firstName: { contains: filters.search } },
                  { lastName: { contains: filters.search } },
                  { email: { contains: filters.search } },
                  { phoneNumber: { contains: filters.search } },
                ],
              },
            },
          }
        : {}),
    };
    const project = { select: { id: true, name: true } } as const;
    const [rows, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        select: {
          id: true,
          customer: { select: { firstName: true, lastName: true, email: true, phoneNumber: true } },
          project,
          interests: { select: { product: project }, orderBy: { createdAt: 'asc' }, take: 1 },
          labelAssignments: {
            select: { label: { select: { id: true, type: true, name: true, color: true, icon: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.lead.count({ where }),
    ]);
    return {
      data: rows.map(({ id, customer, project: main, interests, labelAssignments }) => ({
        id,
        name: [customer.firstName, customer.lastName].filter(Boolean).join(' '),
        email: customer.email,
        phone: customer.phoneNumber,
        project: main ?? interests[0]?.product ?? null,
        labels: labelAssignments.map((item) => item.label),
      })),
      meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  private async bankOf(tenantId: string, input: CreateDealInput) {
    if (input.paymentMethod === 'CASH') {
      if (input.financingBankId) throw new Error('Invalid bank: it must be empty for cash payment');
      return null;
    }
    if (!input.financingBankId) throw new Error('Bank is required for KPR payment');
    const bank = await this.prisma.financingBank.findFirst({
      where: { id: input.financingBankId, tenantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!bank) throw new Error('Financing bank not found');
    return bank;
  }

  async create(creator: DealCreator, input: CreateDealInput, files: Express.Multer.File[] = [], options: CreateInTransaction = {}) {
    const { tenantId, userId, role } = creator;
    if (input.expectedClosingDate < todayInPriceZone()) {
      throw new Error('Invalid expectedClosingDate: target closing tidak boleh sebelum hari ini');
    }
    const [lead, bank, stage, status] = await Promise.all([
      options.lead ?? this.prisma.lead.findFirst({
        where: { id: input.leadId, tenantId, isDeleted: false, ...(role === 'owner' ? {} : { assignedUserId: userId }) },
        select: { id: true, customerId: true, assignedUserId: true, sourceId: true, type: true },
      }),
      this.bankOf(tenantId, input),
      this.prisma.stage.findFirst({
        where: { tenantId, entityType: 'deal', isDefaultStage: true, isActive: true },
        select: { id: true, evidences: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.status.findFirst({
        where: { tenantId, type: 'deal', isDefaultStatus: true },
        select: { id: true },
      }),
    ]);
    if (!lead) throw new Error('Lead not found');
    if (!stage) throw new Error('No default Deal stage configured');
    if (!status) throw new Error('No default Deal status configured');
    const documents = checkDealDocuments(stage.evidences, input.paymentMethod, input.documents, files);
    if (!options.skipReservationExpiry) await expireOverdueReservations(this.prisma, tenantId);

    const dealId = randomUUID();
    const refCode = `DEAL-${dealId.slice(0, 8).toUpperCase()}`;
    const stored = documents.map((item) => ({ ...item, path: `${tenantId}/deal/${dealId}/${randomUUID()}.${item.ext}` }));
    try {
      for (const item of stored) await this.storage.upload(item.path, item.file.buffer);

      const persist = async (tx: Prisma.TransactionClient) => {
        // Filter kolom saja agar klaim menjadi satu UPDATE; Deal lama diperiksa terpisah.
        const claimedLead = await tx.lead.updateMany({
          where: { ...openLead(creator), id: lead.id },
          data: { converted: true, convertedDate: new Date() },
        });
        if (claimedLead.count !== 1 || (await tx.deal.count({ where: { tenantId, leadId: lead.id } })) > 0) throw new Error('Lead already converted or archived (conflict)');

        await assertUnitSellable(tx, tenantId, input.unitId);
        await assertDealPrice(tx, tenantId, input.unitId, input.amount);
        const claimedUnit = await tx.productUnit.updateMany({
          where: { id: input.unitId, tenantId, status: 'AVAILABLE' },
          data: { status: 'RESERVED' },
        });
        if (claimedUnit.count !== 1) throw new Error('Unit is not available');

        const deal = await tx.deal.create({
          data: {
            id: dealId,
            tenantId,
            leadId: lead.id,
            assignedUserId: lead.assignedUserId,
            sourceId: lead.sourceId,
            stageId: stage.id,
            statusId: status.id,
            unitId: input.unitId,
            unitClaimed: true,
            refCode,
            dealType: lead.type,
            expectedAmount: input.amount,
            amount: input.amount,
            currency: 'IDR',
            expectedClosingDate: toDateValue(input.expectedClosingDate),
            paymentMethod: input.paymentMethod,
            financingBankId: bank?.id ?? null,
            bankName: bank?.name ?? null,
            notes: input.notes?.trim() || null,
          },
        });
        if (stored.length) {
          await tx.attachment.createMany({
            data: stored.map(({ name, file, path }) => ({
              tenantId,
              dealId,
              documentName: name,
              documentStageId: stage.id,
              fileName: file.originalname.slice(0, 191),
              fileUrl: this.storage.getPublicUrl(path).publicUrl,
              fileType: file.mimetype,
              fileSize: file.size,
              uploadedById: userId,
            })),
          });
        }
        await tx.leadActivity.create({
          data: {
            tenantId,
            leadId: lead.id,
            actorId: userId,
            activityType: 'conversion',
            notes: { create: { tenantId, content: `Lead converted to deal: ${refCode}` } },
          },
        });
        await tx.dealActivity.create({
          data: {
            tenantId,
            dealId,
            actorId: userId,
            customerId: lead.customerId,
            activityType: 'deal_created',
            notes: { create: { tenantId, content: 'Deal dibuat dari Lead.' } },
          },
        });
        await tx.auditLog.create({
          data: {
            tenantId,
            entityId: dealId,
            entityType: 'deal',
            actorId: userId,
            action: 'deal_created',
            changes: { leadId: lead.id, unitId: input.unitId, stageId: stage.id, amount: input.amount },
          },
        });
        return deal;
      };
      // Klaim bersyarat sudah menjaga konflik; snapshot REPEATABLE READ justru menggagalkan yang kalah dengan error database.
      return options.transaction ? await persist(options.transaction) : await this.prisma.$transaction(persist, { isolationLevel: 'ReadCommitted' });
    } catch (error) {
      await this.storage.remove(stored.map((item) => item.path));
      throw error;
    }
  }

  /** Menyimpan Lead baru dan Deal pertamanya secara atomik; pembatalan dialog tidak menulis apa pun. */
  async createFromLeadForm(creator: DealCreator, leadInput: LeadFormSubmission, dealInput: Omit<CreateDealInput, 'leadId'>, files: Express.Multer.File[] = []) {
    await expireOverdueReservations(this.prisma, creator.tenantId);
    return this.prisma.$transaction(async (tx) => {
      const lead = await new LeadFormSubmissionUseCase(this.prisma).submitInTransaction(creator, leadInput, tx);
      const persistedLead = await tx.lead.findFirst({
        where: { id: lead.id, tenantId: creator.tenantId },
        select: { id: true, customerId: true, assignedUserId: true, sourceId: true, type: true },
      });
      if (!persistedLead) throw new Error('Lead could not be created');
      return this.create(creator, { ...dealInput, leadId: persistedLead.id }, files, {
        transaction: tx,
        lead: persistedLead,
        skipReservationExpiry: true,
      });
    }, { isolationLevel: 'ReadCommitted' });
  }
}
