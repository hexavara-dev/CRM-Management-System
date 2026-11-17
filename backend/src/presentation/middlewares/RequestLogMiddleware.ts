import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** One safe log line per HTTP request. Never record headers, query strings or bodies. */
export function requestLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  const started = performance.now();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  let logged = false;
  const log = (status: number) => {
    if (logged) return;
    logged = true;
    const route = typeof req.route?.path === 'string' ? `${req.baseUrl}${req.route.path}` : (req.baseUrl || '(unmatched)');
    const entry = JSON.stringify({
      requestId,
      action: `${req.method} ${route}`,
      status,
      durationMs: Math.round(performance.now() - started),
    });
    if (status >= 500) console.error('[HTTP]', entry);
    else if (status >= 400) console.warn('[HTTP]', entry);
    else console.info('[HTTP]', entry);
  };

  res.once('finish', () => log(res.statusCode));
  res.once('close', () => {
    if (!res.writableEnded) log(499);
  });
  next();
}
