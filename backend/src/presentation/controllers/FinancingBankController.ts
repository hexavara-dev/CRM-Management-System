import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import type { FinancingBankInput, FinancingBankUseCase } from '../../usecases/deal/FinancingBankUseCase.js';
import { validateBank } from '../validation/dealDetail.js';

function tenantOf(req: Request) {
  const tenantId = (req as Request & { user?: { tenantId?: string } }).user?.tenantId;
  if (!tenantId) throw new Error('Tenant context missing');
  return tenantId;
}

function handle(fn: (req: Request, res: Response, tenantId: string) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res, tenantOf(req));
    } catch (error) {
      respondWithError(res, error);
    }
  };
}

export class FinancingBankController {
  constructor(private banks: FinancingBankUseCase) {}

  list = handle(async (req, res, tenantId) => {
    const activeOnly = req.query.active === 'true';
    res.json(await this.banks.list(tenantId, activeOnly));
  });

  create = handle(async (req, res, tenantId) => {
    res.status(201).json(await this.banks.create(tenantId, validateBank(req.body) as FinancingBankInput));
  });

  update = handle(async (req, res, tenantId) => {
    res.json(await this.banks.update(String(req.params.id), tenantId, validateBank(req.body, true)));
  });

  remove = handle(async (req, res, tenantId) => {
    res.json(await this.banks.remove(String(req.params.id), tenantId));
  });
}
