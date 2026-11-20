import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import type { LeadCampaignUseCase } from '../../usecases/crm/LeadCampaignUseCase.js';
import {
  parseLeadCampaignFilters,
  validateLeadCampaignCreate,
  validateLeadCampaignUpdate,
} from '../validation/crm/leadCampaign.js';

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

export class LeadCampaignController {
  constructor(private campaigns: LeadCampaignUseCase) {}

  list = handle(async (req, res, tenantId) => {
    res.json(await this.campaigns.list(tenantId, parseLeadCampaignFilters(req.query as Record<string, unknown>)));
  });

  create = handle(async (req, res, tenantId) => {
    res.status(201).json(await this.campaigns.create(tenantId, validateLeadCampaignCreate(req.body)));
  });

  update = handle(async (req, res, tenantId) => {
    res.json(await this.campaigns.update(id(req), tenantId, validateLeadCampaignUpdate(req.body)));
  });

  remove = handle(async (req, res, tenantId) => {
    await this.campaigns.remove(id(req), tenantId);
    res.status(204).end();
  });
}
