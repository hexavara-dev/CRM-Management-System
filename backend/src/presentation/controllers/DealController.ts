import type { Request, Response } from 'express';
import { DealUseCases } from '../../usecases/deal/DealUseCases.js';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination, parseSearch } from '../../infrastructure/utils/RequestValidation.js';
import { validateDealUpdate } from '../validation/CrmRequestValidation.js';

export class DealController {
  constructor(private dealUseCases: DealUseCases) {}

  async create(_req: Request, res: Response) {
    return res.status(405).json({
      error: 'Deal hanya dapat dibuat melalui aksi Buat Deal pada halaman Detail Lead.',
    });
  }

  async getById(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId;
      const result = await this.dealUseCases.getDeal(req.params.id as string, tenantId);
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const { tenantId } = (req as any).user || {};
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context missing' });
      }

      const { page, limit } = parsePagination(req.query as Record<string, unknown>);
      const search = parseSearch(req.query as Record<string, unknown>);
      const query = req.query as Record<string, unknown>;
      const one = (key: string) => {
        const value = query[key];
        if (value === undefined) return undefined;
        if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} must be a non-empty string`);
        return value.trim();
      };
      const date = (key: string) => {
        const value = one(key);
        if (!value) return undefined;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) throw new Error(`${key} must be a valid date`);
        return parsed;
      };
      const paymentMethod = one('paymentMethod');
      if (paymentMethod && !['CASH', 'KPR', 'KPR_SHARIA'].includes(paymentMethod)) {
        throw new Error('paymentMethod must be CASH, KPR, or KPR_SHARIA');
      }
      const startDate = date('startDate');
      const endDate = date('endDate');
      if (endDate) endDate.setHours(23, 59, 59, 999);
      if (startDate && endDate && startDate > endDate) throw new Error('startDate must not be after endDate');
      const filters = {
        ...(one('stageId') ? { stageId: one('stageId') } : {}),
        ...(one('assignedUserId') ? { assignedUserId: one('assignedUserId') } : {}),
        ...(one('projectId') ? { projectId: one('projectId') } : {}),
        ...(one('bankName') ? { bankName: one('bankName') } : {}),
        ...(paymentMethod ? { paymentMethod: paymentMethod as 'CASH' | 'KPR' | 'KPR_SHARIA' } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      };

      const result = await this.dealUseCases.getAllDeals(tenantId, page, limit, filters, search);
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId;
      const actorId = (req as any).user?.userId;
      const body = validateDealUpdate(req.body);
      const result = await this.dealUseCases.updateDeal(req.params.id as string, body as any, tenantId, actorId);
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId;
      const result = await this.dealUseCases.deleteDeal(req.params.id as string, tenantId);
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }
}
