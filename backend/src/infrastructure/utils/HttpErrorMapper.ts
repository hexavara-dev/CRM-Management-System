import type { Response } from 'express';
import { safeErrorText, type RequestFailureDetails } from './LogSanitizer.js';

export type MappedHttpError = {
  status: 400 | 401 | 403 | 404 | 409 | 500 | 503;
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
  /tidak boleh lebih rendah/i,
];

const SCHEMA_MISMATCH =
  'Struktur database belum sesuai dengan aplikasi. Jalankan migrasi (prisma migrate deploy) lalu restart server.';

/** Nama kolom dari pesan Prisma, mis. "fields: (`company_id`)". */
function prismaFieldOf(message: string): string | null {
  const match =
    message.match(/fields?:?\s*\(`([^`]+)`/i) ?? message.match(/Unknown argument `([^`]+)`/i);
  return match?.[1] ?? null;
}

const GENERIC_UNIQUE = 'A record with the same unique value already exists.';

/**
 * Pesan P2002 yang menyebut data mana yang bentrok. Hanya memakai nama model dari meta Prisma,
 * tidak pernah nilai duplikat atau pesan MySQL mentah (berisi ID tenant).
 */
function uniqueViolationMessage(meta: { modelName?: unknown } | undefined): string {
  switch (meta?.modelName) {
    case 'ProductUnit':
      return 'Kode unit sudah dipakai di lokasi yang sama. Gunakan kode unit yang berbeda di blok atau lantai tersebut.';
    case 'ProductCategory':
    case 'Product':
      return 'Kode proyek sudah dipakai (atau kode lokasi cluster/blok yang dibuat dari kode proyek), termasuk oleh proyek yang sudah dihapus. Gunakan kode proyek yang berbeda.';
    default:
      return GENERIC_UNIQUE;
  }
}

function mapPrismaError(
  code: string | undefined,
  name: string | undefined,
  message: string
): MappedHttpError {
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
  if (
    name === 'PrismaClientValidationError' ||
    /Unknown argument|Argument `\w+` is missing|Invalid value for argument/i.test(message)
  ) {
    return { status: 500, message: SCHEMA_MISMATCH };
  }
  if (/Null constraint violation/i.test(message)) {
    return { status: 400, message: `Field${where} wajib diisi.` };
  }
  if (/Foreign key constraint violated/i.test(message)) {
    return {
      status: 409,
      message: 'Data terkait tidak ditemukan atau masih dipakai di tempat lain.',
    };
  }
  return { status: 500, message: 'A database operation failed.' };
}

export function mapHttpError(error: unknown): MappedHttpError {
  const candidate = error as {
    code?: string;
    message?: string;
    name?: string;
    status?: number;
    meta?: { target?: unknown; modelName?: unknown };
  };
  const message = typeof candidate?.message === 'string' ? candidate.message : '';

  if (candidate?.name === 'MulterError') {
    return { status: 400, message: message || 'File upload validation failed.' };
  }
  if (candidate?.status === 400 && /json|request body/i.test(message)) {
    return { status: 400, message: 'Malformed JSON request body.' };
  }

  switch (candidate?.code) {
    case 'P1000':
      return {
        status: 500,
        message: 'Koneksi database gagal karena konfigurasi server. Hubungi administrator.',
      };
    case 'P1001':
      return {
        status: 503,
        message: 'Database tidak dapat diakses. Pastikan layanan MySQL aktif, lalu coba lagi.',
      };
    case 'P2002':
      return { status: 409, message: uniqueViolationMessage(candidate.meta) };
    case 'P2025':
      return { status: 404, message: 'The requested record was not found.' };
    case 'P2003':
    case 'P2014':
      return { status: 409, message: 'The operation conflicts with related data.' };
  }

  if (/ECONNREFUSED|ETIMEDOUT|pool timeout|Can't connect to MySQL server/i.test(message)) {
    return {
      status: 503,
      message: 'Database tidak dapat diakses. Pastikan layanan MySQL aktif, lalu coba lagi.',
    };
  }

  const isPrismaError =
    candidate?.name?.includes('Prisma') ||
    message.includes('Invalid `') ||
    message.includes('invocation in') ||
    message.includes('this.delegate');
  if (isPrismaError) {
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
  if (/cannot be reviewed by its requester/i.test(message)) {
    return { status: 403, message };
  }
  if (/not supported for this resource|cannot (update|delete|manually set)/i.test(message)) {
    return { status: 403, message };
  }
  if (/not found|could not be found/i.test(message)) {
    return { status: 404, message };
  }
  if (/already (exists|registered|converted)|conflict|unit is not available/i.test(message)) {
    return { status: 409, message };
  }
  if (/^no .+ (defined|configured)/i.test(message)) {
    return { status: 409, message };
  }
  if (validationPatterns.some((pattern) => pattern.test(message))) {
    return { status: 400, message };
  }

  return { status: 500, message: 'An unexpected server error occurred.' };
}

export function respondWithError(res: Response, error: unknown) {
  const mapped = mapHttpError(error);
  const requestId = typeof res.locals?.requestId === 'string' ? res.locals.requestId : undefined;
  const candidate = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
    stack?: unknown;
  } | null;
  const errorType =
    typeof candidate?.name === 'string' && /^[\w-]{1,60}$/.test(candidate.name)
      ? candidate.name
      : 'UnknownError';
  const errorCode =
    typeof candidate?.code === 'string' && /^[\w-]{1,30}$/.test(candidate.code)
      ? candidate.code
      : `HTTP_${mapped.status}`;
  const internalMessage = safeErrorText(candidate?.message);
  const stack = safeErrorText(candidate?.stack);
  const failure: RequestFailureDetails = {
    clientMessage: mapped.message,
    errorType,
    errorCode,
    ...(internalMessage ? { internalMessage } : {}),
    ...(stack ? { stack } : {}),
  };
  res.locals.requestFailure = failure;
  const message =
    requestId && mapped.status >= 500
      ? `${mapped.message} Kode laporan: ${requestId}`
      : mapped.message;
  return res.status(mapped.status).json({
    error: message,
    code: errorCode,
    ...(requestId ? { requestId } : {}),
  });
}
