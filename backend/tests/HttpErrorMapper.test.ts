import { mapHttpError } from '../src/infrastructure/utils/HttpErrorMapper.js';

describe('mapHttpError', () => {
  it.each([
    [new Error('firstName is required'), 400],
    [new Error('Invalid email or password'), 401],
    [new Error('Tenant context missing'), 401],
    [new Error('Unauthorized: Only owners can update accounts'), 403],
    [new Error('Lead not found'), 404],
    [new Error('Lead already converted'), 409],
    [{ code: 'P2002' }, 409],
    [{ code: 'P2025' }, 404],
    [{ code: 'P2003' }, 409],
    [{ name: 'MulterError', message: 'File too large' }, 400],
    [{ status: 400, message: 'Unexpected token in JSON request body' }, 400],
  ])('maps known errors to the expected HTTP status', (error, expectedStatus) => {
    expect(mapHttpError(error).status).toBe(expectedStatus);
  });

  it('does not expose unknown internal error messages', () => {
    expect(mapHttpError(new Error('secret internal implementation detail'))).toEqual({
      status: 500,
      message: 'An unexpected server error occurred.',
    });
  });

  it('explains schema mismatches without exposing raw Prisma details', () => {
    expect(
      mapHttpError({ name: 'PrismaClientValidationError', message: 'Invalid `delegate.create()`\nUnknown argument `province`' })
    ).toEqual({
      status: 500,
      message: 'Struktur database belum sesuai dengan aplikasi. Jalankan migrasi (prisma migrate deploy) lalu restart server.',
    });
  });

  it('names the missing field for null constraint violations', () => {
    expect(
      mapHttpError({ message: 'Invalid `prisma.product.create()` invocation\nNull constraint violation on the fields: (`code`)' })
    ).toEqual({ status: 400, message: 'Field "code" wajib diisi.' });
  });

  it('explains foreign key violations in plain words', () => {
    expect(
      mapHttpError({ message: 'Invalid `prisma.product.create()`\nForeign key constraint violated on the fields: (`category_id`)' })
    ).toEqual({ status: 409, message: 'Data terkait tidak ditemukan atau masih dipakai di tempat lain.' });
  });
});
