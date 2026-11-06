import { ScrollArea } from "@/components/ui/scroll-area";
import type { Lead } from "@/types/lead";
import {
  Building,
  Calendar,
  Globe,
  Infinity as InfinityIcon,
  Mail,
  Phone,
  User,
} from "lucide-react";

interface LeadDetailsSidebarProps {
  lead: Lead;
}

export function LeadDetailsSidebar({ lead }: LeadDetailsSidebarProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="w-full lg:w-80 shrink-0 border-l bg-muted/30">
      <ScrollArea className="md:h-[calc(100vh-4rem)]">
        <div className="p-6 space-y-8">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Lead Details
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Full Name
                  </p>
                  <p className="text-sm font-medium">
                    {lead.customer.firstName} {lead.customer.lastName}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Company
                  </p>
                  <p className="text-sm font-medium">
                    {lead.customer.organization?.name || "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Email Address
                  </p>
                  <p className="text-sm font-medium">
                    {lead.customer.email || "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Phone Number
                  </p>
                  <p className="text-sm font-medium">
                    {lead.customer.phoneNumber || "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Globe className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Lead Source
                  </p>
                  <p className="text-sm font-medium">
                    {lead.source?.name || "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Created Date
                  </p>
                  <p className="text-sm font-medium">
                    {formatDate(new Date(lead.createdAt))}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <InfinityIcon className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Stage Phase
                  </p>
                  <p className="text-sm font-medium">{lead.stage?.name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
