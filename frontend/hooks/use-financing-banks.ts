import api from "@/lib/api";
import type { FinancingBank } from "@/types/deal";
import { useQuery } from "@tanstack/react-query";

export function useFinancingBanks(activeOnly = true) {
  return useQuery({
    queryKey: ["financing-banks", { activeOnly }],
    queryFn: async () =>
      (
        await api.get<FinancingBank[]>("/api/financing-banks", {
          params: { active: activeOnly },
        })
      ).data,
  });
}
