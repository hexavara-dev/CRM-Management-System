import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import type { LeadStageActor, LeadStageTransitionUseCase } from '../../usecases/lead/LeadStageTransitionUseCase.js';
import { parseDealStageTransition } from '../validation/dealStageTransition.js';

function actorOf(req: Request): LeadStageActor {
  const user = (req as Request & { user?: Partial<LeadStageActor> }).user;
  if (!user?.tenantId || !user.userId) throw new Error('Tenant context missing');
  return { tenantId: user.tenantId, userId: user.userId, role: user.role };
}

export class LeadStageTransitionController {
  constructor(private transitions: LeadStageTransitionUseCase) {}

  transition = async (req: Request, res: Response) => {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      res.json(await this.transitions.transition(String(req.params.id), actorOf(req), parseDealStageTransition(req.body), files));
    } catch (error) {
      respondWithError(res, error);
    }
  };
}
