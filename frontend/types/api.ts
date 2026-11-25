export type PaginateData<Data> = {
  data_per_page: Data;
  meta: {
    page: number;
    max_page: number;
  };
};

export interface PaginatedApiResponse<DataType> {
  code: number;
  status: boolean;
  message: string;
  data: PaginateData<DataType>;
}

// ========== Match the Paginated API response structure ===========
export type PaginatedResponse<T> = {
  message: string;
  status: string | boolean;
  code: number;
  data: T;
  meta: Pagination;
};

export type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
// ========== Match the Paginated API response structure ===========

export type ApiResponse<T> = {
  message: string;
  status: boolean;
  code: number;
  data: T;
};

export type ApiError = {
  code: number;
  status: boolean | number;
  error: string;
  message: string;
};

export type UninterceptedApiError = {
  code?: number | string;
  status?: boolean;
  error?: string;
  message?: string | Record<string, string[]>;
  requestId?: string;
};
