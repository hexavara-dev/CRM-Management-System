import type { Request, Response } from 'express';
import { parsePagination, parseSearch } from '../../infrastructure/utils/RequestValidation.js';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import type { ReservationUseCase } from '../../usecases/reservation/ReservationUseCase.js';
import type { CreateReservationDTO } from '../dtos/ReservationDTO.js';
import {
  parseReservationPeriod,
  parseReservationStatus,
  parseReservationTextFilter,
  validateReservationCreate,
  validateReservationStatus,
} from '../validation/ReservationRequestValidation.js';

type AuthenticatedRequest = Request & {
  user?: { userId?: string; tenantId?: string };
};

const authContext = (req: AuthenticatedRequest) => {
  const userId = req.user?.userId;
  const tenantId = req.user?.tenantId;
  if (!userId || !tenantId) throw new Error('Tenant context missing');
  return { userId, tenantId };
};

export class ReservationController {
  constructor(private reservations: ReservationUseCase) {}

  list = async (req: Request, res: Response) => {
    try {
      const { tenantId } = authContext(req as AuthenticatedRequest);
      const query = req.query as Record<string, unknown>;
      const { page, limit } = parsePagination(query, 10);
      const data = await this.reservations.list(tenantId, {
        page,
        limit,
        search: parseSearch(query),
        project: parseReservationTextFilter(query.project, 'project'),
        cluster: parseReservationTextFilter(query.cluster, 'cluster'),
        block: parseReservationTextFilter(query.block, 'block'),
        status: parseReservationStatus(query.status),
        period: parseReservationPeriod(query.period),
      });
      res.json(data);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  get = async (req: Request, res: Response) => {
    try {
      const { tenantId } = authContext(req as AuthenticatedRequest);
      res.json(await this.reservations.get(String(req.params.id), tenantId));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { tenantId, userId } = authContext(req as AuthenticatedRequest);
      const payload = validateReservationCreate(req.body) as unknown as CreateReservationDTO;
      res.status(201).json(await this.reservations.create(payload, tenantId, userId));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  updateStatus = async (req: Request, res: Response) => {
    try {
      const { tenantId } = authContext(req as AuthenticatedRequest);
      const payload = validateReservationStatus(req.body) as { status: string };
      const status = parseReservationStatus(payload.status);
      if (!status) throw new Error('status is required');
      res.json(await this.reservations.updateStatus(String(req.params.id), tenantId, status));
    } catch (error) {
      respondWithError(res, error);
    }
  };
}
