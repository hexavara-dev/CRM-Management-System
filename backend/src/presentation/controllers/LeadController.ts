import type { Request, Response } from 'express';
import { LeadUseCases } from '../../usecases/lead/LeadUseCases.js';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { extractFilters } from '../../infrastructure/utils/QueryHelper.js';
import { parsePagination, parseSearch } from '../../infrastructure/utils/RequestValidation.js';
import {
  validateLeadConversion,
  validateLeadCreate,
  validateLeadStageChange,
  validateLeadUpdate,
  validateRequiredName,
} from '../validation/CrmRequestValidation.js';

export class LeadController {
  constructor(private leadUseCases: LeadUseCases) {}

  async create(req: Request, res: Response) {
    try {
      const { userId: currentUserId, tenantId } = (req as any).user || {};
      if (!tenantId) return res.status(401).json({ error: 'Tenant context missing' });
      const body = validateLeadCreate(req.body);
      const result = await this.leadUseCases.createLead(
        { ...body, tenantId, sourceUserId: currentUserId } as any,
        currentUserId
      );
      return res.status(201).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { tenantId, role, userId } = (req as any).user || {};
      const result = await this.leadUseCases.getLead(req.params.id as string, tenantId, role, userId);
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const role = (req as any).user?.role;
      const currentUserId = (req as any).user?.userId;
      const tenantId = (req as any).user?.tenantId;
      const body = validateLeadUpdate(req.body);
      const result = await this.leadUseCases.updateLead(
        req.params.id as string,
        body as any,
        role,
        currentUserId,
        tenantId
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { tenantId, role, userId } = (req as any).user || {};
      const result = await this.leadUseCases.deleteLead(req.params.id as string, tenantId, role, userId);
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const { tenantId, role, userId } = (req as any).user || {};
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context missing' });
      }

      const { page, limit } = parsePagination(req.query as Record<string, unknown>);
      const search = parseSearch(req.query as Record<string, unknown>);
      const filters = extractFilters(req.query);

      const result = await this.leadUseCases.getAllLeads(
        tenantId,
        page,
        limit,
        filters,
        search,
        role,
        userId
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async convert(req: Request, res: Response) {
    try {
      const { tenantId, role, userId } = (req as any).user || {};
      const body = validateLeadConversion(req.body);
      const result = await this.leadUseCases.convertLeadToDeal(
        req.params.id as string,
        body,
        tenantId,
        role,
        userId
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async setStatus(req: Request, res: Response) {
    try {
      const { tenantId, role, userId } = (req as any).user || {};
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context missing' });
      }
      const body = validateRequiredName(req.body, 'statusName');
      const result = await this.leadUseCases.setStatus(
        req.params.id as string,
        body.statusName as string,
        tenantId,
        role,
        userId
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async setStage(req: Request, res: Response) {
    try {
      const { tenantId, role, userId } = (req as any).user || {};
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context missing' });
      }
      const body = validateLeadStageChange(req.body);
      const evidenceAttachmentIds = body.evidenceAttachmentIds ?? [];
      if (
        !evidenceAttachmentIds.every(
          (id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)
        )
      ) {
        throw new Error('evidenceAttachmentIds must contain valid IDs');
      }
      const result = await this.leadUseCases.setStage(
        req.params.id as string,
        body.stageName,
        tenantId,
        evidenceAttachmentIds,
        role,
        userId
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }
}
