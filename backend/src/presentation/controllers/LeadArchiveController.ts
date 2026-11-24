import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination, parseSearch } from '../../infrastructure/utils/RequestValidation.js';
import { LeadArchiveUseCase } from '../../usecases/lead/LeadArchiveUseCase.js';
import { parseArchiveListQuery, validateArchiveBulkCategoryChange, validateArchiveBulkIds, validateArchiveCategoryChange, validateArchiveLead } from '../validation/LeadArchiveValidation.js';

export class LeadArchiveController {
  constructor(private archive: LeadArchiveUseCase) {}

  private context(req: Request) {
    const { tenantId, userId, role } = (req as any).user || {};
    if (!tenantId || !userId) throw new Error('Tenant context missing');
    return { tenantId, userId, role };
  }

  list = async (req: Request, res: Response) => {
    try {
      const ctx = this.context(req); const query = req.query as Record<string, unknown>; const { page, limit } = parsePagination(query);
      const search = parseSearch(query); const filters = parseArchiveListQuery(query);
      res.json(await this.archive.list(ctx.tenantId, { page, limit, ...filters, ...(search ? { search } : {}) }, ctx.role, ctx.userId));
    } catch (error) { respondWithError(res, error); }
  };

  archiveLead = async (req: Request, res: Response) => { try { const ctx = this.context(req); res.json(await this.archive.archive(String(req.params.id), ctx.tenantId, ctx.userId, validateArchiveLead(req.body), ctx.role)); } catch (error) { respondWithError(res, error); } };
  reactivate = async (req: Request, res: Response) => { try { const ctx = this.context(req); res.json(await this.archive.reactivate(String(req.params.id), ctx.tenantId, ctx.userId, ctx.role)); } catch (error) { respondWithError(res, error); } };
  changeCategory = async (req: Request, res: Response) => { try { const ctx = this.context(req); res.json(await this.archive.changeCategory(String(req.params.id), ctx.tenantId, ctx.userId, validateArchiveCategoryChange(req.body), ctx.role)); } catch (error) { respondWithError(res, error); } };
  permanentDelete = async (req: Request, res: Response) => { try { const ctx = this.context(req); res.json(await this.archive.permanentDelete([String(req.params.id)], ctx.tenantId, ctx.role, ctx.userId)); } catch (error) { respondWithError(res, error); } };
  bulkReactivate = async (req: Request, res: Response) => { try { const ctx = this.context(req); const { ids } = validateArchiveBulkIds(req.body); res.json(await this.archive.bulkReactivate(ids, ctx.tenantId, ctx.userId, ctx.role)); } catch (error) { respondWithError(res, error); } };
  bulkChangeCategory = async (req: Request, res: Response) => { try { const ctx = this.context(req); const input = validateArchiveBulkCategoryChange(req.body); res.json(await this.archive.bulkChangeCategory(input.ids, ctx.tenantId, ctx.userId, input, ctx.role)); } catch (error) { respondWithError(res, error); } };
  bulkPermanentDelete = async (req: Request, res: Response) => { try { const ctx = this.context(req); const { ids } = validateArchiveBulkIds(req.body); res.json(await this.archive.permanentDelete(ids, ctx.tenantId, ctx.role, ctx.userId)); } catch (error) { respondWithError(res, error); } };
}
