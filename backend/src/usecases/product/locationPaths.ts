import type { PrismaClient } from '@prisma/client';

/** Path lokasi tanpa proyek, mis. "Tower Arjuna > Lantai 1"; nomor unit bisa sama di lokasi lain. */
export async function loadLocationPaths(prisma: Pick<PrismaClient, 'productCategory'>, tenantId: string, ids: string[]) {
  const wanted = new Set(ids);
  if (wanted.size === 0) return new Map<string, string>();
  const rows = await prisma.productCategory.findMany({
    where: { tenantId },
    select: { id: true, name: true, type: true, parentId: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return new Map(
    [...wanted].map((id) => {
      const names: string[] = [];
      const seen = new Set<string>();
      for (let node = byId.get(id); node && node.type !== 'PROJECT' && !seen.has(node.id); ) {
        seen.add(node.id);
        names.unshift(node.name);
        node = node.parentId ? byId.get(node.parentId) : undefined;
      }
      return [id, names.join(' > ')];
    })
  );
}
