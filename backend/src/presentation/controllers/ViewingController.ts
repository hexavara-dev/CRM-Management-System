import type { Request, Response } from 'express';
import { ViewingUseCase } from '../../usecases/viewing/ViewingUseCase.js';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination } from '../../infrastructure/utils/RequestValidation.js';
import {
  validateViewingCreate,
  validateViewingFailure,
  validateViewingUpdate,
} from '../validation/CrmRequestValidation.js';

export class ViewingController {
  constructor(private viewingUseCase: ViewingUseCase) {}

  async create(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId;
      const body = validateViewingCreate(req.body);
      const data = await this.viewingUseCase.createViewing({ ...body, tenantId } as any);
      res.status(201).json(data);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { tenantId } = (req as any).user;
      const data = await this.viewingUseCase.getViewing(req.params.id as string, tenantId);
      res.json(data);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const { tenantId, userId, role } = (req as any).user || {};
      const { page, limit } = parsePagination(req.query as Record<string, unknown>);
      const data = await this.viewingUseCase.getAllViewings(
        tenantId,
        page,
        limit,
        req.query as Record<string, unknown>,
        { userId, role }
      );
      res.json(data);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { tenantId } = (req as any).user;
      const body = validateViewingUpdate(req.body);
      const data = await this.viewingUseCase.updateViewing(
        req.params.id as string,
        tenantId,
        body as any
      );
      res.json(data);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { tenantId } = (req as any).user;
      await this.viewingUseCase.deleteViewing(req.params.id as string, tenantId);
      res.status(204).send();
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async uploadEvidence(req: Request, res: Response) {
    try {
      const { tenantId } = (req as any).user;
      const file = req.file;

      if (!file) {
        throw new Error('No file uploaded');
      }

      const result = await this.viewingUseCase.uploadEvidence(
        req.params.id as string,
        tenantId,
        file,
        req.body
      );
      res.json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async fail(req: Request, res: Response) {
    try {
      const { tenantId } = (req as any).user;
      const { reason } = validateViewingFailure(req.body);
      const result = await this.viewingUseCase.failViewing(
        req.params.id as string,
        tenantId,
        reason as string
      );
      res.json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }
}
