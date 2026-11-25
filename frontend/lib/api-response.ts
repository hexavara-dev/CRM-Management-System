export function normalizeCollection<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  const data = readData(payload);
  if (Array.isArray(data)) return data as T[];

  const nestedData = readData(data);
  if (Array.isArray(nestedData)) return nestedData as T[];

  const paginatedData = readRecord(data)?.data_per_page;
  return Array.isArray(paginatedData) ? (paginatedData as T[]) : [];
}

function readData(value: unknown): unknown {
  return readRecord(value)?.data;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
