import { AttachmentRecord, LeadActivity } from "@/types/activity";
import { Status } from "@/types/status";
import { Stage } from "@/types/stage";
import { Customer } from "@/types/customer";
import { User } from "@/types/user";
import { Location } from "@/types/location";
import { Source } from "@/types/source";
import { Viewing } from "./viewing";

export interface LeadLabelSummary {
  id: string;
  type: "TEMPERATURE" | "TAG";
  name: string;
  color: string;
  icon: string;
  isActive: boolean;
}

export interface Lead {
  id: string;
  tenantId: string;
  customerId: string;
  customer: Customer;
  stageId?: string;
  statusId?: string;
  labels: LeadLabelSummary[];
  status?: Status;
  stage?: Stage;
  source?: Source;
  projectId?: string;
  project?: { id: string; name: string; code: string };
  productVariantId?: string;
  productVariant?: { id: string; name: string };
  campaignId?: string;
  campaign?: { id: string; name: string };
  budget?: string | number;
  priority: "LOW" | "MEDIUM" | "HIGH";
  type?: string;
  converted: boolean;
  convertedDate?: string;
  createdAt: string;
  activities?: LeadActivity[];
  attachments?: AttachmentRecord[];
  locationId?: string;
  location?: Location;
  assignedUser?: User;
  viewing?: Viewing | null;
  viewings?: Viewing[];
  history?: {
    id: string;
    action: string;
    changes?: unknown;
    createdAt: string;
    actor?: User | null;
  }[];
}
