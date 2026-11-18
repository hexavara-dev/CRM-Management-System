import type { PrismaClient, TrackingType } from '@prisma/client';

export const TRACKING_TYPES = ['QUANTITY', 'UNIT', 'BOTH'] as const satisfies readonly TrackingType[];

export const unitTrackingEnabled = (mode: TrackingType) => mode !== 'QUANTITY';
export const quantityTrackingEnabled = (mode: TrackingType) => mode !== 'UNIT';

/** Pengaturan global metode inventory per company (`company.tracking_type`). */
export class InventoryTrackingUseCase {
  constructor(private prisma: PrismaClient) {}

  async modeOf(tenantId: string): Promise<TrackingType> {
    const company = await this.prisma.company.findUnique({
      where: { id: tenantId },
      select: { trackingType: true },
    });
    if (!company) throw new Error('Company not found');
    return company.trackingType;
  }

  private async unitUsage(tenantId: string) {
    const units = await this.prisma.productUnit.findMany({
      where: { tenantId },
      select: { variant: { select: { productId: true } } },
    });
    return { unitCount: units.length, projectCount: new Set(units.map((u) => u.variant.productId)).size };
  }

  async get(tenantId: string) {
    const [mode, usage] = await Promise.all([this.modeOf(tenantId), this.unitUsage(tenantId)]);
    return {
      mode,
      unitTrackingEnabled: unitTrackingEnabled(mode),
      quantityTrackingEnabled: quantityTrackingEnabled(mode),
      ...usage,
    };
  }

  async update(tenantId: string, mode: TrackingType) {
    if (!unitTrackingEnabled(mode)) {
      const { unitCount, projectCount } = await this.unitUsage(tenantId);
      if (unitCount > 0) {
        throw new Error(
          `Cannot switch to quantity-based only while ${unitCount} units exist in ${projectCount} projects (conflict)`
        );
      }
    }
    await this.prisma.company.update({ where: { id: tenantId }, data: { trackingType: mode } });
    return this.get(tenantId);
  }

  /** Menolak pembuatan unit saat company memakai quantity-based only. */
  async assertUnitTracking(tenantId: string) {
    if (!unitTrackingEnabled(await this.modeOf(tenantId))) {
      throw new Error('Unit-based tracking is disabled for this company (conflict)');
    }
  }
}
