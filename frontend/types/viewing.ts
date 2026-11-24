import { Lead } from "@/types/lead";
import { Source } from "@/types/source";
import { Status } from "@/types/status";
import { User } from "@/types/user";
import type { AttachmentRecord } from "@/types/activity";

export interface Viewing {
  id: string;
  tenantId: string;
  leadId?: string | null;
  actorId?: string | null;
  statusId?: string | null;
  sourceId?: string | null;
  slotId?: string | null;
  name?: string | null;
  email?: string | null;
  scheduledAt: string;
  durationMinutes?: number;
  notes?: string | null;
  createdAt: string;
  lead?: Lead | null;
  actor?: User | null;
  source?: Source | null;
  Status?: Status | null;
  status?: Status | null;
  location?: { id: string; name: string } | null;
  slot?: { id: string; label: string } | null;
  attachments?: AttachmentRecord[];
}
