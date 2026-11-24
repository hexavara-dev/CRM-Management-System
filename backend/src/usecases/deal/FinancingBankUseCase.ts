import type { PrismaClient } from '@prisma/client';

export type FinancingBankInput = { name: string; logoUrl?: string | null; isActive?: boolean };

export class FinancingBankUseCase {
  constructor(private prisma: PrismaClient) {}

  list(tenantId: string, activeOnly = false) {
    return this.prisma.financingBank.findMany({
      where: { tenantId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  create(tenantId: string, input: FinancingBankInput) {
    return this.prisma.financingBank.create({
      data: {
        tenantId,
        name: input.name.trim(),
        logoUrl: input.logoUrl?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });
  }

  async update(id: string, tenantId: string, input: Partial<FinancingBankInput>) {
    const bank = await this.prisma.financingBank.findFirst({ where: { id, tenantId } });
    if (!bank) throw new Error('Financing bank not found');
    return this.prisma.financingBank.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl?.trim() || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const bank = await this.prisma.financingBank.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { deals: true } } },
    });
    if (!bank) throw new Error('Financing bank not found');
    if (bank._count.deals > 0) throw new Error('Financing bank is still used by Deals');
    await this.prisma.financingBank.delete({ where: { id } });
    return { message: 'Financing bank deleted' };
  }
}
