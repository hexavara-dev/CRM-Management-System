import { AttachmentRecord, LeadActivity } from "@/types/activity";
import { Customer } from "@/types/customer";
import { Location } from "@/types/location";
import { Source } from "@/types/source";
import { Stage } from "@/types/stage";
import { Status } from "@/types/status";
import { User } from "@/types/user";
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
  productVariant?: {
    id: string;
    name: string;
    media?: { id: string; fileUrl: string; title?: string | null }[];
  };
  campaignId?: string;
  campaign?: { id: string; name: string };
  budget?: string | number;
  priority: "LOW" | "MEDIUM" | "HIGH";
  archiveCategory?: "NOT_RESPOND" | "INVALID" | "NOT_QUALIFIED" | null;
  archiveReason?: string | null;
  archivedAt?: string | null;
  archivedBy?: User | null;
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
  needsNotes?: string | null;
  /** Isian custom field dari form Add Lead berbasis template. */
  customValues?: Record<string, unknown> | null;
  /** Versi template saat Lead dibuat; sumber label custom field. */
  formTemplateVersion?: {
    fields: { key?: string; label: string; type: string; standard?: boolean }[];
  } | null;
}

export type ArchivedLead = Pick<
  Lead,
  | "id"
  | "archiveCategory"
  | "archiveReason"
  | "archivedAt"
  | "project"
  | "source"
  | "stage"
  | "assignedUser"
  | "archivedBy"
> & {
  name: string;
  hasDeals: boolean;
  customer: Pick<Customer, "firstName" | "lastName" | "phoneNumber">;
};
