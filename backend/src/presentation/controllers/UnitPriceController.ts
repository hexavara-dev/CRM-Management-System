import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination, parseSearch } from '../../infrastructure/utils/RequestValidation.js';
import type { Actor, UnitPriceUseCase } from '../../usecases/pricing/UnitPriceUseCase.js';
import { parseUnitPriceFilters } from '../validation/product/unitPrice.js';

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

const param = (req: Request, name: string) => String(req.params[name]);
const query = (req: Request) => req.query as Record<string, unknown>;

export class UnitPriceController {
  constructor(private prices: UnitPriceUseCase) {}

  list = handle(async (req, res, { tenantId }) => {
    const q = query(req);
    const { page, limit } = parsePagination(q);
    res.json(
      await this.prices.list(tenantId, { page, limit, search: parseSearch(q), ...parseUnitPriceFilters(q) })
    );
  });

  detail = handle(async (req, res, { tenantId }) => {
    const { date } = parseUnitPriceFilters(query(req));
    res.json(await this.prices.detail(param(req, 'unitId'), tenantId, date));
  });
}
