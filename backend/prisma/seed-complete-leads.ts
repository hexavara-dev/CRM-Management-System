import 'dotenv/config';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { seedCompleteLeadData } from './seed/completeLeadData.js';

function assertLocalDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('Lead demo seeding is disabled in production.');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  if (!['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname.toLowerCase())) {
    throw new Error('Lead demo seeding only runs against a local database.');
  }
}

async function main() {
  assertLocalDatabase();
  const ownerEmail = process.argv.find((item) => item.startsWith('--owner-email='))?.slice('--owner-email='.length) ?? 'owner@example.com';
  const owner = await prisma.user.findFirst({ where: { email: ownerEmail, role: 'owner' }, select: { tenantId: true } });
  if (!owner) throw new Error(`Owner ${ownerEmail} was not found.`);
  const salesUsers = await prisma.user.findMany({
    where: { tenantId: owner.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true },
  });
  await seedCompleteLeadData(prisma, owner.tenantId, salesUsers);
}

main()
  .catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
