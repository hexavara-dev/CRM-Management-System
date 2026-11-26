import type { PrismaClient } from '@prisma/client';

type SeedSalesUser = {
  id: string;
  name: string | null;
  email: string;
};

// Tiga status tampilan Visit Schedule. Sengaja tanpa guard default/closing/failed:
// status sistem (direncanakan, sudah visit, gagal) tetap memegang alur upload-bukti dan fail.
const STATUS_DEFINITIONS = [
  { name: 'Terjadwal', color: '#16A34A', priority: 6 },
  { name: 'Selesai', color: '#7C3AED', priority: 7 },
  { name: 'Dibatalkan', color: '#DC2626', priority: 8 },
] as const;

const CUSTOMERS = [
  ['Ratna', 'Kusumawati'],
  ['Bambang', 'Hartono'],
  ['Andi', 'Setiawan'],
  ['Rina', 'Amelia'],
  ['Faisal', 'Hidayat'],
  ['Novi', 'Lestari'],
  ['Teguh', 'Wibowo'],
  ['Dewi', 'Kartika'],
  ['Agus', 'Pratama'],
  ['Sari', 'Wulandari'],
  ['Rizky', 'Aditya'],
  ['Arif', 'Nugroho'],
  ['Maya', 'Puspita'],
  ['Eko', 'Prasetyo'],
  ['Lina', 'Marlina'],
  ['Bayu', 'Saputra'],
  ['Tika', 'Anggraini'],
  ['Joko', 'Susilo'],
  ['Wulan', 'Dari'],
  ['Dimas', 'Maulana'],
  ['Putri', 'Handayani'],
  ['Yoga', 'Permana'],
  ['Citra', 'Ayu'],
  ['Gilang', 'Ramadhan'],
  ['Nanda', 'Kusuma'],
] as const;

// Beberapa hari memiliki dua visit supaya kalender terlihat realistis.
const VISIT_DAYS = [
  2, 3, 3, 5, 6, 7, 7, 9, 10, 12, 12, 14, 15, 16, 16, 17, 18, 19, 21, 21, 23, 24, 26, 27, 28,
];
const VISIT_HOURS = [9, 10, 11, 13, 14, 15, 16];
const DURATIONS = [60, 90, 30, 60, 45];
const STATUS_ROTATION = [0, 0, 1, 2] as const;

const markerFor = (index: number) => `[seed:visit-schedule:${String(index + 1).padStart(2, '0')}]`;

/**
 * Data demo Visit Schedule: 3 status baru + 25 customer/lead/visit.
 * Idempotent: setiap record dicari dulu (nama status, email customer, penanda di notes visit).
 */
export async function seedViewingSchedule(
  prisma: PrismaClient,
  tenantId: string,
  salesUsers: SeedSalesUser[]
) {
  if (salesUsers.length === 0) {
    console.log('Skipped visit schedule seed: no sales users.');
    return;
  }

  const statusIds: string[] = [];
  for (const definition of STATUS_DEFINITIONS) {
    const existing = await prisma.status.findFirst({
      where: { tenantId, type: 'viewing', name: definition.name },
      select: { id: true },
    });
    const status = existing
      ? await prisma.status.update({
          where: { id: existing.id },
          data: { color: definition.color, priority: definition.priority },
          select: { id: true },
        })
      : await prisma.status.create({
          data: { tenantId, type: 'viewing', isSystemStatus: false, ...definition },
          select: { id: true },
        });
    statusIds.push(status.id);
  }

  // Lokasi + unit untuk tiap visit.
  let places = await prisma.inventorySlot.findMany({
    where: { tenantId },
    orderBy: [{ locationId: 'asc' }, { label: 'asc' }],
    take: 12,
    select: { id: true, locationId: true },
  });
  if (places.length === 0) {
    const location = await prisma.location.create({
      data: { tenantId, name: 'Green Sukun' },
      select: { id: true },
    });
    const slot = await prisma.inventorySlot.create({
      data: { tenantId, locationId: location.id, label: 'Tipe 45 (GS-07)' },
      select: { id: true, locationId: true },
    });
    places = [slot];
  }

  const now = new Date();
  let created = 0;

  for (const [index, [firstName, lastName]] of CUSTOMERS.entries()) {
    const marker = markerFor(index);
    const alreadySeeded = await prisma.viewing.findFirst({
      where: { tenantId, notes: { startsWith: marker } },
      select: { id: true },
    });
    const place = places[index % places.length]!;
    if (alreadySeeded) {
      // Data lama tanpa lokasi/unit dilengkapi (idempotent, hanya yang masih kosong).
      await prisma.viewing.updateMany({
        where: { id: alreadySeeded.id, locationId: null },
        data: { locationId: place.locationId, slotId: place.id },
      });
      continue;
    }

    const email = `visit-demo-${String(index + 1).padStart(2, '0')}@example.com`;
    const customer =
      (await prisma.customer.findFirst({ where: { tenantId, email }, select: { id: true } })) ??
      (await prisma.customer.create({
        data: {
          tenantId,
          firstName,
          lastName,
          email,
          phoneNumber: `+62 81${index % 10} ${1000 + index * 37} ${2000 + index * 53}`,
        },
        select: { id: true },
      }));

    const sales = salesUsers[index % salesUsers.length]!;

    await prisma.viewing.create({
      data: {
        tenantId,
        customerId: customer.id,
        actorId: sales.id,
        locationId: place.locationId,
        slotId: place.id,
        statusId: statusIds[STATUS_ROTATION[index % STATUS_ROTATION.length]!]!,
        name: `${firstName} ${lastName}`,
        email,
        scheduledAt: new Date(
          now.getFullYear(),
          now.getMonth(),
          VISIT_DAYS[index]!,
          VISIT_HOURS[index % VISIT_HOURS.length]!,
          0
        ),
        durationMinutes: DURATIONS[index % DURATIONS.length]!,
        notes: `${marker} Data demo Visit Schedule`,
      },
    });
    created += 1;
  }

  console.log(
    `Seeded visit schedule: ${STATUS_DEFINITIONS.length} statuses ensured, ${created} new visits (${CUSTOMERS.length - created} already present).`
  );
}
