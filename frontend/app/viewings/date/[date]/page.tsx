"use client";

import { AppSidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import Typography from "@/components/Typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useViewings } from "@/hooks/use-viewings";
import { Calendar, Clock3 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ViewingDateDetailPage() {
  const params = useParams<{ date: string }>();
  const { viewings, isLoading } = useViewings();

  const dateParam = params.date;

  const dayViewings = useMemo(() => {
    return viewings
      .filter((item) => {
        const date = new Date(item.scheduledAt);
        if (Number.isNaN(date.getTime())) return false;
        return toDateKey(date) === dateParam;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
  }, [viewings, dateParam]);

  const formattedDate = useMemo(() => {
    const date = new Date(`${dateParam}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateParam;
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [dateParam]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <PageHeader
          title="Detail Visit"
          breadcrumbs={["Leads Management", "Visit Schedule Leads", "Detail Visit"]}
          actions={<Button asChild variant="outline"><Link href="/viewings">Kembali ke Calendar</Link></Button>}
        />

        <div className="p-4">
          <Card>
            <CardHeader>
              <CardTitle className="capitalize">{formattedDate}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Typography color="slate">Loading visits...</Typography>
              ) : dayViewings.length === 0 ? (
                <Typography color="slate">
                  Tidak ada jadwal visit di tanggal ini.
                </Typography>
              ) : (
                <div className="space-y-3">
                  {dayViewings.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">
                            {item.customer
                              ? `${item.customer.firstName} ${item.customer.lastName ?? ""}`.trim()
                              : item.name || "Customer tidak tersedia"}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(item.scheduledAt).toLocaleDateString(
                                "id-ID",
                              )}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" />
                              {formatTime(item.scheduledAt)}
                            </span>
                          </div>
                          {item.notes ? (
                            <Typography color="slate" className="text-sm">
                              {item.notes}
                            </Typography>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.status?.name ? (
                            <Badge colorHex={item.status?.color}>
                              {item.status?.name}
                            </Badge>
                          ) : null}
                          {item.source?.name ? (
                            <Badge>{item.source?.name}</Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
