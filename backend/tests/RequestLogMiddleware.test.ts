import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { requestLogMiddleware } from '../src/presentation/middlewares/RequestLogMiddleware.js';
import { respondWithError } from '../src/infrastructure/utils/HttpErrorMapper.js';

describe('request logging', () => {
  it('logs every completed action without body, query or credentials', () => {
    const log = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const request = {
      method: 'POST', baseUrl: '', route: { path: '/api/auth/login' },
      originalUrl: '/api/auth/login?token=private-query',
      headers: { cookie: 'accessToken=private-cookie' }, body: { password: 'private-password' },
    } as unknown as Request;
    const response = Object.assign(new EventEmitter(), {
      locals: {}, statusCode: 401, writableEnded: true, setHeader: jest.fn(),
    }) as unknown as Response;
    const next = jest.fn();

    requestLogMiddleware(request, response, next);
    response.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
    const entry = JSON.parse(log.mock.calls[0]?.[1] as string);
    expect(entry).toMatchObject({ action: 'POST /api/auth/login', status: 401 });
    expect(JSON.stringify(entry)).not.toMatch(/private-query|private-cookie|private-password/);
    log.mockRestore();
  });

  it('returns a safe error with the same request ID as the log', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = {
      locals: { requestId: 'request-123' },
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;

    respondWithError(response, new Error('private database password'));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: 'An unexpected server error occurred. Kode laporan: request-123',
      requestId: 'request-123',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('private database password');
    log.mockRestore();
  });
});
