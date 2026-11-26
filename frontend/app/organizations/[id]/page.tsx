"use client";

import { AppSidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useCustomers } from "@/hooks/use-customers";
import { useOrganizationDetail } from "@/hooks/use-organizations";
import { ArrowLeft, Building2, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: organization, isLoading } = useOrganizationDetail(params.id);
  const { customers } = useCustomers();

  const relatedContacts = customers?.data?.filter(
    (contact) => contact.organizationId === params.id,
  );

  if (isLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex items-center justify-center h-full">
            <p>Loading organization...</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!organization) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex items-center justify-center h-full">
            <p>Organization not found</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <PageHeader
          title={organization.name}
          breadcrumbs={["Organizations", organization.name]}
          actions={
            <Link href="/organizations" className="inline-flex items-center">
              <Button variant="ghost" size="icon" className="size-8" aria-label="Kembali ke Organizations">
                <ArrowLeft className="size-4 text-muted-foreground" />
              </Button>
            </Link>
          }
        />

        <div className="p-4 md:p-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Organization Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="flex items-start gap-3">
                <Building2 className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Name</p>
                  <p className="text-sm font-medium">{organization.name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Location
                  </p>
                  <p className="text-sm font-medium">
                    {organization.location || "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Related Contacts
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {relatedContacts?.length} contact(s)
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {relatedContacts && relatedContacts?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Related Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {relatedContacts?.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">
                          {contact.firstName} {contact.lastName || ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {contact.email || "No email"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          {contact.phoneNumber || "No phone"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
