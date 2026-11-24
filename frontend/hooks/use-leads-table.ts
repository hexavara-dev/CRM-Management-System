import { useEffect, useMemo, useState } from "react";

import { useLeads } from "@/hooks/use-leads";
import { useAuth } from "@/components/auth/auth-provider";

type UseLeadsTableOptions = {
  initialPage?: number;
  initialLimit?: number;
  filters?: {
    search?: string;
    stageId?: string;
    assignedUserId?: string;
    sourceId?: string;
    labelId?: string;
  };
};

export function useLeadsTable(options: UseLeadsTableOptions = {}) {
  const { initialPage = 1, initialLimit = 10, filters = {} } = options;
  const { user } = useAuth();

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [rowsPerPage, setRowsPerPage] = useState(initialLimit);
  const leadsQuery = useLeads({
    page: currentPage,
    limit: rowsPerPage,
    useServerPagination: true,
    additionalParams: {
      search: filters.search || undefined,
      stageId: filters.stageId || undefined,
      assignedUserId:
        user?.role === "owner" ? filters.assignedUserId || undefined : user?.id,
      sourceId: filters.sourceId || undefined,
      labelId: filters.labelId || undefined,
      isDeleted: false,
    },
    getAll: true,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [
    filters.search,
    filters.stageId,
    filters.assignedUserId,
    filters.sourceId,
    filters.labelId,
  ]);

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
