import type { ReservationStatus } from '@prisma/client';

export interface CreateReservationDTO {
  unitId: string;
  salesId?: string;
  refCode?: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  reservedAt?: Date;
  expiresAt?: Date | null;
  price: number;
  status?: Extract<ReservationStatus, 'ACTIVE' | 'PAYMENT_PENDING'>;
  notes?: string | null;
}

export interface ReservationListFilters {
  page: number;
  limit: number;
  search?: string | undefined;
  project?: string | undefined;
  cluster?: string | undefined;
  block?: string | undefined;
  status?: ReservationStatus | undefined;
  period?: 'today' | 'week' | 'month' | undefined;
}
