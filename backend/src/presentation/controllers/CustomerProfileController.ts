import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import type { CustomerProfileUseCase } from '../../usecases/customer/CustomerProfileUseCase.js';

export class CustomerProfileController {
  constructor(private profiles: CustomerProfileUseCase) {}

  get = async (req: Request, res: Response) => {
    try {
      const tenantId = (req as Request & { user?: { tenantId?: string } }).user?.tenantId;
      if (!tenantId) throw new Error('Tenant context missing');
      res.json(await this.profiles.get(String(req.params.id), tenantId));
    } catch (error) {
      respondWithError(res, error);
    }
  };
}
