import { AttachmentRecord, DealActivity } from "./activity";
import { Lead } from "./lead";
import { User } from "./user";

export type DealPaymentMethod = "CASH" | "KPR" | "KPR_SHARIA";
export interface Deal {
  id: string;
  tenantId: string;
  leadId?: string | null;
  lead?: Lead;
  assignedUserId?: string | null;
  stageId?: string | null;
  statusId?: string | null;
  refCode?: string | null;
  dealType?: string | null;
  expectedAmount?: number | null;
  amount?: number | null;
  currency: string;
  expectedClosingDate?: string | null;
  closingDate?: string | null;
  lostReason?: string | null;
  lostNotes?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
  confirmedAt?: string | null;
  activities?: DealActivity[];
  attachments?: AttachmentRecord[];
  stage?: {
    id: string;
    name: string;
    color?: string | null;
    position?: number;
    description?: string | null;
  } | null;
  status?: {
    id: string;
    name: string;
    color?: string;
    isClosingStatus?: boolean;
    isFailedStatus?: boolean;
  } | null;
  assignedUser?: User | null;
  paymentMethod: DealPaymentMethod;
  bankName?: string | null;
  financingBankId?: string | null;
  financingBank?: FinancingBank | null;
  unitId?: string | null;
  /** Fase yang telah dicapai sebelum evidence pipeline terbaru diberlakukan. */
  evidenceGrandfatheredStageIds?: string[] | null;
  unit?: DealUnit | null;
  lastActivityAt?: string;
  payments?: DealPayment[];
  lostRequests?: DealLostRequest[];
}

export interface FinancingBank {
  id: string;
  name: string;
  logoUrl?: string | null;
  isActive: boolean;
}

export interface DealUnit {
  id: string;
  code: string;
  name?: string | null;
  variant: {
    id?: string;
    name?: string;
    product: { id: string; name: string; code: string };
  };
  typeVariant?: { id: string; name: string };
}

export type DealPaymentType = "ITJ" | "DP" | "SETTLEMENT";
export type DealPaymentStatus = "PENDING" | "PAID" | "CANCELLED";

export interface DealPayment {
  id: string;
  type: DealPaymentType;
  amount: number;
  status: DealPaymentStatus;
  dueDate?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  recordedBy?: { id: string; name?: string | null; email: string };
}

export interface DealHistory {
  id: string;
  action: string;
  changes?: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: string; name?: string | null; email: string } | null;
}

export type DealLostRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface DealLostRequest {
  id: string;
  reason: string;
  chronology: string;
  status: DealLostRequestStatus;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  requestedBy: { id: string; name?: string | null; email: string };
  reviewedBy?: { id: string; name?: string | null; email: string } | null;
}
export type DealSummary = {
  totalDeals: number;
  openDeals: number;
  estimatedValue: number;
  wonDeals: number;
  wonValue: number;
  lostDeals: number;
  lostValue: number;
};
