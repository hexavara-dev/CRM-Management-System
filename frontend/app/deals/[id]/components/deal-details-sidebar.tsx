import { ScrollArea } from "@/components/ui/scroll-area";
import type { Deal } from "@/types/deal";
import { formatRupiah } from "@/lib/helper";
import {
  Building,
  Calendar,
  Mail,
  MapPin,
  Phone,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";

interface DealDetailsSidebarProps {
  deal: Deal;
}

export function DealDetailsSidebar({ deal }: DealDetailsSidebarProps) {
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
              Deal Details
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Deal Name
                  </p>
                  <p className="text-sm font-medium">{deal.refCode}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Deal Value
                  </p>
                  <p className="text-sm font-medium">
                    {formatRupiah(Number(deal.amount ?? deal.expectedAmount) || 0)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Assigned Sales
                  </p>
                  <p className="text-sm font-medium">
                    {deal.assignedUser?.name}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Closing Date
                  </p>
                  <p className="text-sm font-medium">
                    {deal.closingDate
                      ? formatDate(new Date(deal.closingDate))
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Contacts
            </h3>
            <div className="flex items-start gap-3">
              <Phone className="size-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Phone Number
                </p>
                <p className="text-sm font-medium">
                  {deal.lead?.customer.phoneNumber || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 mt-8">
              <Mail className="size-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                <p className="text-sm font-medium">
                  {deal.lead?.customer.email || "—"}
                </p>
              </div>
            </div>
          </div>

          {deal.lead?.customer.organization && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Organization
              </h3>
              <div className="rounded-lg border bg-background p-3 space-y-2.5">
                <div>
                  <Link
                    href={`/organizations/${deal.lead.customer.organization.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {deal.lead?.customer.organization?.name || "—"}
                  </Link>
                  {/* <p className="text-xs text-muted-foreground">
                    {organization.location}
                  </p> */}
                </div>
                <p className="text-xs flex items-center gap-2">
                  <MapPin className="size-3 text-muted-foreground" />
                  <span>
                    {deal.lead?.customer.organization?.location || "—"}
                  </span>
                </p>
                {/* <p className="text-xs flex items-center gap-2">
                  <Globe className="size-3 text-muted-foreground" />
                  <span className="truncate">
                    {organization. || "—"}
                  </span>
                </p> */}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
