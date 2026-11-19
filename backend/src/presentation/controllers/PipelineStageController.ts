import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import type { PipelineStageUseCase } from '../../usecases/crm/PipelineStageUseCase.js';
import {
  parsePipelineEntity,
  validatePipelineReorder,
  validatePipelineStageCreate,
  validatePipelineStageUpdate,
} from '../validation/crm/pipelineStage.js';

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

export class PipelineStageController {
  constructor(private stages: PipelineStageUseCase) {}

  list = handle(async (req, res, tenantId) => {
    res.json(await this.stages.list(tenantId, parsePipelineEntity(req.query.entity)));
  });

  create = handle(async (req, res, tenantId) => {
    const { entity, ...input } = validatePipelineStageCreate(req.body);
    res.status(201).json(await this.stages.create(tenantId, entity, input));
  });

  update = handle(async (req, res, tenantId) => {
    res.json(await this.stages.update(id(req), tenantId, validatePipelineStageUpdate(req.body)));
  });

  reorder = handle(async (req, res, tenantId) => {
    const { entity, ids } = validatePipelineReorder(req.body);
    res.json(await this.stages.reorder(tenantId, entity, ids));
  });

  remove = handle(async (req, res, tenantId) => {
    await this.stages.remove(id(req), tenantId);
    res.status(204).end();
  });
}
