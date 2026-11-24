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
}
