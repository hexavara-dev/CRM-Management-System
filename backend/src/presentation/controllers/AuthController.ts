import type { Request, Response } from 'express';
import { AuthUseCases } from '../../usecases/auth/AuthUseCases.js';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { validateAccountUpdate } from '../validation/CrmRequestValidation.js';

export class AuthController {
  constructor(private authUseCases: AuthUseCases) {}

  private setAuthCookie(res: Response, token: string) {
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await this.authUseCases.login(email, password);
      this.setAuthCookie(res, result.token);
      return res.status(200).json({ user: result.user });
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async register(req: Request, res: Response) {
    try {
      const { password, name, email } = req.body;
      const { tenantId, role } = (req as any).user || {};
      if (role !== 'owner' || !tenantId) throw new Error('Unauthorized: Only owners can create users');
      const result = await this.authUseCases.register(password, name, email, tenantId);
      return res.status(201).json({ user: result.user });
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async onboard(req: Request, res: Response) {
    try {
      if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
        return res
          .status(403)
          .json({ error: 'Public registration is disabled. Please contact your administrator.' });
      }
      const { tenantName, email, password, name } = req.body;
      const result = await this.authUseCases.onboard(tenantName, email, password, name);
      this.setAuthCookie(res, result.token);
      return res.status(201).json({ user: result.user, tenant: result.tenant });
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async logout(_req: Request, res: Response) {
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return res.status(204).send();
  }

  async getMe(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw new Error('Unauthenticated');
      const result = await this.authUseCases.getMe(userId);
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async updateAccount(req: Request, res: Response) {
    try {
      const { userId: targetUserId, ...data } = validateAccountUpdate(req.body);
      const { userId: requesterId, role: requesterRole, tenantId } = (req as any).user || {};
      const result = await this.authUseCases.updateAccount(
        requesterId,
        requesterRole,
        tenantId,
        targetUserId as string,
        data
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async getUsers(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) throw new Error('Tenant context missing');
      return res.status(200).json(await this.authUseCases.getUsers(tenantId));
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const { userId, role, tenantId } = (req as any).user || {};
      const result = await this.authUseCases.deleteUser(userId, role, tenantId, req.params.id as string);
      return res.status(200).json(result);
    } catch (error: any) {
      return respondWithError(res, error);
    }
  }
}
