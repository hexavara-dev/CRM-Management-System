import 'dotenv/config';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { ProductUseCase } from '../src/usecases/product/ProductUseCase.js';
import { seedAttributeCatalog } from './seed/attributeCatalog.js';
import { buildRealisticProjectScenarios } from './seed/realisticProjects.js';

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function assertLocalDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('Realistic project seeding is disabled in production.');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const host = new URL(databaseUrl).hostname.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('Realistic project seeding only runs against a local database.');
  }
}

async function resolveTenantId() {
  const ownerEmail = argument('owner-email') ?? process.env.SEED_OWNER_EMAIL;
  const owners = await prisma.user.findMany({
    where: { role: 'owner', ...(ownerEmail ? { email: ownerEmail } : {}) },
    select: { tenantId: true },
    distinct: ['tenantId'],
  });
  if (owners.length === 0) throw new Error('No owner tenant found. Run npm run db:seed first or pass --owner-email.');
  if (owners.length > 1) throw new Error('Multiple owner tenants found. Pass --owner-email=<owner email>.');
  return owners[0]!.tenantId;
}

async function main() {
  assertLocalDatabase();
  const scenarios = buildRealisticProjectScenarios();
  const totalUnits = scenarios.reduce((sum, item) => sum + item.summary.units, 0);
  const totalLocations = scenarios.reduce((sum, item) => sum + item.summary.locations, 0);

  console.log(`Prepared ${scenarios.length} realistic projects, ${totalLocations} locations, ${totalUnits} units.`);
  for (const item of scenarios) {
    console.log(`- ${item.payload.code}: ${item.summary.locations} locations, ${item.summary.units} units`);
  }
  if (!process.argv.includes('--apply')) {
    console.log('Dry run only. Add --apply to write these projects to the local database.');
    return;
  }

  const tenantId = await resolveTenantId();
  await seedAttributeCatalog(prisma, tenantId);
  const facilityRows = await prisma.attribute.findMany({
    where: { tenantId, source: 'PROJECT' },
    select: { id: true, code: true },
  });
  const facilityIdByCode = new Map(facilityRows.map((item) => [item.code, item.id]));
  const products = new ProductUseCase(prisma);

  for (const item of scenarios) {
    const code = item.payload.code as string;
    const existing = await prisma.product.findFirst({ where: { tenantId, code }, select: { id: true } });
    if (existing) {
      console.log(`Skipped ${code}: already exists.`);
      continue;
    }
    const facilityAttributeIds = item.facilityCodes.map((facilityCode) => {
      const id = facilityIdByCode.get(facilityCode);
      if (!id) throw new Error(`Facility not found: ${facilityCode}`);
      return id;
    });
    const created = await products.create(tenantId, { ...item.payload, facilityAttributeIds });
    console.log(`Created ${code} (${created.id}) with ${item.summary.units} units.`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
