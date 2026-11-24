export interface CreateViewingDTO {
  tenantId: string;
  slotId?: string;
  leadId?: string;
  locationId?: string;
  sourceId?: string;
  statusId?: string;
  name?: string;
  email?: string;
  scheduledAt: Date;
  durationMinutes?: number;
  actorId?: string;
  notes?: string;
}

export interface UpdateViewingDTO {
  slotId?: string;
  leadId?: string;
  locationId?: string;
  sourceId?: string;
  statusId?: string;
  name?: string;
  email?: string;
  scheduledAt?: Date;
  durationMinutes?: number;
  actorId?: string;
  notes?: string;
}
