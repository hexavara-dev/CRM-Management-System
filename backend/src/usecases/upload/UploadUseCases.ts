import { localStorage } from '../../infrastructure/storage/localStorage.js';
import type { IRepository } from '../../domain/repositories/IRepository.js';
import type { PrismaGenericRepository } from '../../infrastructure/repositories/PrismaGenericRepository.js';
import type { Attachment, Prisma } from '@prisma/client';

export class UploadUseCases {
  constructor(
    private customerRepo: IRepository<any>,
    private attachmentRepo?: PrismaGenericRepository<Attachment, Prisma.AttachmentDelegate>,
    private leadRepo?: IRepository<any>,
    private dealRepo?: IRepository<any>,
    private storage: typeof localStorage = localStorage,
    private activityRepo?: IRepository<any>
  ) {}

  async uploadCustomerDocument(customerId: string, file: Express.Multer.File, tenantId: string) {
    const customer = await this.customerRepo.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    if (customer.tenantId !== tenantId) throw new Error('Unauthorized for this tenant');

    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${tenantId}/${customerId}/${fileName}`;

    await this.storage.upload(filePath, file.buffer);
    const { publicUrl } = this.storage.getPublicUrl(filePath);

    try {
      await this.customerRepo.update(customerId, {
        attachedDocument: publicUrl,
      });
    } catch (error) {
      await this.storage.remove([filePath]);
      throw error;
    }

    if (customer.attachedDocument && customer.attachedDocument !== publicUrl) {
      try {
        const oldFilePath = this.storage.getFilePathFromPublicUrl(customer.attachedDocument);
        await this.storage.remove([oldFilePath]);
      } catch (error) {
        console.error('Failed to clean up previous customer document:', error);
      }
    }

    return {
      message: 'File uploaded successfully',
      url: publicUrl,
    };
  }

  async uploadAttachment(
    entityId: string,
    entityType: 'lead' | 'deal',
    file: Express.Multer.File,
    tenantId: string,
    uploadedById?: string,
    leadActivityId?: string
  ) {
    if (!this.attachmentRepo) throw new Error('Attachment repository not initialized');
    const entityRepo = entityType === 'lead' ? this.leadRepo : this.dealRepo;
    if (!entityRepo) throw new Error('Entity repository not initialized');
    const entity = await entityRepo.findOne({
      id: entityId,
      tenantId,
      ...(entityType === 'lead' ? { isDeleted: false } : {}),
    });
    if (!entity) throw new Error(`${entityType === 'lead' ? 'Lead' : 'Deal'} not found`);

    if (leadActivityId) {
      if (entityType !== 'lead' || !this.activityRepo) {
        throw new Error('Activity can only be linked to a lead attachment');
      }
      const activity = await this.activityRepo.findOne({
        id: leadActivityId,
        tenantId,
        leadId: entityId,
      });
      if (!activity) throw new Error('Activity not found');
    }

    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}_${safeOriginalName}`;
    const filePath = `${tenantId}/${entityType}/${entityId}/${fileName}`;

    await this.storage.upload(filePath, file.buffer);
    const { publicUrl } = this.storage.getPublicUrl(filePath);

    const attachmentData: any = {
      tenant: { connect: { id: tenantId } },
      fileName: file.originalname,
      fileUrl: publicUrl,
      fileType: file.mimetype,
      fileSize: file.size,
    };

    if (uploadedById) attachmentData.uploadedBy = { connect: { id: uploadedById } };
    if (leadActivityId) attachmentData.leadActivity = { connect: { id: leadActivityId } };

    if (entityType === 'lead') {
      attachmentData.lead = { connect: { id: entityId } };
    } else {
      attachmentData.deal = { connect: { id: entityId } };
    }

    let attachment: Attachment;
    try {
      attachment = await this.attachmentRepo.create(attachmentData);
    } catch (error) {
      await this.storage.remove([filePath]);
      throw error;
    }

    return {
      message: 'File uploaded successfully',
      attachment,
    };
  }

  async deleteAttachment(attachmentId: string, tenantId: string) {
    if (!this.attachmentRepo) throw new Error('Attachment repository not initialized');
    const attachment = await this.attachmentRepo.findOne({ id: attachmentId, tenantId });
    if (!attachment) throw new Error('Attachment not found');

    const filePath = this.storage.getFilePathFromPublicUrl(attachment.fileUrl);
    const backup = await this.storage.read(filePath);
    await this.storage.removeStrict(filePath);

    try {
      await this.attachmentRepo.delete(attachmentId);
    } catch (error) {
      if (backup) {
        try {
          await this.storage.upload(filePath, backup);
        } catch (restoreError) {
          console.error('Failed to restore attachment after database delete failure:', restoreError);
        }
      }
      throw error;
    }

    return { message: 'Attachment deleted successfully' };
  }
}
