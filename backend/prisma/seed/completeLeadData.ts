import type { PrismaClient } from '@prisma/client';

type SeedSalesUser = { id: string; name: string | null; email: string };

const sourceDefinitions = [
  { name: 'Meta Ads', color: '#1877F2' },
  { name: 'TikTok Ads', color: '#111827' },
  { name: 'Agency', color: '#7C3AED' },
  { name: 'Pribadi', color: '#16A34A' },
] as const;
const labelDefinitions = [
  { type: 'TEMPERATURE' as const, name: 'Hot', color: '#EF4444', icon: 'flame' },
  { type: 'TEMPERATURE' as const, name: 'Warm', color: '#F59E0B', icon: 'flame' },
  { type: 'TEMPERATURE' as const, name: 'Cold', color: '#2563EB', icon: 'snowflake' },
  { type: 'TAG' as const, name: 'Tidak Sesuai Budget', color: '#F97316', icon: 'circle-alert' },
  { type: 'TAG' as const, name: 'Tidak Sesuai Lokasi', color: '#7C3AED', icon: 'map-pin' },
] as const;
const leadStages = [
  { name: 'New', color: '#2563EB', probability: 10, isDefaultStage: true, isTerminalStage: false },
  { name: 'Contacted', color: '#0EA5E9', probability: 25, isDefaultStage: false, isTerminalStage: false },
  { name: 'Nurturing', color: '#64748B', probability: 40, isDefaultStage: false, isTerminalStage: false },
  { name: 'Qualified', color: '#22C55E', probability: 60, isDefaultStage: false, isTerminalStage: false },
  { name: 'Converted', color: '#16A34A', probability: 100, isDefaultStage: false, isTerminalStage: true },
  { name: 'Disqualified', color: '#EF4444', probability: 0, isDefaultStage: false, isTerminalStage: true },
] as const;
const leadStatuses = ['New', 'Contacted', 'Follow Up', 'Qualified', 'Closed', 'Lost'] as const;

async function ensureLeadStages(prisma: PrismaClient, tenantId: string) {
  const existing = await prisma.stage.findMany({ where: { tenantId, entityType: 'lead', isActive: true }, orderBy: { position: 'asc' } });
  if (existing.length) return existing;
  await prisma.stage.createMany({
    data: leadStages.map((stage, position) => ({
      tenantId, entityType: 'lead', position, isActive: true, defaultGuard: stage.isDefaultStage ? 'lead' : null, ...stage,
    })),
  });
  return prisma.stage.findMany({ where: { tenantId, entityType: 'lead', isActive: true }, orderBy: { position: 'asc' } });
}

async function ensureLeadStatuses(prisma: PrismaClient, tenantId: string) {
  const result = [];
  for (const [index, name] of leadStatuses.entries()) {
    const existing = await prisma.status.findFirst({ where: { tenantId, type: 'lead', name }, select: { id: true } });
    result.push(existing ?? await prisma.status.create({
      data: { tenantId, type: 'lead', name, priority: index + 1, isSystemStatus: true, isDefaultStatus: index === 0, defaultGuard: index === 0 ? 'lead' : null },
      select: { id: true },
    }));
  }
  return result;
}

/** Melengkapi fixture demo Lead saja; Lead pengguna tidak pernah dipilih atau diubah. */
export async function seedCompleteLeadData(prisma: PrismaClient, tenantId: string, salesUsers: SeedSalesUser[]) {
  if (!salesUsers.length) return;
  const [stages, statuses, projects] = await Promise.all([
    ensureLeadStages(prisma, tenantId),
    ensureLeadStatuses(prisma, tenantId),
    prisma.product.findMany({ where: { tenantId, isActive: true }, include: { variants: { orderBy: { name: 'asc' }, take: 1 } }, orderBy: { name: 'asc' } }),
  ]);
  if (!projects.length || !stages.length) throw new Error('Lead demo data requires active projects and lead pipeline stages.');

  const sources = new Map<string, { id: string }>();
  for (const source of sourceDefinitions) {
    const existing = await prisma.source.findFirst({ where: { tenantId, type: 'lead', name: source.name }, select: { id: true } });
    sources.set(source.name, existing ?? await prisma.source.create({ data: { tenantId, type: 'lead', ...source, description: `Fixture demo Lead: ${source.name}`, isActive: true }, select: { id: true } }));
  }
  const labels = new Map<string, { id: string }>();
  for (const label of labelDefinitions) {
    const existing = await prisma.leadLabel.findFirst({ where: { tenantId, type: label.type, name: label.name }, select: { id: true } });
    labels.set(label.name, existing ?? await prisma.leadLabel.create({ data: { tenantId, ...label, description: `Fixture demo Lead: ${label.name}`, isActive: true }, select: { id: true } }));
  }
  const campaigns = new Map<string, { id: string }>();
  for (const source of sourceDefinitions) {
    const sourceId = sources.get(source.name)!.id;
    const campaign = await prisma.leadCampaign.upsert({
      where: { sourceId_name: { sourceId, name: `${source.name} Q4 Demo` } },
      update: { isActive: true },
      create: { tenantId, sourceId, name: `${source.name} Q4 Demo`, description: `Campaign fixture dari ${source.name}`, isActive: true },
      select: { id: true },
    });
    campaigns.set(source.name, campaign);
  }

  const fixtures = await prisma.lead.findMany({
    where: {
      tenantId,
      isDeleted: false,
      OR: [
        { customer: { email: { startsWith: 'visit-demo-' } } },
        { customer: { email: { startsWith: 'deal-demo-' } } },
      ],
    },
    include: { customer: { select: { id: true } } },
    orderBy: { createdAt: 'asc' },
  });
  let refreshed = 0;
  for (const [index, lead] of fixtures.entries()) {
    const source = sourceDefinitions[index % sourceDefinitions.length]!;
    const project = projects[index % projects.length]!;
    const variant = project.variants[0];
    const primaryLabel = labelDefinitions[index % 3]!;
    const tagLabel = labelDefinitions[3 + (index % 2)]!;
    const sales = salesUsers[index % salesUsers.length]!;
    const activityAt = new Date(); activityAt.setDate(activityAt.getDate() - (index % 18)); activityAt.setHours(9 + (index % 7), 0, 0, 0);
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: lead.id }, data: {
        assignedUserId: sales.id, sourceId: sources.get(source.name)!.id, stageId: stages[index % stages.length]!.id,
        statusId: statuses[index % statuses.length]!.id, projectId: project.id, productVariantId: variant?.id ?? null,
        priority: (['LOW', 'MEDIUM', 'HIGH'] as const)[index % 3]!, type: 'VISIT_DEMO', budget: BigInt(350_000_000 + index * 25_000_000),
        needsNotes: `Mencari ${project.name}${variant ? ` ${variant.name}` : ''}; fixture kebutuhan Lead lengkap.`, campaignId: campaigns.get(source.name)!.id,
      } });
      for (const label of [primaryLabel, tagLabel]) {
        await tx.leadLabelAssignment.upsert({ where: { leadId_labelId: { leadId: lead.id, labelId: labels.get(label.name)!.id } }, update: {}, create: { tenantId, leadId: lead.id, labelId: labels.get(label.name)!.id } });
      }
      const interest = await tx.leadInterest.findFirst({ where: { leadId: lead.id, productId: project.id, variantId: variant?.id ?? null }, select: { id: true } });
      if (!interest) await tx.leadInterest.create({ data: { tenantId, leadId: lead.id, productId: project.id, variantId: variant?.id ?? null } });
      const activity = await tx.leadActivity.findFirst({ where: { tenantId, leadId: lead.id, activityType: 'seed_follow_up' }, select: { id: true } });
      if (activity) await tx.leadActivity.update({ where: { id: activity.id }, data: { actorId: sales.id, createdAt: activityAt } });
      else await tx.leadActivity.create({ data: { tenantId, leadId: lead.id, customerId: lead.customer.id, actorId: sales.id, activityType: 'seed_follow_up', createdAt: activityAt } });
    });
    refreshed += 1;
  }
  console.log(`Completed ${refreshed} Lead demo fixture(s) with source, campaign, label, interest, budget, stage, status, and activity.`);
}
