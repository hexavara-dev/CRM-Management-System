import type { AttributeDataType, AttributeSource, Prisma, PrismaClient } from '@prisma/client';

export type AttributeDefinitionInput = {
  name?: string;
  code?: string;
  dataType?: AttributeDataType;
  source?: AttributeSource;
  iconKey?: string | null;
  unit?: string | null;
};

/** Master data of attribute definitions (name, code, data type, unit). Values live in product_attributes. */
export class AttributeUseCase {
  constructor(private prisma: PrismaClient) {}

  async list(tenantId: string) {
    const data = await this.prisma.attribute.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    return { data };
  }

  private async find(id: string, tenantId: string) {
    const row = await this.prisma.attribute.findFirst({ where: { id, tenantId } });
    if (!row) throw new Error('Attribute not found');
    this.assertNotFacility(row.source);
    return row;
  }

  /** Fasilitas proyek hanya dikelola lewat ProjectFacilityUseCase, yang menjaga nama unik dan statusnya. */
  private assertNotFacility(source: AttributeSource | undefined) {
    if (source === 'PROJECT') throw new Error('Invalid source: project facilities must be managed through /api/project-facilities');
  }

  async create(tenantId: string, input: AttributeDefinitionInput) {
    if (!input.name || !input.code || !input.dataType) {
      throw new Error('name, code, and dataType are required');
    }
    this.assertNotFacility(input.source);
    return this.prisma.attribute.create({
      data: {
        tenantId,
        name: input.name,
        code: input.code,
        dataType: input.dataType,
        source: input.source ?? 'UNIT_TYPE',
        iconKey: input.iconKey ?? null,
        unit: input.unit ?? null,
      },
    });
  }

  async update(id: string, tenantId: string, input: AttributeDefinitionInput) {
    await this.find(id, tenantId);
    this.assertNotFacility(input.source);
    const data: Prisma.AttributeUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.code !== undefined) data.code = input.code;
    if (input.dataType !== undefined) data.dataType = input.dataType;
    if (input.source !== undefined) data.source = input.source;
    if (input.iconKey !== undefined) data.iconKey = input.iconKey;
    if (input.unit !== undefined) data.unit = input.unit;
    return this.prisma.attribute.update({ where: { id }, data });
  }

  /** Fails with a conflict while any product still holds a value for this attribute. */
  async remove(id: string, tenantId: string) {
    await this.find(id, tenantId);
    const used = await this.prisma.productAttribute.count({ where: { attributeId: id, tenantId } });
    if (used > 0) throw new Error('Attribute is still in use (conflict).');
    await this.prisma.attribute.delete({ where: { id } });
  }
}
