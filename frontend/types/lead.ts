import { AttachmentRecord, LeadActivity } from "@/types/activity";
import { Status } from "@/types/status";
import { Stage } from "@/types/stage";
import { Customer } from "@/types/customer";
import { User } from "@/types/user";
import { Location } from "@/types/location";
import { Source } from "@/types/source";
import { Viewing } from "./viewing";

export interface Lead {
  id: string;
  tenantId: string;
  customerId: string;
  customer: Customer;
  stageId?: string;
  statusId?: string;
  status?: Status;
  stage?: Stage;
  source?: Source;
  type?: string;
  converted: boolean;
  convertedDate?: string;
  createdAt: string;
  activities?: LeadActivity[];
  attachments?: AttachmentRecord[];
  locationId?: string;
  location?: Location;
  assignedUser?: User;
  viewing: Viewing;
}
