export type ReservationStatus =
  | "Aktif"
  | "Menunggu Pembayaran"
  | "Kedaluwarsa"
  | "Dibatalkan"
  | "Selesai";
export type ReservationStatusCode =
  | "ACTIVE"
  | "PAYMENT_PENDING"
  | "EXPIRED"
  | "CANCELLED"
  | "COMPLETED";

export type ReservationFilterStatus =
  | "Aktif"
  | "Menunggu Pembayaran"
  | "Kedaluwarsa";

export type ReservationPeriod = "Hari ini" | "Minggu ini" | "Bulan ini";

export type Reservation = {
  id: string;
  unit: string;
  project: string;
  cluster: string;
  block: string;
  customer: string;
  reservationDate: string;
  price: number;
  sales: {
    name: string;
    initials: string;
    color: string;
  };
  status: ReservationStatus;
  statusCode: ReservationStatusCode;
  period: ReservationPeriod;
  refCode: string;
  unitId: string;
  projectId: string;
  clusterId: string | null;
  blockId: string;
  customerEmail: string | null;
  customerPhone: string | null;
  expiresAt: string | null;
  notes: string | null;
};

export type ReservationFiltersState = {
  search: string;
  project: string;
  cluster: string;
  block: string;
  status: ReservationFilterStatus | "all";
  period: ReservationPeriod | "all";
};

export type ReservationFilterOptions = {
  projects: string[];
  clusters: string[];
  blocks: string[];
};

export type ReservationSummaryData = {
  total: number;
  active: number;
  paymentPending: number;
  expired: number;
};

export type ReservationListResponse = {
  data: Reservation[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  summary: ReservationSummaryData;
  filters: ReservationFilterOptions;
};
