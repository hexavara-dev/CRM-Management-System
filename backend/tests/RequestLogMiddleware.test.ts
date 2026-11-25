import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { requestLogMiddleware } from '../src/presentation/middlewares/RequestLogMiddleware.js';
import { respondWithError } from '../src/infrastructure/utils/HttpErrorMapper.js';

describe('request logging', () => {
  it('logs a failed request body while redacting credentials and query strings', () => {
    const log = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const request = {
      method: 'POST',
      baseUrl: '',
      route: { path: '/api/auth/login' },
      originalUrl: '/api/auth/login?token=private-query',
      headers: { cookie: 'accessToken=private-cookie' },
      params: {},
      body: {
        email: 'demo@example.test',
        password: 'private-password',
        profile: { apiKey: 'private-key' },
      },
    } as unknown as Request;
    const response = Object.assign(new EventEmitter(), {
      locals: {},
      statusCode: 401,
      writableEnded: true,
      setHeader: jest.fn(),
      json: jest.fn(),
    }) as unknown as Response;
    const next = jest.fn();

    requestLogMiddleware(request, response, next);
    response.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
    const entry = JSON.parse(log.mock.calls[0]?.[1] as string);
    expect(entry).toMatchObject({ action: 'POST /api/auth/login', status: 401 });
    expect(entry.request.body).toEqual({
      email: 'demo@example.test',
      password: '[REDACTED]',
      profile: { apiKey: '[REDACTED]' },
    });
    expect(JSON.stringify(entry)).not.toMatch(/private-query|private-cookie|private-password/);
    log.mockRestore();
  });

  it('returns a safe error and records diagnostic detail for the request logger', () => {
    const response = {
      locals: { requestId: 'request-123' },
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;

    respondWithError(response, new Error('private database password'));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: 'An unexpected server error occurred. Kode laporan: request-123',
      code: 'HTTP_500',
      requestId: 'request-123',
    });
    expect(response.locals.requestFailure).toMatchObject({
      clientMessage: 'An unexpected server error occurred.',
      errorType: 'Error',
      errorCode: 'HTTP_500',
      internalMessage: 'private database password',
    });
  });

  it('does not log request bodies for successful actions', () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const request = {
      method: 'POST',
      baseUrl: '',
      path: '/api/lead',
      route: { path: '/api/lead' },
      params: {},
      body: { firstName: 'Customer' },
    } as unknown as Request;
    const response = Object.assign(new EventEmitter(), {
      locals: {},
      statusCode: 201,
      writableEnded: true,
      setHeader: jest.fn(),
      json: jest.fn(),
    }) as unknown as Response;

    requestLogMiddleware(request, response, jest.fn());
    response.emit('finish');

    const entry = JSON.parse(log.mock.calls[0]?.[1] as string);
    expect(entry.request).toBeUndefined();
    expect(JSON.stringify(entry)).not.toContain('Customer');
    log.mockRestore();
  });
});
