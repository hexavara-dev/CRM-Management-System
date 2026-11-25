import type { QueryClient } from "@tanstack/react-query";

/** Awalan query yang isinya bergantung pada data proyek, tipe, varian, atau unit. */
const PREFIXES = ["project", "availability-", "unit-price", "reservation-available-units", "deal-units"];
/** Detail proyek yang sudah dihapus tidak dimuat ulang (akan 404). */
const DETAIL_KEYS = ["project", "project-edit"];

export function invalidateProductData(queryClient: QueryClient, { deleted = false } = {}) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey: [key] }) =>
      typeof key === "string" &&
      PREFIXES.some((prefix) => key.startsWith(prefix)) &&
      !(deleted && DETAIL_KEYS.includes(key)),
  });
}
