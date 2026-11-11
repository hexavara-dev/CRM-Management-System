import type { Prisma, PrismaClient } from '@prisma/client';

export type CharacteristicInput = { group?: string; code?: string; name?: string };

export class CharacteristicUseCase {
  constructor(private prisma: PrismaClient) {}

  async list(tenantId: string) {
    const data = await this.prisma.characteristic.findMany({
      where: { tenantId },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });
    return { data };
  }

  private async find(id: string, tenantId: string) {
    const row = await this.prisma.characteristic.findFirst({ where: { id, tenantId } });
    if (!row) throw new Error('Characteristic not found');
    return row;
  }

  async create(tenantId: string, input: CharacteristicInput) {
    if (!input.group || !input.code || !input.name) {
      throw new Error('group, code, and name are required');
    }
    return this.prisma.characteristic.create({
      data: { tenantId, group: input.group, code: input.code, name: input.name },
    });
  }

  async update(id: string, tenantId: string, input: CharacteristicInput) {
    await this.find(id, tenantId);
    const data: Prisma.CharacteristicUpdateInput = {};
    if (input.group !== undefined) data.group = input.group;
    if (input.code !== undefined) data.code = input.code;
    if (input.name !== undefined) data.name = input.name;
    return this.prisma.characteristic.update({ where: { id }, data });
  }

  async remove(id: string, tenantId: string) {
    await this.find(id, tenantId);
    await this.prisma.characteristic.delete({ where: { id } });
  }
}
