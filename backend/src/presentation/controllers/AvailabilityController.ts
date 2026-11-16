import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import type { AvailabilityUseCase } from '../../usecases/availability/AvailabilityUseCase.js';

const tenantOf = (req: Request): string => {
  const tenantId = (req as Request & { user?: { tenantId?: string } }).user?.tenantId;
  if (!tenantId) throw new Error('Tenant context missing');
  return tenantId;
};

function handle(
  action: (tenantId: string, req: Request) => Promise<unknown>,
  statusCode = 200
) {
  return async (req: Request, res: Response) => {
    try {
      const result = await action(tenantOf(req), req);
      if (result === null) {
        res.status(404).json({ error: 'Availability data not found' });
        return;
      }
      res.status(statusCode).json(result);
    } catch (error) {
      respondWithError(res, error);
    }
  };
}

export class AvailabilityController {
  constructor(private availability: AvailabilityUseCase) {}

  overview = handle((tenantId, req) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    return this.availability.overview(tenantId, projectId);
  });

  project = handle((tenantId, req) =>
    this.availability.project(tenantId, String(req.params.projectId))
  );

  cluster = handle((tenantId, req) =>
    this.availability.cluster(
      tenantId,
      String(req.params.projectId),
      String(req.params.clusterId)
    )
  );

  unit = handle((tenantId, req) =>
    this.availability.unit(
      tenantId,
      String(req.params.projectId),
      String(req.params.clusterId),
      String(req.params.unitId)
    )
  );
}
