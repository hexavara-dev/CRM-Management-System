import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import type { DealActor, DealDetailUseCase, PaymentInput } from '../../usecases/deal/DealDetailUseCase.js';
import { validateLostRequest, validateLostReview, validatePayment } from '../validation/dealDetail.js';

function actorOf(req: Request): DealActor {
  const user = (req as Request & { user?: Partial<DealActor> }).user;
  if (!user?.tenantId || !user.userId) throw new Error('Tenant context missing');
  return { tenantId: user.tenantId, userId: user.userId };
}

function handle(fn: (req: Request, res: Response, actor: DealActor) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res, actorOf(req));
    } catch (error) {
      respondWithError(res, error);
    }
  };
}

export class DealDetailController {
  constructor(private detail: DealDetailUseCase) {}

  history = handle(async (req, res, actor) => {
    res.json(await this.detail.history(String(req.params.id), actor.tenantId));
  });

  payments = handle(async (req, res, actor) => {
    res.json(await this.detail.payments(String(req.params.id), actor.tenantId));
  });

  createPayment = handle(async (req, res, actor) => {
    res.status(201).json(
      await this.detail.createPayment(String(req.params.id), actor, validatePayment(req.body) as PaymentInput)
    );
  });

  updatePayment = handle(async (req, res, actor) => {
    res.json(
      await this.detail.updatePayment(
        String(req.params.id),
        String(req.params.paymentId),
        actor,
        validatePayment(req.body, true)
      )
    );
  });

  lostRequests = handle(async (req, res, actor) => {
    res.json(await this.detail.lostRequests(String(req.params.id), actor.tenantId));
  });

  requestLost = handle(async (req, res, actor) => {
    const body = validateLostRequest(req.body);
    res.status(201).json(
      await this.detail.requestLost(String(req.params.id), actor, body.reason, body.chronology)
    );
  });

  approveLost = handle(async (req, res, actor) => {
    const body = validateLostReview(req.body);
    res.json(
      await this.detail.reviewLost(
        String(req.params.id),
        String(req.params.requestId),
        actor,
        'APPROVED',
        body.reviewNotes ?? undefined
      )
    );
  });

  rejectLost = handle(async (req, res, actor) => {
    const body = validateLostReview(req.body);
    res.json(
      await this.detail.reviewLost(
        String(req.params.id),
        String(req.params.requestId),
        actor,
        'REJECTED',
        body.reviewNotes ?? undefined
      )
    );
  });
}
