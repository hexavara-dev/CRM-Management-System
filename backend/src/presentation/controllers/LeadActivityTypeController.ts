import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination } from '../../infrastructure/utils/RequestValidation.js';
import type { LeadActivityTypeUseCase } from '../../usecases/crm/LeadActivityTypeUseCase.js';
import {
  parseLeadActivityTypeFilters,
  validateLeadActivityTypeCreate,
  validateLeadActivityTypeUpdate,
} from '../validation/crm/leadActivityType.js';

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

export class LeadActivityTypeController {
  constructor(private types: LeadActivityTypeUseCase) {}

  list = handle(async (req, res, tenantId) => {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePagination(query);
    res.json(await this.types.list(tenantId, { page, limit, ...parseLeadActivityTypeFilters(query) }));
  });

  create = handle(async (req, res, tenantId) => {
    res.status(201).json(await this.types.create(tenantId, validateLeadActivityTypeCreate(req.body)));
  });

  update = handle(async (req, res, tenantId) => {
    res.json(await this.types.update(id(req), tenantId, validateLeadActivityTypeUpdate(req.body)));
  });

  remove = handle(async (req, res, tenantId) => {
    await this.types.remove(id(req), tenantId);
    res.status(204).end();
  });
}
