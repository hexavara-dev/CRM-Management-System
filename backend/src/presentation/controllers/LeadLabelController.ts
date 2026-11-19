import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination } from '../../infrastructure/utils/RequestValidation.js';
import type { LeadLabelUseCase } from '../../usecases/crm/LeadLabelUseCase.js';
import {
  parseLeadLabelType,
  validateLeadLabelCreate,
  validateLeadLabelUpdate,
} from '../validation/crm/leadLabel.js';

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

export class LeadLabelController {
  constructor(private labels: LeadLabelUseCase) {}

  list = handle(async (req, res, tenantId) => {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePagination(query);
    const type = parseLeadLabelType(query);
    res.json(await this.labels.list(tenantId, { page, limit, ...(type ? { type } : {}) }));
  });

  create = handle(async (req, res, tenantId) => {
    res.status(201).json(await this.labels.create(tenantId, validateLeadLabelCreate(req.body)));
  });

  update = handle(async (req, res, tenantId) => {
    res.json(await this.labels.update(id(req), tenantId, validateLeadLabelUpdate(req.body)));
  });

  remove = handle(async (req, res, tenantId) => {
    await this.labels.remove(id(req), tenantId);
    res.status(204).end();
  });
}
