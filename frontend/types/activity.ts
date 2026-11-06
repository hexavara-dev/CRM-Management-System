import { Customer } from "./customer";
import { Deal } from "./deal";
import { Lead } from "./lead";
import { User } from "./user";

export interface Note {
  id: string;
  leadActivityId?: string;
  dealActivityId?: string;
  title?: string;
  content: string;
}

export interface Task {
  id: string;
  tenantId?: string;
  leadActivityId?: string;
  dealActivityId?: string;
  assignedUserId?: string;
  title: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  priority: "low" | "normal" | "high" | "urgent";
  createdAt?: string;
  created_at?: string;
  assignedUser?: User;
}

export interface AttachmentRecord {
  id: string;
  fileName?: string;
  name?: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  createdAt: string;
}

export interface CallLog {
  id: string;
  leadActivityId?: string;
  dealActivityId?: string;
  title?: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  callingNumber?: string;
  receivingNumber?: string;
  duration?: number;
  createdAt: string;
  notes?: string; // Mapped from description in UI
}

export interface LeadActivity {
  id: string;
  tenantId: string;
  leadId: string;
  customerId?: string;
  actorId?: string;
  activityType: "call" | "task" | "note" | "registration" | string;
  createdAt: string;
  notes?: Note[];
  tasks?: Task[];
  callLogs?: CallLog[];
  lead: Lead;
  customer?: Customer;
}

export interface DealActivity {
  id: string;
  tenantId: string;
  dealId: string;
  customerId?: string;
  actorId?: string;
  activityType: "call" | "task" | "note" | "registration" | string;
  createdAt: string;
  notes?: Note[];
  tasks?: Task[];
  callLogs?: CallLog[];
  deal: Deal;
  customer?: Customer;
}
