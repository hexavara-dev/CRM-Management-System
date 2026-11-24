import { AttachmentRecord, LeadActivity } from "./activity";
import { Lead } from "./lead";
import { User } from "./user";

export type DealPaymentMethod = "CASH" | "KPR" | "KPR_SHARIA";
export interface Deal {
  id: string; tenantId: string; leadId?: string | null; lead?: Lead; assignedUserId?: string | null; assignedUser?: User | null;
  stageId?: string | null; statusId?: string | null; refCode?: string | null; dealType?: string | null; expectedAmount?: number | null; amount?: number | null; currency: string;
  expectedClosingDate?: string | null; closingDate?: string | null; lostReason?: string | null; lostNotes?: string | null; createdAt: string; confirmedAt?: string | null;
  paymentMethod: DealPaymentMethod; bankName?: string | null; unitId?: string | null;
  unit?: { id: string; code: string; name?: string | null; variant: { product: { id: string; name: string; code: string } } } | null;
  lastActivityAt?: string; activities?: LeadActivity[]; attachments?: AttachmentRecord[];
  stage?: { id: string; name: string; color?: string | null; position?: number } | null;
  status?: { id: string; name: string; color?: string; isClosingStatus?: boolean; isFailedStatus?: boolean } | null;
}
export type DealSummary = { totalDeals: number; openDeals: number; estimatedValue: number; wonDeals: number; wonValue: number; lostDeals: number; lostValue: number };
