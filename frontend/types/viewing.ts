import { Customer } from "@/types/customer";
import { Source } from "@/types/source";
import { Status } from "@/types/status";
import { User } from "@/types/user";
import type { AttachmentRecord } from "@/types/activity";

export interface Viewing {
  id: string;
  tenantId: string;
  customerId: string;
  actorId?: string | null;
  statusId?: string | null;
  sourceId?: string | null;
  unitId?: string | null;
  slotId?: string | null;
  name?: string | null;
  email?: string | null;
  scheduledAt: string;
  durationMinutes?: number;
  notes?: string | null;
  createdAt: string;
  customer?: Customer | null;
  actor?: User | null;
  source?: Source | null;
  Status?: Status | null;
  status?: Status | null;
  location?: { id: string; name: string } | null;
  slot?: { id: string; label: string } | null;
  unit?: {
    id: string;
    code: string;
    name?: string | null;
    variant: { product: { id: string; name: string; code: string } };
  } | null;
  attachments?: AttachmentRecord[];
}
