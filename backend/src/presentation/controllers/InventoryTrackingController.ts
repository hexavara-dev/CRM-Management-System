import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import type { InventoryTrackingUseCase } from '../../usecases/settings/InventoryTrackingUseCase.js';
import { validateInventoryTracking } from '../validation/settings/inventoryTracking.js';

function tenantOf(req: Request): string {
  const tenantId = (req as Request & { user?: { tenantId?: string } }).user?.tenantId;
  if (!tenantId) throw new Error('Tenant context missing');
  return tenantId;
}

export class InventoryTrackingController {
  constructor(private tracking: InventoryTrackingUseCase) {}

  get = async (req: Request, res: Response) => {
    try {
      res.json(await this.tracking.get(tenantOf(req)));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      res.json(await this.tracking.update(tenantOf(req), validateInventoryTracking(req.body)));
    } catch (error) {
      respondWithError(res, error);
    }
  };
}
