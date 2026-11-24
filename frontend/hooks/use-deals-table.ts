import { useMemo, useState } from "react";

import { useDeals } from "@/hooks/use-deals";

type UseDealsTableOptions = {
  initialPage?: number;
  initialLimit?: number;
};

export function useDealsTable(options: UseDealsTableOptions = {}) {
  const { initialPage = 1, initialLimit = 10 } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [rowsPerPage, setRowsPerPage] = useState(initialLimit);
  const dealsQuery = useDeals({
    page: currentPage,
    limit: rowsPerPage,
  });

  const { pagination, isLoading, isFetching } = dealsQuery;
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
    ...dealsQuery,
    serverPagination,
  };
}
