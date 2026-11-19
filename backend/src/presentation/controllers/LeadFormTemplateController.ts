import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination } from '../../infrastructure/utils/RequestValidation.js';
import type { Actor, LeadFormTemplateUseCase } from '../../usecases/crm/LeadFormTemplateUseCase.js';
import {
  parseFormTemplateFilters,
  validateFormTemplateCreate,
  validateFormTemplateUpdate,
} from '../validation/crm/leadFormTemplate.js';

type Handler = (req: Request, res: Response, actor: Actor) => Promise<unknown>;

function actorOf(req: Request): Actor {
  const user = (req as Request & { user?: { tenantId?: string; userId?: string } }).user;
  if (!user?.tenantId || !user.userId) throw new Error('Tenant context missing');
  return { tenantId: user.tenantId, userId: user.userId };
}

function handle(fn: Handler) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res, actorOf(req));
    } catch (error) {
      respondWithError(res, error);
    }
  };
}

const id = (req: Request) => String(req.params.id);

export class LeadFormTemplateController {
  constructor(private templates: LeadFormTemplateUseCase) {}

  list = handle(async (req, res, { tenantId }) => {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePagination(query);
    res.json(await this.templates.list(tenantId, { page, limit, ...parseFormTemplateFilters(query) }));
  });

  get = handle(async (req, res, { tenantId }) => {
    res.json(await this.templates.get(id(req), tenantId));
  });

  create = handle(async (req, res, actor) => {
    res.status(201).json(await this.templates.create(actor, validateFormTemplateCreate(req.body)));
  });

  update = handle(async (req, res, actor) => {
    res.json(await this.templates.update(id(req), actor, validateFormTemplateUpdate(req.body)));
  });

  duplicate = handle(async (req, res, actor) => {
    res.status(201).json(await this.templates.duplicate(id(req), actor));
  });

  remove = handle(async (req, res, { tenantId }) => {
    await this.templates.remove(id(req), tenantId);
    res.status(204).end();
  });
}
