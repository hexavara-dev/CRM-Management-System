import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination } from '../../infrastructure/utils/RequestValidation.js';
import type { LeadSourceUseCase } from '../../usecases/crm/LeadSourceUseCase.js';
import {
  parseLeadSourceFilters,
  validateLeadSourceCreate,
  validateLeadSourceUpdate,
} from '../validation/crm/leadSource.js';

type Handler = (req: Request, res: Response, tenantId: string) => Promise<unknown>;

function tenantOf(req: Request): string {
  const tenantId = (req as Request & { user?: { tenantId?: string } }).user?.tenantId;
  if (!tenantId) throw new Error('Tenant context missing');
  return tenantId;
}

function handle(fn: Handler) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res, tenantOf(req));
    } catch (error) {
      respondWithError(res, error);
    }
  };
}

const id = (req: Request) => String(req.params.id);

export class LeadSourceController {
  constructor(private sources: LeadSourceUseCase) {}

  list = handle(async (req, res, tenantId) => {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePagination(query);
    res.json(await this.sources.list(tenantId, { page, limit, ...parseLeadSourceFilters(query) }));
  });

  create = handle(async (req, res, tenantId) => {
    res.status(201).json(await this.sources.create(tenantId, validateLeadSourceCreate(req.body)));
  });

  update = handle(async (req, res, tenantId) => {
    res.json(await this.sources.update(id(req), tenantId, validateLeadSourceUpdate(req.body)));
  });

  remove = handle(async (req, res, tenantId) => {
    await this.sources.remove(id(req), tenantId);
    res.status(204).end();
  });
}
