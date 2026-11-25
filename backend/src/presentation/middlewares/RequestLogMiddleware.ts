import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  safeErrorText,
  sanitizeForLog,
  type RequestFailureDetails,
} from '../../infrastructure/utils/LogSanitizer.js';

function routeOf(req: Request) {
  if (typeof req.route?.path === 'string') return `${req.baseUrl}${req.route.path}`;
  return req.path || req.baseUrl || '(unmatched)';
}

function uploadMetadata(req: Request) {
  const files = [
    ...(req.file ? [req.file] : []),
    ...(Array.isArray(req.files) ? req.files : Object.values(req.files ?? {}).flat()),
  ];
  return files.length
    ? files.map((file) => ({ field: file.fieldname, type: file.mimetype, size: file.size }))
    : undefined;
}

/**
 * One structured line per request. Successful actions stay compact. Failed actions
 * additionally record a bounded, sanitized body and server-side diagnostic detail.
 */
export function requestLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  const started = performance.now();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 400 && !res.locals.requestFailure) {
      const responseError = (body as { error?: unknown } | null)?.error;
      if (typeof responseError === 'string') res.locals.responseError = responseError;
    }
    return originalJson(body);
  }) as Response['json'];

  let logged = false;
  const log = (status: number) => {
    if (logged) return;
    logged = true;
    const entry: Record<string, unknown> = {
      requestId,
      action: `${req.method} ${routeOf(req)}`,
      status,
      durationMs: Math.round(performance.now() - started),
    };

    if (status >= 400) {
      const failure = res.locals.requestFailure as RequestFailureDetails | undefined;
      const user = (
        req as Request & {
          user?: { userId?: string; tenantId?: string; role?: string };
        }
      ).user;
      entry.failure = {
        message:
          failure?.clientMessage ??
          safeErrorText(res.locals.responseError) ??
          `Request failed with HTTP ${status}`,
        errorType: failure?.errorType ?? 'HttpErrorResponse',
        errorCode: failure?.errorCode ?? `HTTP_${status}`,
        internalMessage: failure?.internalMessage,
        stack: failure?.stack,
      };
      entry.actor = user
        ? { userId: user.userId, tenantId: user.tenantId, role: user.role }
        : undefined;
      entry.request = {
        params: sanitizeForLog(req.params),
        body: sanitizeForLog(req.body),
        files: uploadMetadata(req),
      };
    }

    const serialized = JSON.stringify(entry);
    if (status >= 500) console.error('[HTTP]', serialized);
    else if (status >= 400) console.warn('[HTTP]', serialized);
    else console.info('[HTTP]', serialized);
  };

  res.once('finish', () => log(res.statusCode));
  res.once('close', () => {
    if (!res.writableEnded) log(499);
  });
  next();
}
