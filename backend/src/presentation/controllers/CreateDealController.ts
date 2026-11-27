import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination, parseSearch } from '../../infrastructure/utils/RequestValidation.js';
import type { CreateDealUseCase, DealCreator } from '../../usecases/deal/CreateDealUseCase.js';
import { parseCreateDeal, parseCreateDealFromLeadForm } from '../validation/crm/createDeal.js';

function creatorOf(req: Request): DealCreator {
  const user = (req as Request & { user?: Partial<DealCreator> }).user;
  if (!user?.tenantId || !user.userId || !user.role) throw new Error('Tenant context missing');
  return { tenantId: user.tenantId, userId: user.userId, role: user.role };
}

const handle = (fn: (req: Request, res: Response, creator: DealCreator) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res, creatorOf(req));
    } catch (error) {
      respondWithError(res, error);
    }
  };

const filesOf = (req: Request) => (Array.isArray(req.files) ? req.files : []);

export class CreateDealController {
  constructor(private deals: CreateDealUseCase) {}

  leadOptions = handle(async (req, res, creator) => {
    const query = req.query as Record<string, unknown>;
    const search = parseSearch(query);
    res.json(
      await this.deals.leadOptions(creator, {
        ...parsePagination(query),
        ...(search ? { search } : {}),
      })
    );
  });

  create = handle(async (req, res, creator) => {
    res.status(201).json(await this.deals.create(creator, parseCreateDeal(req.body), filesOf(req)));
  });

  createFromLeadForm = handle(async (req, res, creator) => {
    const input = parseCreateDealFromLeadForm(req.body);
    res.status(201).json(await this.deals.createFromLeadForm(creator, input.lead, input.deal, filesOf(req)));
  });
}
