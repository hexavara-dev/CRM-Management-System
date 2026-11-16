import 'dotenv/config';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { PrismaGenericRepository } from '../src/infrastructure/repositories/PrismaGenericRepository.js';
import { AuthUseCases } from '../src/usecases/auth/AuthUseCases.js';
import { seedReservationData } from './seed/reservationSeed.js';

const TENANT_NAME = 'Demo Organization';
// Hanya untuk akun demo lokal. Jangan dipakai di server yang bisa diakses orang lain.
const SEED_PASSWORD = 'password123';
const OWNER = { email: 'owner@example.com', name: 'Demo Owner', role: 'owner' };
const MEMBER = { email: 'member@example.com', name: 'Demo Member', role: 'member' };

function assertExpectedRole(user: { email: string; role: string }, role: string) {
  if (user.role !== role) {
    throw new Error(`${user.email} already exists with role "${user.role}", expected "${role}".`);
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The seeder is for local development and cannot run in production.');
  }

  // Akun dibuat lewat use case agar hash password dan status bawaan sama dengan pendaftaran asli.
  const db = prisma as any;
  const authUseCases = new AuthUseCases(
    new PrismaGenericRepository(db.user, 'user'),
    new PrismaGenericRepository(db.invite, 'invite'),
    new PrismaGenericRepository(db.company, 'company'),
    new PrismaGenericRepository(db.status, 'status'),
    prisma
  );

  let owner = await prisma.user.findUnique({ where: { email: OWNER.email } });
  if (owner) {
    assertExpectedRole(owner, OWNER.role);
    console.log(`Skipped ${OWNER.email}: already exists`);
  } else {
    const result = await authUseCases.onboard(TENANT_NAME, OWNER.email, SEED_PASSWORD, OWNER.name);
    owner = result.user;
    console.log(`Created ${OWNER.email} (${OWNER.role})`);
  }

  const member = await prisma.user.findUnique({ where: { email: MEMBER.email } });
  if (member) {
    assertExpectedRole(member, MEMBER.role);
    if (member.tenantId !== owner!.tenantId) {
      throw new Error(`${MEMBER.email} already exists in another tenant.`);
    }
    console.log(`Skipped ${MEMBER.email}: already exists`);
  } else {
    await authUseCases.register(SEED_PASSWORD, MEMBER.name, MEMBER.email, owner!.tenantId);
    console.log(`Created ${MEMBER.email} (${MEMBER.role})`);
  }

  const salesDefinitions = [
    { email: 'rafi.firmansyah@example.com', name: 'Rafi Firmansyah' },
    { email: 'dewi.lestari@example.com', name: 'Dewi Lestari' },
    { email: 'rizki.ramadhan@example.com', name: 'Rizki Ramadhan' },
    { email: 'aulia.rahman@example.com', name: 'Aulia Rahman' },
    { email: 'nabila.fitriani@example.com', name: 'Nabila Fitriani' },
  ];
  const salesUsers = [];
  for (const definition of salesDefinitions) {
    const existing = await prisma.user.findUnique({ where: { email: definition.email } });
    if (existing) {
      if (existing.tenantId !== owner!.tenantId) {
        throw new Error(`${definition.email} already exists in another tenant.`);
      }
      salesUsers.push(existing);
      continue;
    }

    await authUseCases.register(SEED_PASSWORD, definition.name, definition.email, owner!.tenantId);
    const created = await prisma.user.findUnique({ where: { email: definition.email } });
    if (!created) throw new Error(`Could not load seeded sales user ${definition.email}.`);
    salesUsers.push(created);
  }

  await seedReservationData(prisma, owner!.tenantId, salesUsers);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
