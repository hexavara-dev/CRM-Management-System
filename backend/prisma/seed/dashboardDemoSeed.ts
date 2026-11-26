import type { PrismaClient, ProductUnitStatus } from '@prisma/client';

type SeedSalesUser = { id: string; name: string | null; email: string };

const TARGETS = { projects: 12, types: 36, units: 360, openDeals: 24, wonDeals: 72, lostDeals: 18, leads: 180 } as const;
const UNIT_DISTRIBUTION: Array<[ProductUnitStatus, number]> = [
  ['AVAILABLE', 160],
  ['BOOKED', 30],
  ['RESERVED', 120],
  ['SOLD', 30],
  ['BLOCKED', 20],
];

const names = ['Arga Pratama', 'Nadia Putri', 'Rizky Maulana', 'Alya Ramadhani', 'Dimas Wicaksono', 'Keisha Lestari', 'Fikri Ananda', 'Citra Maharani', 'Raka Mahendra', 'Salsa Novitasari', 'Bima Saputra', 'Nayla Kusuma', 'Galang Prasetyo', 'Vania Amalia', 'Rendra Kurniawan', 'Intan Permata'];
const MONTHLY_REVENUE = [2_800_000_000, 2_300_000_000, 2_000_000_000, 2_000_000_000, 2_000_000_000, 2_500_000_000, 3_200_000_000, 2_800_000_000, 2_000_000_000, 2_000_000_000] as const;
const projectCatalog = [
  { code: 'KARYA-PRATAMA-CIBUBUR', name: 'Karya Pratama Cibubur', province: 'Jawa Barat', city: 'Kota Depok' },
  { code: 'ARUNA-RESIDENCE-BEKASI', name: 'Aruna Residence Bekasi', province: 'Jawa Barat', city: 'Kota Bekasi' },
  { code: 'SAVANA-GARDEN-BOGOR', name: 'Savana Garden Bogor', province: 'Jawa Barat', city: 'Kota Bogor' },
  { code: 'SENTANA-PARK-BANDUNG', name: 'Sentana Park Bandung', province: 'Jawa Barat', city: 'Kota Bandung' },
  { code: 'MAHARAJA-LIVING-MALANG', name: 'Maharaja Living Malang', province: 'Jawa Timur', city: 'Kota Malang' },
  { code: 'CITRA-UTAMA-SURABAYA', name: 'Citra Utama Surabaya', province: 'Jawa Timur', city: 'Kota Surabaya' },
] as const;
const typeNames = ['Type 36/72', 'Type 45/90', 'Type 54/90', 'Type 60/120', 'Type 72/120'] as const;

function splitName(fullName: string) {
  const [firstName, ...rest] = fullName.split(' ');
  return { firstName, lastName: rest.join(' ') || null };
}

function dateInCurrentYear(month: number, index: number) {
  const date = new Date(new Date().getFullYear(), month, 10 + (index % 12), 10, 0, 0, 0);
  return date;
}

function dateMonthsAgo(monthsAgo: number, index: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  date.setDate(4 + (index % 20));
  date.setHours(9 + (index % 7), 0, 0, 0);
  return date;
}

async function ensureDealStatuses(prisma: PrismaClient, tenantId: string) {
  const definitions = [
    { name: 'Open', isDefaultStatus: true, isClosingStatus: false, isFailedStatus: false, priority: 1, defaultGuard: 'deal', closingGuard: null },
    { name: 'Won', isDefaultStatus: false, isClosingStatus: true, isFailedStatus: false, priority: 2, defaultGuard: null, closingGuard: 'deal' },
    { name: 'Lost', isDefaultStatus: false, isClosingStatus: false, isFailedStatus: true, priority: 3, defaultGuard: null, closingGuard: null },
  ] as const;
  const result = new Map<string, { id: string }>();
  for (const definition of definitions) {
    const row = await prisma.status.findFirst({ where: { tenantId, type: 'deal', name: definition.name }, select: { id: true } }) ?? await prisma.status.create({ data: { tenantId, type: 'deal', ...definition, isSystemStatus: true }, select: { id: true } });
    result.set(definition.name, row);
  }
  return result;
}

async function ensureDealStages(prisma: PrismaClient, tenantId: string) {
  const stages = await prisma.stage.findMany({ where: { tenantId, entityType: 'deal', isActive: true }, orderBy: { position: 'asc' } });
  if (!stages.length) throw new Error('Dashboard seed requires the Deal pipeline seed to run first.');
  const won = stages[stages.length - 1]!;
  await prisma.stage.updateMany({ where: { tenantId, entityType: 'deal', isWonStage: true }, data: { isWonStage: false, wonGuard: null } });
  await prisma.stage.update({ where: { id: won.id }, data: { isTerminalStage: true, isWonStage: true, terminalGuard: 'deal', wonGuard: 'deal' } });
  return { open: stages[0]!, won, lost: stages[Math.max(0, stages.length - 2)]! };
}

async function topUpCatalog(prisma: PrismaClient, tenantId: string) {
  const currentProjects = await prisma.product.count({ where: { tenantId, isActive: true } });
  const currentTypes = await prisma.productVariant.count({ where: { tenantId } });
  const currentUnits = await prisma.productUnit.count({ where: { tenantId } });
  if (currentProjects > TARGETS.projects || currentTypes > TARGETS.types || currentUnits > TARGETS.units) throw new Error('Dashboard seed tidak dapat menurunkan data existing yang sudah melewati target.');

  const projects = await prisma.product.findMany({ where: { tenantId, isActive: true }, select: { id: true, code: true, categoryId: true } });
  const variantRefs: Array<{ variantId: string; typeVariantId: string; categoryId: string; unitPrefix: string }> = [];
  for (const project of projects) {
    const variants = await prisma.productVariant.findMany({ where: { tenantId, productId: project.id }, select: { id: true } });
    for (const variant of variants) {
      const typeVariant = await prisma.productTypeVariant.findFirst({ where: { tenantId, productVariantId: variant.id }, select: { id: true } });
      if (typeVariant) variantRefs.push({ variantId: variant.id, typeVariantId: typeVariant.id, categoryId: project.categoryId, unitPrefix: project.code });
    }
  }

  let projectIndex = currentProjects;
  let typeIndex = currentTypes;
  while (projectIndex < TARGETS.projects) {
    const catalog = projectCatalog[projectIndex - currentProjects];
    if (!catalog) throw new Error('Project catalog does not cover the requested dashboard target.');
    const { code, name, province, city } = catalog;
    const category = await prisma.productCategory.create({ data: { tenantId, code, name, type: 'PROJECT', isActive: true } });
    const product = await prisma.product.create({ data: { tenantId, categoryId: category.id, code, name, description: `Kawasan hunian ${name} dengan pilihan unit untuk keluarga muda dan end-user.`, province, city, isActive: true } });
    const remainingProjects = TARGETS.projects - projectIndex;
    const variantsForProject = Math.max(3, Math.min(5, TARGETS.types - typeIndex - 3 * (remainingProjects - 1)));
    for (let variantOffset = 0; variantOffset < variantsForProject; variantOffset += 1) {
      const variant = await prisma.productVariant.create({ data: { tenantId, productId: product.id, name: typeNames[variantOffset]! } });
      const basePrice = BigInt(450_000_000 + variantOffset * 125_000_000 + (projectIndex % 3) * 25_000_000);
      const typeVariant = await prisma.productTypeVariant.create({ data: { tenantId, productVariantId: variant.id, name: 'Standard', code: `${code}-STD-${variantOffset + 1}`, basePrice, currentPrice: basePrice, stock: 0, isActive: true } });
      variantRefs.push({ variantId: variant.id, typeVariantId: typeVariant.id, categoryId: category.id, unitPrefix: code });
      typeIndex += 1;
    }
    projectIndex += 1;
  }

  const existingUnitsByStatus = new Map((await prisma.productUnit.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } })).map((row) => [row.status, row._count._all]));
  for (const [status, target] of UNIT_DISTRIBUTION) {
    if ((existingUnitsByStatus.get(status) ?? 0) > target) throw new Error(`Dashboard seed tidak dapat menurunkan unit ${status} existing yang sudah melewati target.`);
  }
  const statusDeficit = new Map(UNIT_DISTRIBUTION.map(([status, target]) => [status, Math.max(0, target - (existingUnitsByStatus.get(status) ?? 0))]));
  let unitIndex = currentUnits;
  let refIndex = 0;
  while (unitIndex < TARGETS.units) {
    const ref = variantRefs[refIndex % variantRefs.length]!;
    const status = UNIT_DISTRIBUTION.find(([key]) => (statusDeficit.get(key) ?? 0) > 0)?.[0] ?? 'AVAILABLE';
    const unitNumber = String(unitIndex + 1).padStart(3, '0');
    await prisma.productUnit.create({ data: { tenantId, variantId: ref.variantId, typeVariantId: ref.typeVariantId, categoryId: ref.categoryId, code: `${ref.unitPrefix.slice(0, 8)}-${unitNumber}`, name: `Unit ${unitNumber}`, status } });
    statusDeficit.set(status, Math.max(0, (statusDeficit.get(status) ?? 0) - 1));
    unitIndex += 1;
    refIndex += 1;
  }
  for (const ref of variantRefs) {
    await prisma.productTypeVariant.update({ where: { id: ref.typeVariantId }, data: { stock: await prisma.productUnit.count({ where: { tenantId, typeVariantId: ref.typeVariantId } }) } });
  }
  return { units: await prisma.productUnit.findMany({ where: { tenantId }, orderBy: { code: 'asc' }, take: TARGETS.units, select: { id: true } }) };
}

async function topUpLeads(prisma: PrismaClient, tenantId: string, salesUsers: SeedSalesUser[]) {
  const current = await prisma.lead.count({ where: { tenantId, isDeleted: false } });
  if (current > TARGETS.leads) throw new Error('Dashboard seed tidak dapat menurunkan jumlah Lead existing yang sudah melewati target.');
  const stages = await prisma.stage.findMany({ where: { tenantId, entityType: 'lead', isActive: true }, orderBy: { position: 'asc' }, select: { id: true } });
  const status = await prisma.status.findFirst({ where: { tenantId, type: 'lead', isDefaultStatus: true }, select: { id: true } });
  const projects = await prisma.product.findMany({ where: { tenantId, isActive: true }, select: { id: true } });
  for (let index = current; index < TARGETS.leads; index += 1) {
    const customer = await prisma.customer.create({ data: { tenantId, ...splitName(names[index % names.length]!), email: `prospek-rumah-${index + 1}@example.com`, phoneNumber: `0812${String(index + 1).padStart(8, '0')}` }, select: { id: true } });
    await prisma.lead.create({ data: { tenantId, customerId: customer.id, assignedUserId: salesUsers[index % salesUsers.length]!.id, projectId: projects[index % projects.length]!.id, stageId: stages[index % stages.length]?.id ?? null, statusId: status?.id ?? null, type: 'RESIDENTIAL_INQUIRY', createdAt: dateMonthsAgo((index % 12) + 1, index) } });
  }
}

async function topUpDeals(prisma: PrismaClient, tenantId: string, salesUsers: SeedSalesUser[], units: { id: string }[]) {
  const stages = await ensureDealStages(prisma, tenantId);
  const statuses = await ensureDealStatuses(prisma, tenantId);
  const existing = await prisma.deal.findMany({ where: { tenantId }, select: { status: { select: { isFailedStatus: true, isClosingStatus: true } } } });
  const counts = { open: existing.filter((deal) => !deal.status?.isFailedStatus && !deal.status?.isClosingStatus).length, won: existing.filter((deal) => deal.status?.isClosingStatus).length, lost: existing.filter((deal) => deal.status?.isFailedStatus).length };
  const targets = { open: TARGETS.openDeals, won: TARGETS.wonDeals, lost: TARGETS.lostDeals };
  const leads = await prisma.lead.findMany({ where: { tenantId, isDeleted: false }, orderBy: { createdAt: 'asc' }, select: { id: true, customerId: true } });
  let sequence = await prisma.deal.count({ where: { tenantId } });
  for (const kind of ['open', 'won', 'lost'] as const) {
    for (let index = counts[kind]; index < targets[kind]; index += 1) {
      const lead = leads[sequence % leads.length]!;
      const stage = kind === 'won' ? stages.won : kind === 'lost' ? stages.lost : stages.open;
      const status = statuses.get(kind === 'won' ? 'Won' : kind === 'lost' ? 'Lost' : 'Open')!;
      const closingDate = kind === 'open' ? null : dateInCurrentYear(sequence % 12, sequence);
      await prisma.deal.create({ data: { tenantId, refCode: `DL-${String(sequence + 1).padStart(5, '0')}`, leadId: lead.id, assignedUserId: salesUsers[sequence % salesUsers.length]!.id, stageId: stage.id, statusId: status.id, unitId: units[sequence % units.length]!.id, dealType: 'Residential', expectedAmount: 500_000_000, amount: 500_000_000, currency: 'IDR', expectedClosingDate: dateInCurrentYear((sequence + 1) % 12, sequence), closingDate, paymentMethod: 'CASH', createdAt: dateInCurrentYear((sequence + 11) % 12, sequence) } });
      sequence += 1;
    }
  }

  const wonDeals = await prisma.deal.findMany({
    where: { tenantId, stage: { isWonStage: true } },
    orderBy: { refCode: 'asc' },
    select: { id: true },
  });
  const dealsPerMonth = wonDeals.length / MONTHLY_REVENUE.length;
  for (const [index, deal] of wonDeals.entries()) {
    const month = index % MONTHLY_REVENUE.length;
    const variation = ((index % 5) - 2) * 1_000_000;
    const amount = Math.round(MONTHLY_REVENUE[month]! / dealsPerMonth) + variation;
    await prisma.deal.update({
      where: { id: deal.id },
      data: { amount, expectedAmount: amount, closingDate: dateInCurrentYear(month, index) },
    });
  }
}

async function normalizeSummaryHistory(prisma: PrismaClient, tenantId: string) {
  const [projects, variants, units, deals] = await Promise.all([
    prisma.product.findMany({ where: { tenantId }, orderBy: { code: 'asc' }, select: { id: true } }),
    prisma.productVariant.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, select: { id: true } }),
    prisma.productUnit.findMany({ where: { tenantId }, orderBy: { code: 'asc' }, select: { id: true } }),
    prisma.deal.findMany({ where: { tenantId }, select: { id: true, status: { select: { isFailedStatus: true } }, stage: { select: { isWonStage: true } } } }),
  ]);
  await Promise.all([
    ...projects.map((project, index) => prisma.product.update({ where: { id: project.id }, data: { createdAt: dateMonthsAgo(index >= projects.length - 3 ? 0 : 1 + (index % 3), index) } })),
    ...variants.map((variant, index) => prisma.productVariant.update({ where: { id: variant.id }, data: { createdAt: dateMonthsAgo(index >= variants.length - 5 ? 0 : 1 + (index % 3), index) } })),
    ...units.map((unit, index) => prisma.productUnit.update({ where: { id: unit.id }, data: { createdAt: dateMonthsAgo(index >= units.length - 20 ? 0 : 1 + (index % 3), index) } })),
    ...deals.map((deal, index) => {
      const currentMonthCount = deal.status?.isFailedStatus ? 1 : deal.stage?.isWonStage ? 6 : 2;
      return prisma.deal.update({ where: { id: deal.id }, data: { createdAt: dateMonthsAgo(index < currentMonthCount ? 0 : 1 + (index % 3), index) } });
    }),
  ]);
}

export async function seedDashboardDemo(prisma: PrismaClient, tenantId: string, salesUsers: SeedSalesUser[]) {
  if (!salesUsers.length) throw new Error('Dashboard seed requires at least one sales user.');
  const catalog = await topUpCatalog(prisma, tenantId);
  await topUpLeads(prisma, tenantId, salesUsers);
  await topUpDeals(prisma, tenantId, salesUsers, catalog.units);
  await normalizeSummaryHistory(prisma, tenantId);
  console.log('Seeded a realistic CRM demo: 12 projects, 36 unit types, 360 units, 180 leads, 24 open deals, 72 won deals, and 18 lost deals.');
}
