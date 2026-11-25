import type { PrismaClient } from '@prisma/client';

type SeedSalesUser = { id: string; name: string | null; email: string };

const DEMO_EMAIL = 'survey-demo@example.com';
const DEMO_LOCATION = 'Green Sukun';
const DEMO_SLOT = 'Tipe 45 (GS-07)';

/**
 * Data demo Informasi Survey / Jadwal Visit: satu lead dengan jadwal visit (tabel Visit Schedule)
 * 3 hari ke depan lengkap dengan lokasi + unit. Aktivitas Visit hanyalah catatan terpisah.
 * Sengaja tanpa foto: gambar di kartu berasal dari foto tipe rumah (master produk), jadi tanpa
 * foto tipe kartu menampilkan placeholder.
 * Idempotent: jika customer demo sudah ada, seluruh langkah dilewati.
 */
export async function seedSurveyDemo(prisma: PrismaClient, tenantId: string, salesUsers: SeedSalesUser[]) {
  const existing = await prisma.customer.findFirst({ where: { tenantId, email: DEMO_EMAIL }, select: { id: true } });
  if (existing) {
    console.log('Skipped survey demo: data sudah ada.');
    return;
  }

  const sales = salesUsers[0];
  const project = await prisma.product.findFirst({ where: { tenantId, isActive: true }, select: { id: true } });
  const [leadStage, leadStatus, viewingStatus] = await Promise.all([
    prisma.stage.findFirst({ where: { tenantId, entityType: 'lead', isDefaultStage: true }, select: { id: true } }),
    prisma.status.findFirst({ where: { tenantId, type: 'lead', isDefaultStatus: true }, select: { id: true } }),
    prisma.status.findFirst({ where: { tenantId, type: 'viewing', name: 'Terjadwal' }, select: { id: true } }),
  ]);

  const location =
    (await prisma.location.findFirst({ where: { tenantId, name: DEMO_LOCATION }, select: { id: true } })) ??
    (await prisma.location.create({ data: { tenantId, name: DEMO_LOCATION }, select: { id: true } }));
  const slot =
    (await prisma.inventorySlot.findFirst({
      where: { tenantId, locationId: location.id, label: DEMO_SLOT },
      select: { id: true },
    })) ??
    (await prisma.inventorySlot.create({
      data: { tenantId, locationId: location.id, label: DEMO_SLOT },
      select: { id: true },
    }));

  const customer = await prisma.customer.create({
    data: {
      tenantId,
      firstName: 'Rizal',
      lastName: 'Hakim',
      email: DEMO_EMAIL,
      phoneNumber: '+62 812 3456 7890',
    },
    select: { id: true },
  });
  const lead = await prisma.lead.create({
    data: {
      tenantId,
      customerId: customer.id,
      assignedUserId: sales?.id ?? null,
      projectId: project?.id ?? null,
      stageId: leadStage?.id ?? null,
      statusId: leadStatus?.id ?? null,
    },
    select: { id: true },
  });

  // Survey 3 hari ke depan pukul 10:00 (waktu lokal).
  const surveyAt = new Date();
  surveyAt.setDate(surveyAt.getDate() + 3);
  surveyAt.setHours(10, 0, 0, 0);

  await prisma.leadActivity.create({
    data: {
      tenantId,
      leadId: lead.id,
      customerId: customer.id,
      actorId: sales?.id ?? null,
      activityType: 'visit',
      activityDate: surveyAt,
      notes: {
        create: { title: 'visit', content: 'Survey lokasi Green Sukun, cek unit Tipe 45 dan bawa denah.' },
      },
    },
  });

  await prisma.viewing.create({
    data: {
      tenantId,
      leadId: lead.id,
      actorId: sales?.id ?? null,
      locationId: location.id,
      slotId: slot.id,
      statusId: viewingStatus?.id ?? null,
      name: 'Rizal Hakim',
      email: DEMO_EMAIL,
      scheduledAt: surveyAt,
      durationMinutes: 60,
    },
  });

  console.log(`Survey demo dibuat: lead ${lead.id}, survey ${surveyAt.toDateString()} 10:00.`);
}
