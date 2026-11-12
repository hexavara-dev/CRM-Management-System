import type { Response } from 'express';

export type MappedHttpError = {
  status: 400 | 401 | 403 | 404 | 409 | 500;
  message: string;
};

const validationPatterns = [
  /required/i,
  /must be/i,
  /cannot be (null|empty)/i,
  /invalid/i,
  /unsupported field/i,
  /unsupported file type/i,
  /file too large/i,
  /missing/i,
  /at least one supported field/i,
  /no supported fields/i,
];

const SCHEMA_MISMATCH = 'Struktur database belum sesuai dengan aplikasi. Jalankan migrasi (prisma migrate deploy) lalu restart server.';

/** Nama kolom dari pesan Prisma, mis. "fields: (`company_id`)". */
function prismaFieldOf(message: string): string | null {
  const match = message.match(/fields?:?\s*\(`([^`]+)`/i) ?? message.match(/Unknown argument `([^`]+)`/i);
  return match?.[1] ?? null;
}

function mapPrismaError(code: string | undefined, name: string | undefined, message: string): MappedHttpError {
  const field = prismaFieldOf(message);
  const where = field ? ` "${field}"` : '';
  switch (code) {
    case 'P2011':
    case 'P2012':
      return { status: 400, message: `Field${where} wajib diisi.` };
    case 'P2000':
      return { status: 400, message: `Nilai terlalu panjang untuk field${where}.` };
    case 'P2021':
    case 'P2022':
      return { status: 500, message: SCHEMA_MISMATCH };
  }
  if (name === 'PrismaClientValidationError' || /Unknown argument|Argument `\w+` is missing|Invalid value for argument/i.test(message)) {
    return { status: 500, message: SCHEMA_MISMATCH };
  }
  if (/Null constraint violation/i.test(message)) {
    return { status: 400, message: `Field${where} wajib diisi.` };
  }
  if (/Foreign key constraint violated/i.test(message)) {
    return { status: 409, message: 'Data terkait tidak ditemukan atau masih dipakai di tempat lain.' };
  }
  return { status: 500, message: 'A database operation failed.' };
}

export function mapHttpError(error: unknown): MappedHttpError {
  const candidate = error as {
    code?: string;
    message?: string;
    name?: string;
    status?: number;
    meta?: { target?: unknown };
  };
  const message = typeof candidate?.message === 'string' ? candidate.message : '';

  if (candidate?.name === 'MulterError') {
    return { status: 400, message: message || 'File upload validation failed.' };
  }
  if (candidate?.status === 400 && /json|request body/i.test(message)) {
    return { status: 400, message: 'Malformed JSON request body.' };
  }

  switch (candidate?.code) {
    case 'P2002':
      return { status: 409, message: 'A record with the same unique value already exists.' };
    case 'P2025':
      return { status: 404, message: 'The requested record was not found.' };
    case 'P2003':
    case 'P2014':
      return { status: 409, message: 'The operation conflicts with related data.' };
  }

  const isPrismaError =
    candidate?.name?.includes('Prisma') ||
    message.includes('Invalid `') ||
    message.includes('invocation in') ||
    message.includes('this.delegate');
  if (isPrismaError) {
    // Pesan lengkap hanya ke log server; klien mendapat pesan yang bisa ditindaklanti.
    console.error('[Prisma Error]', candidate?.code || candidate?.name || 'unknown', message);
    return mapPrismaError(candidate?.code, candidate?.name, message);
  }

  if (/invalid email or password/i.test(message)) {
    return { status: 401, message: 'Invalid email or password' };
  }
  if (/tenant context missing|user context missing|unauthenticated/i.test(message)) {
    return { status: 401, message: 'Authentication is required.' };
  }
  if (/unauthorized|only owners|insufficient permissions/i.test(message)) {
    return { status: 403, message };
  }
  if (/not supported for this resource|cannot (update|delete|manually set)/i.test(message)) {
    return { status: 403, message };
  }
  if (/not found|could not be found/i.test(message)) {
    return { status: 404, message };
  }
  if (/already (exists|registered|converted)|conflict/i.test(message)) {
    return { status: 409, message };
  }
  if (/^no .+ (defined|configured)/i.test(message)) {
    return { status: 409, message };
  }
  if (validationPatterns.some((pattern) => pattern.test(message))) {
    return { status: 400, message };
  }

  console.error('[Unexpected Error]', error);
  return { status: 500, message: 'An unexpected server error occurred.' };
}

export function respondWithError(res: Response, error: unknown) {
  const mapped = mapHttpError(error);
  return res.status(mapped.status).json({ error: mapped.message });
}
