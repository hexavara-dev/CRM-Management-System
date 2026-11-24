"use client";

import { AppSidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCustomerProfile } from "@/hooks/use-customers";
import {
  Building2,
  ChevronLeft,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const { data: customer, isLoading } = useCustomerProfile(params.id);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-[#F9FAFB]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-[#667085]">
            Memuat profil Customer...
          </div>
        ) : !customer ? (
          <div className="flex h-full items-center justify-center text-sm text-[#667085]">
            Customer tidak ditemukan.
          </div>
        ) : (
          <div className="min-h-full">
            <header className="border-b border-[#EAECF0] bg-white px-6 py-4">
              <div className="mb-4 flex items-center gap-2 text-xs text-[#667085]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-full"
                  onClick={() => history.back()}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span>Customers</span>
                <span>›</span>
                <span className="font-semibold text-[#344054]">
                  Detail Customer
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full bg-[#EFF8FF] text-[#1570EF]">
                  <UserRound className="size-6" />
                </span>
                <div>
                  <h1 className="text-xl font-semibold text-[#101828]">
                    {customer.firstName} {customer.lastName || ""}
                  </h1>
                  <p className="mt-1 text-sm text-[#667085]">
                    Customer sejak{" "}
                    {customer.createdAt
                      ? new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "medium",
                        }).format(new Date(customer.createdAt))
                      : "—"}
                  </p>
                </div>
              </div>
            </header>

            <Tabs defaultValue="overview" className="px-6 py-4">
              <TabsList variant="line" className="mb-4 bg-transparent">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="leads">
                  Leads ({customer.leads?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="deals">
                  Deals (
                  {customer.leads?.flatMap((lead) => lead.deals || []).length ||
                    0}
                  )
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="overview"
                className="grid gap-4 md:grid-cols-2"
              >
                <section className="rounded-xl border border-[#EAECF0] bg-white p-5">
                  <h2 className="mb-4 font-semibold text-[#101828]">
                    Informasi Kontak
                  </h2>
                  <div className="space-y-4 text-sm">
                    <p className="flex items-center gap-3">
                      <Phone className="size-4 text-[#667085]" />
                      {customer.phoneNumber || "—"}
                    </p>
                    <p className="flex items-center gap-3">
                      <Mail className="size-4 text-[#667085]" />
                      {customer.email || "—"}
                    </p>
                    <p className="flex items-start gap-3">
                      <MapPin className="mt-0.5 size-4 text-[#667085]" />
                      {customer.location || "—"}
                    </p>
                  </div>
                </section>
                <section className="rounded-xl border border-[#EAECF0] bg-white p-5">
                  <h2 className="mb-4 font-semibold text-[#101828]">
                    Organization
                  </h2>
                  {customer.organization ? (
                    <div className="text-sm">
                      <p className="flex items-center gap-3 font-medium">
                        <Building2 className="size-4 text-[#667085]" />
                        {customer.organization.name}
                      </p>
                      <p className="mt-3 text-[#667085]">
                        {customer.organization.location || "—"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-[#667085]">
                      Tidak terhubung ke Organization.
                    </p>
                  )}
                </section>
              </TabsContent>
              <TabsContent value="leads" className="space-y-3">
                {customer.leads?.length ? (
                  customer.leads.map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="flex items-center justify-between rounded-xl border border-[#EAECF0] bg-white p-4 hover:border-[#84CAFF]"
                    >
                      <div>
                        <p className="font-medium text-[#101828]">
                          Lead {lead.type || "Customer"}
                        </p>
                        <p className="mt-1 text-xs text-[#667085]">
                          {lead.source?.name || "Sumber tidak tersedia"}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#EFF8FF] px-2 py-1 text-xs text-[#175CD3]">
                        {lead.stage?.name || lead.status?.name || "—"}
                      </span>
                    </Link>
                  ))
                ) : (
                  <Empty text="Belum ada Lead untuk Customer ini." />
                )}
              </TabsContent>
              <TabsContent value="deals" className="space-y-3">
                {customer.leads?.flatMap((lead) => lead.deals || []).length ? (
                  customer.leads
                    ?.flatMap((lead) => lead.deals || [])
                    .map((deal) => (
                      <Link
                        key={deal.id}
                        href={`/deals/${deal.id}`}
                        className="flex items-center justify-between rounded-xl border border-[#EAECF0] bg-white p-4 hover:border-[#84CAFF]"
                      >
                        <div>
                          <p className="font-medium text-[#101828]">
                            {deal.refCode || "Deal"}
                          </p>
                          <p className="mt-1 text-xs text-[#667085]">
                            {new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              maximumFractionDigits: 0,
                            }).format(
                              Number(deal.amount ?? deal.expectedAmount ?? 0),
                            )}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#F2F4F7] px-2 py-1 text-xs text-[#344054]">
                          {deal.stage?.name || "—"}
                        </span>
                      </Link>
                    ))
                ) : (
                  <Empty text="Belum ada Deal untuk Customer ini." />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-white py-16 text-center text-sm text-[#667085]">
      {text}
    </div>
  );
}
