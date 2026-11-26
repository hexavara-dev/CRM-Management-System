import type { PrismaClient } from '@prisma/client';
import { prisma } from '../infrastructure/database/prisma.js';

const DEFAULT_DEAL_STAGES = [
  { name: 'Appointment Scheduled', color: '#4281FF' },
  { name: 'Qualified to Buy', color: '#EC0909' },
  { name: 'Presentation Scheduled', color: '#18FB3E' },
  { name: 'Contract Sent', color: '#F3F4F6' },
] as const;

const FINANCING_BANKS = ['BRI', 'BNI', 'BTN', 'Mandiri', 'BCA', 'BSI', 'BCA Syariah', 'Muamalat'] as const;

async function seedFinancingBanks(db: PrismaClient, tenantId: string) {
  for (const name of FINANCING_BANKS) {
    await db.financingBank.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name, isActive: true },
    });
  }
}

async function seedDealPipeline(db: PrismaClient, tenantId: string) {
  const existingCount = await db.stage.count({ where: { tenantId, entityType: 'deal' } });
  if (existingCount > 0) return;

  await db.stage.createMany({
    data: DEFAULT_DEAL_STAGES.map((stage, position) => ({
      tenantId,
      entityType: 'deal',
      name: stage.name,
      color: stage.color,
      probability: 0,
      position,
      isActive: true,
      isDefaultStage: position === 0,
      defaultGuard: position === 0 ? 'deal' : null,
      isTerminalStage: position === DEFAULT_DEAL_STAGES.length - 1,
      terminalGuard: position === DEFAULT_DEAL_STAGES.length - 1 ? 'deal' : null,
    })),
  });
}

async function seedDealStatuses(db: PrismaClient, tenantId: string) {
  const definitions = [
    { name: 'Open', isDefaultStatus: true, isClosingStatus: false, isFailedStatus: false, priority: 1 },
    { name: 'Won', isDefaultStatus: false, isClosingStatus: true, isFailedStatus: false, priority: 2 },
    { name: 'Lost', isDefaultStatus: false, isClosingStatus: false, isFailedStatus: true, priority: 3 },
  ] as const;

  for (const definition of definitions) {
    const existing = await db.status.findFirst({
      where: { tenantId, type: 'deal', name: definition.name },
      select: { id: true },
    });
    if (existing) continue;

    await db.status.create({
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
    });
  }
}

async function seedDealFormForTenant(db: PrismaClient, company: { id: string }) {
  await Promise.all([
    seedFinancingBanks(db, company.id),
    seedDealPipeline(db, company.id),
    seedDealStatuses(db, company.id),
  ]);
  console.log(`Seeded Add Deal form dependencies for tenant ${company.id}.`);
}

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const company of companies) await seedDealFormForTenant(prisma, company);
  console.log(`Processed Add Deal form dependencies for ${companies.length} tenant(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
