import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import type { LeadFormSubmissionUseCase } from '../../usecases/crm/LeadFormSubmissionUseCase.js';
import { validateLeadFormSubmission } from '../validation/crm/leadFormSubmission.js';

type AuthenticatedRequest = Request & { user?: { userId?: string; tenantId?: string; role?: string } };

function actorOf(req: Request) {
  const { userId, tenantId, role } = (req as AuthenticatedRequest).user ?? {};
  if (!userId || !tenantId) throw new Error('Tenant context missing');
  return { userId, tenantId, role };
}

/** Form Add Lead berbasis template default company. */
export class LeadFormSubmissionController {
  constructor(private submissions: LeadFormSubmissionUseCase) {}

  defaultForm = async (req: Request, res: Response) => {
    try {
      const actor = actorOf(req);
      res.json(await this.submissions.defaultForm(actor.tenantId, actor.userId));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  submit = async (req: Request, res: Response) => {
    try {
      res.status(201).json(await this.submissions.submit(actorOf(req), validateLeadFormSubmission(req.body)));
    } catch (error) {
      respondWithError(res, error);
    }
  };
}
