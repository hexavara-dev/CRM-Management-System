import type { DealActivity, LeadActivity } from "@/types/activity";
import type { Lead } from "@/types/lead";
import { Organization } from "@/types/organization";

export interface Customer {
  id: string;
  tenantId: string;
  organizationId?: string;
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  gender?: string;
  age?: number;
  salutation?: string;
  attachedDocument?: string;
  location?: string;
  createdAt?: string;
  created_at?: string;
  organization?: Organization;
  leads?: Array<Lead & { deals?: import("@/types/deal").Deal[] }>;
  leadActivities?: LeadActivity[];
  dealActivities?: DealActivity[];
}
