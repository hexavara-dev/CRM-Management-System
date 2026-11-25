import 'dotenv/config';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { seedSurveyDemo } from './seed/surveyDemoSeed.js';

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function assertLocalDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('Survey demo seeding is disabled in production.');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const host = new URL(databaseUrl).hostname.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('Survey demo seeding only runs against a local database.');
  }
}

async function main() {
  assertLocalDatabase();
  const ownerEmail = argument('owner-email') ?? process.env.SEED_OWNER_EMAIL;
  const owners = await prisma.user.findMany({
    where: { role: 'owner', ...(ownerEmail ? { email: ownerEmail } : {}) },
    select: { tenantId: true },
    distinct: ['tenantId'],
  });
  if (owners.length === 0) throw new Error('No owner tenant found. Run npm run db:seed first or pass --owner-email.');
  if (owners.length > 1) throw new Error('Multiple owner tenants found. Pass --owner-email=<owner email>.');
  const tenantId = owners[0]!.tenantId;
  const salesUsers = await prisma.user.findMany({
    where: { tenantId, role: { not: 'owner' } },
    orderBy: { email: 'asc' },
    select: { id: true, name: true, email: true },
  });
  await seedSurveyDemo(prisma, tenantId, salesUsers);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
