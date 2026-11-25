import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination } from '../../infrastructure/utils/RequestValidation.js';
import type { ProjectFacilityUseCase } from '../../usecases/product/ProjectFacilityUseCase.js';
import {
  parseProjectFacilityFilters,
  validateProjectFacilityCreate,
  validateProjectFacilityUpdate,
} from '../validation/product/projectFacility.js';

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

export class ProjectFacilityController {
  constructor(private facilities: ProjectFacilityUseCase) {}

  list = handle(async (req, res, tenantId) => {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePagination(query);
    res.json(await this.facilities.list(tenantId, { page, limit, ...parseProjectFacilityFilters(query) }));
  });

  create = handle(async (req, res, tenantId) => {
    res.status(201).json(await this.facilities.create(tenantId, validateProjectFacilityCreate(req.body)));
  });

  update = handle(async (req, res, tenantId) => {
    res.json(await this.facilities.update(id(req), tenantId, validateProjectFacilityUpdate(req.body)));
  });

  remove = handle(async (req, res, tenantId) => {
    await this.facilities.remove(id(req), tenantId);
    res.status(204).end();
  });
}
