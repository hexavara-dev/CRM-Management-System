export interface CreateLeadDTO {
  tenantId: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  age?: number;
  company?: string;
  statusId?: string;
  sourceId?: string;
  sourceUserId?: string;
  assignedUserId?: string;
  labelIds?: string[];
  notes?: string;
  type?: string;
  gender?: string;
  salutation?: string;
  organizationName?: string;
  organizationLocation?: string;
  location?: string;
  locationId?: string;
  projectId?: string;
  productVariantId?: string;
  campaignId?: string;
  budget?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  createDeal?: boolean;
}

export interface UpdateLeadDTO {
  assignedUserId?: string;
  stageId?: string;
  statusId?: string;
  labelIds?: string[];
  locationId?: string;
  statusName?: string;
  type?: string;
  converted?: boolean;
  convertedDate?: Date;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  age?: number;
  gender?: string;
  salutation?: string;
  location?: string;
  sourceId?: string;
  organizationName?: string;
  organizationLocation?: string;
  projectId?: string;
  productVariantId?: string;
  campaignId?: string;
  budget?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}
