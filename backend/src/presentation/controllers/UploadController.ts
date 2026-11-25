import type { Request, Response } from 'express';
import { UploadUseCases } from '../../usecases/upload/UploadUseCases.js';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';

export class UploadController {
  constructor(private uploadUseCases: UploadUseCases) {}

  async uploadCustomerDocument(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const tenantId = (req as any).user.tenantId;
      const result = await this.uploadUseCases.uploadCustomerDocument(
        req.params.id as string,
        req.file,
        tenantId
      );

      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async uploadAttachment(req: Request, res: Response, entityType: 'lead' | 'deal') {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { tenantId, userId } = (req as any).user;
      const activityId =
        typeof req.body?.activityId === 'string' && req.body.activityId.trim()
          ? req.body.activityId.trim()
          : undefined;
      const result = await this.uploadUseCases.uploadAttachment(
        req.params.id as string,
        entityType,
        req.file,
        tenantId,
        userId,
        activityId
      );

      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async deleteAttachment(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Tenant context missing' });
      const result = await this.uploadUseCases.deleteAttachment(
        req.params.id as string,
        tenantId
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }
}
