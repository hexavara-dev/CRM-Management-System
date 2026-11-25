import { sanitizeForLog, safeErrorText } from '../src/infrastructure/utils/LogSanitizer.js';

describe('LogSanitizer', () => {
  it('deeply redacts secrets but preserves useful failed input context', () => {
    expect(
      sanitizeForLog({
        name: 'Customer',
        password: 'secret-value',
        nested: { accessToken: 'jwt-value', amount: 10 },
      })
    ).toEqual({
      name: 'Customer',
      password: '[REDACTED]',
      nested: { accessToken: '[REDACTED]', amount: 10 },
    });
  });

  it('redacts credentials embedded in internal error messages', () => {
    const result = safeErrorText(
      'connect mysql://admin:password@localhost:3306/crm with Bearer abc.def.ghi'
    );
    expect(result).not.toContain('admin:password');
    expect(result).not.toContain('abc.def.ghi');
    expect(result).toContain('[REDACTED]');
  });

  it('handles circular and binary data without throwing', () => {
    const body: Record<string, unknown> = { document: Buffer.from('private-file') };
    body.self = body;
    expect(sanitizeForLog(body)).toEqual({ document: '[BINARY 12 bytes]', self: '[CIRCULAR]' });
  });
});
