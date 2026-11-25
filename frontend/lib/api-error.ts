import axios from "axios";

type ApiErrorBody = {
  error?: unknown;
  message?: unknown;
  code?: unknown;
  requestId?: unknown;
};

export function apiErrorMessage(error: unknown, fallback: string): string {
  const body = axios.isAxiosError<ApiErrorBody>(error)
    ? error.response?.data
    : undefined;
  const message =
    firstString(
      body?.error,
      body?.message,
      error instanceof Error ? error.message : undefined,
    ) ?? fallback;
  const references = [
    typeof body?.code === "string" ? `kode ${body.code}` : undefined,
    typeof body?.requestId === "string"
      ? `referensi ${body.requestId}`
      : undefined,
  ].filter(Boolean);

  return references.length > 0
    ? `${message} (${references.join(", ")})`
    : message;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}
