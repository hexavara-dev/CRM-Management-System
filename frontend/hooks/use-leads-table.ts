import { useMemo, useState } from "react";

import { useLeads } from "@/hooks/use-leads";
import { useAuth } from "@/components/auth/auth-provider";

type UseLeadsTableOptions = {
  initialPage?: number;
  initialLimit?: number;
};

export function useLeadsTable(options: UseLeadsTableOptions = {}) {
  const { initialPage = 1, initialLimit = 10 } = options;
  const { user } = useAuth();

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [rowsPerPage, setRowsPerPage] = useState(initialLimit);
  const leadsQuery = useLeads({
    page: currentPage,
    limit: rowsPerPage,
    useServerPagination: true,
    additionalParams: {
      assignedUserId: user?.role === "owner" ? undefined : user?.id,
      isDeleted: false,
    },
    getAll: true,
  });

  const { pagination, isLoading, isFetching } = leadsQuery;
  const displayedPage = pagination
    ? Math.min(currentPage, Math.max(pagination.totalPages, 1))
    : currentPage;

  const serverPagination = useMemo(() => {
    if (!pagination) return undefined;

    return {
      meta: pagination,
      page: displayedPage,
      limit: rowsPerPage,
      isLoading: isLoading || isFetching,
      onPageChange: (nextPage: number) => {
        if (nextPage < 1 || nextPage > Math.max(pagination.totalPages, 1)) return;
        setCurrentPage(nextPage);
      },
      onLimitChange: (nextLimit: number) => {
        setRowsPerPage(nextLimit);
        setCurrentPage(1);
      },
    };
  }, [
    pagination,
    displayedPage,
    rowsPerPage,
    isLoading,
    isFetching,
  ]);

  return {
    ...leadsQuery,
    serverPagination,
  };
}
