import type { PrismaClient } from '@prisma/client';

const publicUser = { id: true, name: true, email: true } as const;

export class CustomerProfileUseCase {
  constructor(private prisma: PrismaClient) {}

  async get(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        organization: true,
        leads: {
          where: { tenantId, isDeleted: false },
          include: {
            stage: true,
            status: true,
            source: true,
            assignedUser: { select: publicUser },
            deals: {
              where: { tenantId },
              include: {
                stage: true,
                status: true,
                assignedUser: { select: publicUser },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        leadActivities: {
          where: { tenantId },
          include: { actor: { select: publicUser }, notes: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        dealActivities: {
          where: { tenantId },
          include: { actor: { select: publicUser }, notes: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!customer) throw new Error('Customer not found');
    return customer;
  }
}
