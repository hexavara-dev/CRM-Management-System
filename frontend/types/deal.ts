import { AttachmentRecord, LeadActivity } from "./activity";
import { Lead } from "./lead";
import { User } from "./user";

export interface Deal {
  id: string;
  tenantId: string;
  leadId?: string;
  lead?: Lead;
  assignedUserId?: string;
  stageId?: string;
  statusId?: string;
  refCode?: string;
  dealType?: string;
  expectedAmount?: number;
  amount?: number;
  currency: string;
  expectedClosingDate?: string;
  closingDate?: string;
  lostReason?: string;
  lostNotes?: string;
  createdAt: string;
  confirmedAt?: string;
  activities?: LeadActivity[];
  attachments?: AttachmentRecord[];
  location?: Location;
  stage?: {
    id: string;
    name: string;
  };
  status?: {
    id: string;
    name: string;
    color?: string;
  };
  assignedUser: User;
}
