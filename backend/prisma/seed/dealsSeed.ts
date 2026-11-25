import type { PrismaClient } from '@prisma/client';

type SeedSalesUser = {
  id: string;
  name: string | null;
  email: string;
};

const defaultDealStages = [
  { name: 'Appointment Scheduled', color: '#4281FF' },
  { name: 'Qualified to Buy', color: '#EC0909' },
  { name: 'Presentation Scheduled', color: '#18FB3E' },
  { name: 'Contract Sent', color: '#F3F4F6' },
] as const;

const dealDefinitions = [
  { refCode: 'DEAL-DEMO-001', firstName: 'Hendra', lastName: 'Wijaya', phone: '081234567890', unitOffset: 0, stageOffset: 0, amount: 550_000_000, paymentMethod: 'KPR', bankName: 'BRI', status: 'Open', daysAgo: 2 },
  { refCode: 'DEAL-DEMO-002', firstName: 'Siti', lastName: 'Rahmawati', phone: '081398765432', unitOffset: 1, stageOffset: 1, amount: 625_000_000, paymentMethod: 'KPR_SHARIA', bankName: 'BSI', status: 'Open', daysAgo: 1 },
  { refCode: 'DEAL-DEMO-003', firstName: 'Budi', lastName: 'Santoso', phone: '081211223344', unitOffset: 2, stageOffset: 2, amount: 700_000_000, paymentMethod: 'CASH', bankName: null, status: 'Open', daysAgo: 4 },
  { refCode: 'DEAL-DEMO-004', firstName: 'Andini', lastName: 'Putri', phone: '082276543210', unitOffset: 3, stageOffset: 1, amount: 825_000_000, paymentMethod: 'KPR', bankName: 'Mandiri', status: 'Open', daysAgo: 2 },
  { refCode: 'DEAL-DEMO-005', firstName: 'Maya', lastName: 'Anggraini', phone: '081299887766', unitOffset: 4, stageOffset: 3, amount: 900_000_000, paymentMethod: 'CASH', bankName: null, status: 'Won', daysAgo: 0 },
  { refCode: 'DEAL-DEMO-006', firstName: 'Irfan', lastName: 'Maulana', phone: '081277663344', unitOffset: 5, stageOffset: 2, amount: 675_000_000, paymentMethod: 'KPR_SHARIA', bankName: 'BCA Syariah', status: 'Open', daysAgo: 3 },
  { refCode: 'DEAL-DEMO-007', firstName: 'Dewi', lastName: 'Anggraini', phone: '081299887765', unitOffset: 6, stageOffset: 2, amount: 775_000_000, paymentMethod: 'CASH', bankName: null, status: 'Open', daysAgo: 5 },
  { refCode: 'DEAL-DEMO-008', firstName: 'Fajar', lastName: 'Ramadhan', phone: '082155668899', unitOffset: 7, stageOffset: 0, amount: 600_000_000, paymentMethod: 'KPR', bankName: 'BRI', status: 'Lost', daysAgo: 6 },
] as const;

function daysBeforeToday(daysAgo: number) {
  const date = new Date();
  date.setHours(10, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

async function seedDefaultDealPipeline(prisma: PrismaClient, tenantId: string) {
  const existingCount = await prisma.stage.count({ where: { tenantId, entityType: 'deal' } });
  if (existingCount > 0) {
    console.log(`Skipped Deal pipeline: ${existingCount} stage(s) already configured.`);
    return prisma.stage.findMany({
      where: { tenantId, entityType: 'deal', isActive: true },
      orderBy: { position: 'asc' },
    });
  }

  await prisma.stage.createMany({
    data: defaultDealStages.map((stage, position) => ({
      tenantId,
      entityType: 'deal',
      name: stage.name,
      color: stage.color,
      probability: 0,
      position,
      isActive: true,
      isDefaultStage: position === 0,
      defaultGuard: position === 0 ? 'deal' : null,
      isTerminalStage: position === defaultDealStages.length - 1,
      terminalGuard: position === defaultDealStages.length - 1 ? 'deal' : null,
    })),
  });
  console.log(`Seeded ${defaultDealStages.length} default Deal pipeline stages.`);
  return prisma.stage.findMany({
    where: { tenantId, entityType: 'deal', isActive: true },
    orderBy: { position: 'asc' },
  });
}

// Master bank pembiayaan: dibutuhkan form Convert to Deal (KPR / KPR Syariah wajib memilih bank aktif).
const FINANCING_BANKS = ['BRI', 'BNI', 'BTN', 'Mandiri', 'BCA', 'BSI', 'BCA Syariah', 'Muamalat'] as const;

async function seedFinancingBanks(prisma: PrismaClient, tenantId: string) {
  const banks = new Map<string, string>();
  for (const name of FINANCING_BANKS) {
    const bank = await prisma.financingBank.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name, isActive: true },
      select: { id: true },
    });
    banks.set(name, bank.id);
  }
  return banks;
}

async function seedDealStatuses(prisma: PrismaClient, tenantId: string) {
  const definitions = [
    { name: 'Open', isDefaultStatus: true, isClosingStatus: false, isFailedStatus: false, priority: 1 },
    { name: 'Won', isDefaultStatus: false, isClosingStatus: true, isFailedStatus: false, priority: 2 },
    { name: 'Lost', isDefaultStatus: false, isClosingStatus: false, isFailedStatus: true, priority: 3 },
  ] as const;

  const statuses = new Map<string, { id: string }>();
  for (const definition of definitions) {
    const existing = await prisma.status.findFirst({
      where: { tenantId, type: 'deal', name: definition.name },
      select: { id: true },
    });
    const status = existing ?? await prisma.status.create({
      data: {
        tenantId,
        type: 'deal',
        name: definition.name,
        priority: definition.priority,
        isDefaultStatus: definition.isDefaultStatus,
        isClosingStatus: definition.isClosingStatus,
        isFailedStatus: definition.isFailedStatus,
        isSystemStatus: true,
        defaultGuard: definition.isDefaultStatus ? 'deal' : null,
        closingGuard: definition.isClosingStatus ? 'deal' : null,
      },
      select: { id: true },
    });
    statuses.set(definition.name, status);
  }
  return statuses;
}

/** Seed demo Deal yang terhubung ke Customer, Lead, Unit, Project, Sales, dan aktivitas terakhir. */
export async function seedDealsData(prisma: PrismaClient, tenantId: string, salesUsers: SeedSalesUser[]) {
  if (salesUsers.length === 0) throw new Error('At least one sales user is required for Deal seed data.');

  const financingBanks = await seedFinancingBanks(prisma, tenantId);
  const [stages, units, statuses] = await Promise.all([
    seedDefaultDealPipeline(prisma, tenantId),
    prisma.productUnit.findMany({
      where: { tenantId, status: 'AVAILABLE' },
      orderBy: { code: 'asc' },
      take: dealDefinitions.length,
      select: { id: true },
    }),
    seedDealStatuses(prisma, tenantId),
  ]);

  if (stages.length < defaultDealStages.length) {
    throw new Error('At least four active Deal pipeline stages are required for Deal demo data.');
  }
  if (units.length < dealDefinitions.length) {
    throw new Error('Not enough available units for Deal demo data. Run the project seed first.');
  }

  for (const [index, definition] of dealDefinitions.entries()) {
    const email = `${definition.refCode.toLowerCase()}@example.com`;
    const customer = await prisma.customer.findFirst({ where: { tenantId, email }, select: { id: true } })
      ?? await prisma.customer.create({
        data: { tenantId, firstName: definition.firstName, lastName: definition.lastName, email, phoneNumber: definition.phone },
        select: { id: true },
      });
    const lead = await prisma.lead.findFirst({
      where: { tenantId, customerId: customer.id, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }) ?? await prisma.lead.create({
      data: { tenantId, customerId: customer.id, assignedUserId: salesUsers[index % salesUsers.length]!.id, type: 'DEAL_DEMO', converted: true, convertedDate: daysBeforeToday(definition.daysAgo) },
      select: { id: true },
    });
    const status = statuses.get(definition.status);
    if (!status) throw new Error(`Missing seeded Deal status: ${definition.status}`);
    const activityAt = daysBeforeToday(definition.daysAgo);
    const deal = await prisma.deal.upsert({
      where: { refCode: definition.refCode },
      update: {
        leadId: lead.id,
        assignedUserId: salesUsers[index % salesUsers.length]!.id,
        stageId: stages[definition.stageOffset]!.id,
        statusId: status.id,
        unitId: units[definition.unitOffset]!.id,
        expectedAmount: definition.amount,
        amount: definition.amount,
        currency: 'IDR',
        paymentMethod: definition.paymentMethod,
        bankName: definition.bankName,
        financingBankId: definition.bankName ? financingBanks.get(definition.bankName) ?? null : null,
      },
      create: {
        tenantId,
        refCode: definition.refCode,
        leadId: lead.id,
        assignedUserId: salesUsers[index % salesUsers.length]!.id,
        stageId: stages[definition.stageOffset]!.id,
        statusId: status.id,
        unitId: units[definition.unitOffset]!.id,
        dealType: 'Demo Deal',
        expectedAmount: definition.amount,
        amount: definition.amount,
        currency: 'IDR',
        expectedClosingDate: daysBeforeToday(-14),
        closingDate: definition.status === 'Open' ? null : activityAt,
        paymentMethod: definition.paymentMethod,
        bankName: definition.bankName,
        financingBankId: definition.bankName ? financingBanks.get(definition.bankName) ?? null : null,
        createdAt: daysBeforeToday(definition.daysAgo + 10),
      },
    });
    const activity = await prisma.dealActivity.findFirst({
      where: { tenantId, dealId: deal.id, activityType: 'deal_demo_activity' },
      select: { id: true },
    });
    if (activity) {
      await prisma.dealActivity.update({ where: { id: activity.id }, data: { createdAt: activityAt } });
    } else {
      await prisma.dealActivity.create({
        data: { tenantId, dealId: deal.id, customerId: customer.id, actorId: salesUsers[index % salesUsers.length]!.id, activityType: 'deal_demo_activity', createdAt: activityAt },
      });
    }
  }

  console.log(`Seeded ${dealDefinitions.length} demo Deals.`);
}
