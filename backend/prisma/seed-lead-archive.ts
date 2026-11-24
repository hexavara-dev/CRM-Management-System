import 'dotenv/config';
import { prisma } from '../src/infrastructure/database/prisma.js';

type ArchiveFixture = {
  key: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: 'male' | 'female';
  category: 'NOT_RESPOND' | 'INVALID' | 'NOT_QUALIFIED';
  reason: string;
  daysAgo: number;
  source: string;
  stageIndex: number;
  projectIndex: number;
  salesIndex: number;
};

const fixtures: ArchiveFixture[] = [
  { key: 'rendra-utama', firstName: 'Rendra', lastName: 'Utama', phone: '0812 8841 2097', gender: 'male', category: 'NOT_RESPOND', reason: 'Tiga kali follow-up telepon dan WhatsApp belum mendapat respons.', daysAgo: 2, source: 'Meta Ads', stageIndex: 1, projectIndex: 0, salesIndex: 0 },
  { key: 'melati-kusuma', firstName: 'Melati', lastName: 'Kusuma', phone: '0857 1324 6780', gender: 'female', category: 'NOT_RESPOND', reason: 'Meminta dihubungi kembali setelah jam kerja, tetapi tidak dapat dihubungi pada jadwal berikutnya.', daysAgo: 4, source: 'Website', stageIndex: 1, projectIndex: 1, salesIndex: 1 },
  { key: 'fajar-nugroho', firstName: 'Fajar', lastName: 'Nugroho', phone: '0813 7640 5521', gender: 'male', category: 'NOT_RESPOND', reason: 'Nomor aktif, namun pesan penawaran tidak pernah dibaca selama dua minggu.', daysAgo: 7, source: 'Google Ads', stageIndex: 2, projectIndex: 2, salesIndex: 2 },
  { key: 'citra-wulandari', firstName: 'Citra', lastName: 'Wulandari', phone: '0821 3005 8844', gender: 'female', category: 'NOT_RESPOND', reason: 'Tidak hadir pada jadwal call yang sudah dikonfirmasi.', daysAgo: 11, source: 'Instagram Organik', stageIndex: 1, projectIndex: 0, salesIndex: 3 },
  { key: 'arya-pradana', firstName: 'Arya', lastName: 'Pradana', phone: '0878 9612 5033', gender: 'male', category: 'NOT_RESPOND', reason: 'Follow-up terakhir setelah kunjungan site tidak mendapat tanggapan.', daysAgo: 16, source: 'Walk In', stageIndex: 3, projectIndex: 1, salesIndex: 4 },
  { key: 'nisa-ramadhani', firstName: 'Nisa', lastName: 'Ramadhani', phone: '0819 4210 7786', gender: 'female', category: 'NOT_RESPOND', reason: 'Prospek berhenti membalas setelah meminta simulasi cicilan.', daysAgo: 23, source: 'Referral', stageIndex: 2, projectIndex: 2, salesIndex: 0 },
  { key: 'bagas-mahardika', firstName: 'Bagas', lastName: 'Mahardika', phone: '0812 5550 1908', gender: 'male', category: 'INVALID', reason: 'Nomor telepon tidak aktif saat diverifikasi oleh sales.', daysAgo: 1, source: 'Meta Ads', stageIndex: 0, projectIndex: 0, salesIndex: 1 },
  { key: 'viona-salsabila', firstName: 'Viona', lastName: 'Salsabila', phone: '0858 9021 4300', gender: 'female', category: 'INVALID', reason: 'Data masuk dua kali dari formulir campaign yang sama.', daysAgo: 5, source: 'Website', stageIndex: 0, projectIndex: 1, salesIndex: 2 },
  { key: 'dimas-saputra', firstName: 'Dimas', lastName: 'Saputra', phone: '0813 4098 2216', gender: 'male', category: 'INVALID', reason: 'Nomor yang diberikan milik pihak lain dan bukan calon pembeli.', daysAgo: 9, source: 'Google Ads', stageIndex: 1, projectIndex: 2, salesIndex: 3 },
  { key: 'indah-permata', firstName: 'Indah', lastName: 'Permata', phone: '0822 6170 9455', gender: 'female', category: 'INVALID', reason: 'Alamat email dan nomor telepon tidak dapat diverifikasi.', daysAgo: 18, source: 'Instagram Organik', stageIndex: 0, projectIndex: 0, salesIndex: 4 },
  { key: 'surya-atmaja', firstName: 'Surya', lastName: 'Atmaja', phone: '0895 6112 8037', gender: 'male', category: 'INVALID', reason: 'Permintaan berasal dari luar area pemasaran dan salah memilih formulir.', daysAgo: 29, source: 'Walk In', stageIndex: 0, projectIndex: 1, salesIndex: 0 },
  { key: 'ratih-anggraini', firstName: 'Ratih', lastName: 'Anggraini', phone: '0817 2904 1186', gender: 'female', category: 'NOT_QUALIFIED', reason: 'Budget yang tersedia belum sesuai dengan harga unit dan skema pembayaran.', daysAgo: 3, source: 'Referral', stageIndex: 2, projectIndex: 2, salesIndex: 1 },
  { key: 'galang-wicaksono', firstName: 'Galang', lastName: 'Wicaksono', phone: '0811 7783 4290', gender: 'male', category: 'NOT_QUALIFIED', reason: 'Mencari properti untuk disewa, bukan untuk pembelian.', daysAgo: 6, source: 'Meta Ads', stageIndex: 1, projectIndex: 0, salesIndex: 2 },
  { key: 'sari-novitasari', firstName: 'Sari', lastName: 'Novitasari', phone: '0856 2109 6734', gender: 'female', category: 'NOT_QUALIFIED', reason: 'Lokasi proyek tidak sesuai dengan area tempat kerja yang diinginkan.', daysAgo: 12, source: 'Website', stageIndex: 3, projectIndex: 1, salesIndex: 3 },
  { key: 'kevin-haryanto', firstName: 'Kevin', lastName: 'Haryanto', phone: '0812 3439 0715', gender: 'male', category: 'NOT_QUALIFIED', reason: 'Rencana pembelian masih lebih dari dua tahun dan belum membutuhkan follow-up aktif.', daysAgo: 20, source: 'Google Ads', stageIndex: 2, projectIndex: 2, salesIndex: 4 },
  { key: 'laila-fauziah', firstName: 'Laila', lastName: 'Fauziah', phone: '0818 0675 3391', gender: 'female', category: 'NOT_QUALIFIED', reason: 'Memilih tipe unit yang sudah tidak tersedia dan tidak tertarik pada alternatif.', daysAgo: 35, source: 'Instagram Organik', stageIndex: 3, projectIndex: 0, salesIndex: 0 },
  { key: 'yusuf-kurniawan', firstName: 'Yusuf', lastName: 'Kurniawan', phone: '0877 1940 6628', gender: 'male', category: 'NOT_QUALIFIED', reason: 'Masih menunggu keputusan keluarga sehingga proses pembelian belum dapat dilanjutkan.', daysAgo: 48, source: 'Walk In', stageIndex: 2, projectIndex: 1, salesIndex: 1 },
];

function assertLocalDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('Lead archive seeding is disabled in production.');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  if (!['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname.toLowerCase())) {
    throw new Error('Lead archive seeding only runs against a local database.');
  }
}

function archivedDate(daysAgo: number) {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  value.setHours(9 + (daysAgo % 7), 10 + ((daysAgo * 7) % 45), 0, 0);
  return value;
}

async function resolveTenantId() {
  const ownerEmail = process.argv.find((item) => item.startsWith('--owner-email='))?.slice('--owner-email='.length) ?? process.env.SEED_OWNER_EMAIL;
  const owners = await prisma.user.findMany({ where: { role: 'owner', ...(ownerEmail ? { email: ownerEmail } : {}) }, select: { tenantId: true }, distinct: ['tenantId'] });
  if (owners.length === 0) throw new Error('No owner tenant found. Run npm run db:seed first or pass --owner-email=<owner email>.');
  if (owners.length > 1) throw new Error('Multiple owner tenants found. Pass --owner-email=<owner email>.');
  return owners[0]!.tenantId;
}

async function ensureSources(tenantId: string) {
  const sourceNames = [...new Set(fixtures.map((item) => item.source))];
  const colors = ['#1877F2', '#3B82F6', '#EA4335', '#E1306C', '#475467', '#22A06B'];
  const sources = [];
  for (const [index, name] of sourceNames.entries()) {
    const existing = await prisma.source.findFirst({ where: { tenantId, type: 'lead', name } });
    sources.push(existing ?? await prisma.source.create({ data: { tenantId, type: 'lead', name, color: colors[index], description: `Fixture Arsip Leads: ${name}`, isActive: true } }));
  }
  return new Map(sources.map((source) => [source.name, source]));
}

async function ensureStages(tenantId: string) {
  const current = await prisma.stage.findMany({ where: { tenantId, entityType: 'lead', isActive: true }, orderBy: { position: 'asc' } });
  if (current.length > 0) return current;
  const defaults = [
    { name: 'Lead Baru', position: 0, color: '#98A2B3', isDefaultStage: true },
    { name: 'Komunikasi Awal', position: 1, color: '#2E90FA', isDefaultStage: false },
    { name: 'Follow Up', position: 2, color: '#F79009', isDefaultStage: false },
    { name: 'Qualified', position: 3, color: '#12B76A', isDefaultStage: false },
  ];
  await prisma.stage.createMany({ data: defaults.map((stage) => ({ tenantId, entityType: 'lead', isTerminalStage: false, isActive: true, probability: 0, ...stage, defaultGuard: stage.isDefaultStage ? 'lead' : null })) });
  return prisma.stage.findMany({ where: { tenantId, entityType: 'lead', isActive: true }, orderBy: { position: 'asc' } });
}

async function main() {
  assertLocalDatabase();
  console.log(`Prepared ${fixtures.length} varied Lead archive fixtures (Not Respond: 6, Invalid: 5, Not Qualified: 6).`);
  if (!process.argv.includes('--apply')) {
    console.log('Dry run only. Add --apply to write fixtures; the script is idempotent.');
    return;
  }
  const tenantId = await resolveTenantId();
  const [sourcesByName, stages, users, projects] = await Promise.all([
    ensureSources(tenantId),
    ensureStages(tenantId),
    prisma.user.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
    prisma.product.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } }),
  ]);
  if (users.length === 0) throw new Error('No users found for this tenant.');

  let created = 0;
  let updated = 0;
  for (const fixture of fixtures) {
    const email = `archive-seed-${fixture.key}@example.test`;
    const archivedAt = archivedDate(fixture.daysAgo);
    const assignedUser = users[fixture.salesIndex % users.length]!;
    const stage = stages[fixture.stageIndex % stages.length];
    const project = projects[fixture.projectIndex % Math.max(projects.length, 1)];
    const source = sourcesByName.get(fixture.source);
    await prisma.$transaction(async (tx) => {
      const existingCustomer = await tx.customer.findFirst({ where: { tenantId, email }, select: { id: true } });
      const customer = existingCustomer ?? await tx.customer.create({
        data: {
          tenant: { connect: { id: tenantId } },
          firstName: fixture.firstName,
          lastName: fixture.lastName,
          phoneNumber: fixture.phone,
          email,
          gender: fixture.gender,
        },
        select: { id: true },
      });
      const lead = existingCustomer
        ? await tx.lead.findFirst({ where: { tenantId, customerId: customer.id }, select: { id: true } })
        : null;
      const leadData = {
        tenantId,
        assignedUserId: assignedUser.id,
        sourceId: source?.id,
        stageId: stage?.id,
        projectId: project?.id,
        priority: fixture.category === 'NOT_QUALIFIED' ? 'LOW' as const : 'MEDIUM' as const,
        archiveCategory: fixture.category,
        archiveReason: fixture.reason,
        archivedAt,
        archivedById: assignedUser.id,
      };
      const saved = lead
        ? await tx.lead.update({ where: { id: lead.id }, data: leadData })
        : await tx.lead.create({ data: { ...leadData, customerId: customer.id } });
      if (lead) updated += 1; else created += 1;
      const [activity, audit] = await Promise.all([
        tx.leadActivity.findFirst({ where: { tenantId, leadId: saved.id, activityType: 'archive' }, select: { id: true } }),
        tx.auditLog.findFirst({ where: { tenantId, entityId: saved.id, entityType: 'lead', action: 'archive' }, select: { id: true } }),
      ]);
      if (!activity) await tx.leadActivity.create({ data: { tenantId, leadId: saved.id, customerId: saved.customerId, actorId: assignedUser.id, activityType: 'archive', createdAt: archivedAt } });
      if (!audit) await tx.auditLog.create({ data: { tenantId, entityId: saved.id, entityType: 'lead', actorId: assignedUser.id, action: 'archive', changes: { category: fixture.category, reason: fixture.reason, seeded: true }, createdAt: archivedAt } });
    });
  }
  console.log(`Lead archive seed complete: ${created} created, ${updated} refreshed.`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
