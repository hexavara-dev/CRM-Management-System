import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import type { DealStageActor, DealStageTransitionUseCase } from '../../usecases/deal/DealStageTransitionUseCase.js';
import { parseDealStageTransition } from '../validation/dealStageTransition.js';

function actorOf(req: Request): DealStageActor {
  const user = (req as Request & { user?: Partial<DealStageActor> }).user;
  if (!user?.tenantId || !user.userId) throw new Error('Tenant context missing');
  return { tenantId: user.tenantId, userId: user.userId };
}

export class DealStageTransitionController {
  constructor(private transitions: DealStageTransitionUseCase) {}

  transition = async (req: Request, res: Response) => {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      const result = await this.transitions.transition(
        String(req.params.id),
        actorOf(req),
        parseDealStageTransition(req.body),
        files
      );
      res.json(result);
    } catch (error) {
      respondWithError(res, error);
    }
  };
}
