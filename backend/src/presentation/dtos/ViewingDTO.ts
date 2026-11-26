export interface CreateViewingDTO {
  tenantId: string;
  slotId?: string;
  customerId: string;
  locationId?: string;
  sourceId?: string;
  unitId?: string;
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
  customerId?: string;
  locationId?: string;
  sourceId?: string;
  unitId?: string;
  statusId?: string;
  name?: string;
  email?: string;
  scheduledAt?: Date;
  durationMinutes?: number;
  actorId?: string;
  notes?: string;
}
