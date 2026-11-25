import { jest } from '@jest/globals';
import { UploadUseCases } from '../src/usecases/upload/UploadUseCases.js';
import { localStorage } from '../src/infrastructure/storage/localStorage.js';

const uploadedFile = {
  originalname: 'proposal.pdf',
  mimetype: 'application/pdf',
  size: 4,
  buffer: Buffer.from('test'),
} as Express.Multer.File;

function createStorageMock() {
  return {
    upload: jest.fn(async () => undefined),
    getPublicUrl: jest.fn(() => ({
      publicUrl: 'http://localhost:3000/uploads/tenant-1/lead/lead-1/proposal.pdf',
    })),
    getFilePathFromPublicUrl: jest.fn(() => 'tenant-1/lead/lead-1/proposal.pdf'),
    read: jest.fn(async () => Buffer.from('backup')),
    removeStrict: jest.fn(async () => true),
    remove: jest.fn(async () => undefined),
  };
}

describe('UploadUseCases consistency', () => {
  it('rejects path traversal in stored public URLs', () => {
    expect(() =>
      localStorage.getFilePathFromPublicUrl(
        'http://localhost:3000/uploads/tenant-1/%2e%2e/%2e%2e/private.txt'
      )
    ).toThrow();
  });

  it('removes an uploaded file when attachment database creation fails', async () => {
    const storage = createStorageMock();
    const attachmentRepo = {
      create: jest.fn(async () => {
        throw new Error('database failed');
      }),
    };
    const leadRepo = {
      findOne: jest.fn(async () => ({ id: 'lead-1', tenantId: 'tenant-1' })),
    };
    const useCases = new UploadUseCases(
      {} as any,
      attachmentRepo as any,
      leadRepo as any,
      undefined,
      storage as any
    );

    await expect(
      useCases.uploadAttachment('lead-1', 'lead', uploadedFile, 'tenant-1')
    ).rejects.toThrow('database failed');
    expect(storage.remove).toHaveBeenCalledWith([
      expect.stringContaining('tenant-1/lead/lead-1/'),
    ]);
  });

  it('stores the authenticated uploader and links the attachment to a tenant-scoped activity', async () => {
    const storage = createStorageMock();
    const attachmentRepo = { create: jest.fn(async (data: unknown) => ({ id: 'att-1', ...(data as object) })) };
    const leadRepo = { findOne: jest.fn(async () => ({ id: 'lead-1', tenantId: 'tenant-1' })) };
    const activityRepo = { findOne: jest.fn(async () => ({ id: 'act-1' })) };
    const useCases = new UploadUseCases(
      {} as any,
      attachmentRepo as any,
      leadRepo as any,
      undefined,
      storage as any,
      activityRepo as any
    );

    await useCases.uploadAttachment('lead-1', 'lead', uploadedFile, 'tenant-1', 'user-1', 'act-1');

    expect(activityRepo.findOne).toHaveBeenCalledWith({ id: 'act-1', tenantId: 'tenant-1', leadId: 'lead-1' });
    expect(attachmentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedBy: { connect: { id: 'user-1' } },
        leadActivity: { connect: { id: 'act-1' } },
      })
    );
  });

  it('rejects linking to an activity outside the lead/tenant without touching storage', async () => {
    const storage = createStorageMock();
    const leadRepo = { findOne: jest.fn(async () => ({ id: 'lead-1', tenantId: 'tenant-1' })) };
    const activityRepo = { findOne: jest.fn(async () => null) };
    const useCases = new UploadUseCases(
      {} as any,
      { create: jest.fn() } as any,
      leadRepo as any,
      undefined,
      storage as any,
      activityRepo as any
    );

    await expect(
      useCases.uploadAttachment('lead-1', 'lead', uploadedFile, 'tenant-1', 'user-1', 'other-act')
    ).rejects.toThrow('Activity not found');
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('does not touch storage when an attachment is outside the tenant', async () => {
    const storage = createStorageMock();
    const attachmentRepo = { findOne: jest.fn(async () => null) };
    const useCases = new UploadUseCases(
      {} as any,
      attachmentRepo as any,
      undefined,
      undefined,
      storage as any
    );

    await expect(useCases.deleteAttachment('attachment-1', 'tenant-1')).rejects.toThrow(
      'Attachment not found'
    );
    expect(storage.removeStrict).not.toHaveBeenCalled();
  });

  it('restores the file when database deletion fails', async () => {
    const storage = createStorageMock();
    const attachmentRepo = {
      findOne: jest.fn(async () => ({
        id: 'attachment-1',
        tenantId: 'tenant-1',
        fileUrl: 'http://localhost:3000/uploads/tenant-1/lead/lead-1/proposal.pdf',
      })),
      delete: jest.fn(async () => {
        throw new Error('database failed');
      }),
    };
    const useCases = new UploadUseCases(
      {} as any,
      attachmentRepo as any,
      undefined,
      undefined,
      storage as any
    );

    await expect(useCases.deleteAttachment('attachment-1', 'tenant-1')).rejects.toThrow(
      'database failed'
    );
    expect(storage.removeStrict).toHaveBeenCalled();
    expect(storage.upload).toHaveBeenCalledWith(
      'tenant-1/lead/lead-1/proposal.pdf',
      Buffer.from('backup')
    );
  });
});
