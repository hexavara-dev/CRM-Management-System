const REDACTED = '[REDACTED]';
const TRUNCATED = '[TRUNCATED]';

const SENSITIVE_KEY =
  /(?:password|passwd|pwd|secret|token|authorization|cookie|credential|api[-_]?key|private[-_]?key|client[-_]?secret|access[-_]?token|refresh[-_]?token|jwt|otp|pin)/i;
const BINARY_KEY = /^(?:buffer|data|bytes|content)$/i;
const DATABASE_URL = /\b(?:mysql|mariadb|postgres(?:ql)?):\/\/[^\s'"`]+/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const PASSWORD_FRAGMENT = /((?:password|passwd|pwd|secret)\s*[:=]\s*)[^\s,;]+/gi;

const MAX_DEPTH = 6;
const MAX_KEYS = 100;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 2_000;

export type RequestFailureDetails = {
  clientMessage: string;
  errorType: string;
  errorCode?: string;
  internalMessage?: string;
  stack?: string;
};

function safeString(value: string) {
  const redacted = value
    .replace(DATABASE_URL, REDACTED)
    .replace(BEARER_TOKEN, `Bearer ${REDACTED}`)
    .replace(JWT, REDACTED)
    .replace(PASSWORD_FRAGMENT, `$1${REDACTED}`);
  return redacted.length > MAX_STRING_LENGTH
    ? `${redacted.slice(0, MAX_STRING_LENGTH)}${TRUNCATED}`
    : redacted;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return safeString(value);
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[BINARY ${value.byteLength} bytes]`;
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (typeof value !== 'object') return safeString(String(value));
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS)
      result.push(`[${value.length - MAX_ARRAY_ITEMS} more items]`);
    return result;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const result: Record<string, unknown> = {};
  for (const [key, item] of entries.slice(0, MAX_KEYS)) {
    if (SENSITIVE_KEY.test(key)) {
      result[key] = REDACTED;
    } else if (BINARY_KEY.test(key) && (Buffer.isBuffer(item) || ArrayBuffer.isView(item))) {
      result[key] = '[BINARY]';
    } else {
      result[key] = sanitizeValue(item, depth + 1, seen);
    }
  }
  if (entries.length > MAX_KEYS) result._truncatedKeys = entries.length - MAX_KEYS;
  return result;
}

/**
 * Produces bounded, JSON-safe log data. Secret-bearing keys and common credential
 * patterns are always redacted before the value reaches stdout or a log collector.
 */
export function sanitizeForLog(value: unknown): unknown {
  return sanitizeValue(value, 0, new WeakSet<object>());
}

export function safeErrorText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? safeString(value.trim()) : undefined;
}
