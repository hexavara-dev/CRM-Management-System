"use client";

import { AppSidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useStatistics } from "@/hooks/use-statistics";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { formatMillisecondsToDays, formatRupiah } from "@/lib/helper";
import { Task } from "@/types/activity";
import { Lead } from "@/types/lead";
import { Deal } from "@/types/deal";

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "text-blue-500 bg-blue-500/10",
    green: "text-green-500 bg-green-500/10",
    orange: "text-orange-500 bg-orange-500/10",
    purple: "text-purple-500 bg-purple-500/10",
    red: "text-red-500 bg-red-500/10",
    emerald: "text-emerald-500 bg-emerald-500/10",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div
          className={`p-2 rounded-lg ${color ? colorClasses[color] : "bg-muted"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function SimpleBarChart({
  data,
}: {
  data: { month: string; count: number; value: number }[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        No sales data yet
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end justify-between gap-2 h-40">
      {data.map((item, index) => (
        <div
          key={index}
          className="flex h-full flex-1 flex-col items-center gap-2"
        >
          <div className="flex min-h-0 w-full flex-1 items-end">
            <div
              className="w-full bg-primary rounded-t-md transition-all hover:bg-primary/80"
              style={{ height: `${(item.value / maxValue) * 100}%` }}
              title={formatRupiah(item.value)}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {item.month.split("-")[1]}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { statistics, isLoading } = useStatistics();

  if (isLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <h1 className="text-lg font-semibold">Dashboard</h1>
          </header>
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="text-muted-foreground">Loading statistics...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  const stats = statistics || {
    totalLeads: 0,
    ongoingDeals: 0,
    wonDeals: 0,
    lostDeals: 0,
    avgTimeLeadClose: 0,
    avgTimeDealClose: 0,
    avgDealValue: 0,
    avgWonValue: 0,
    salesTrend: [],
    recentLeads: [],
    recentDeals: [],
    pendingTasks: [],
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">Dashboard</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Leads"
              value={stats.totalLeads}
              icon={Target}
              color="blue"
            />
            <StatCard
              title="Ongoing Deals"
              value={stats.ongoingDeals}
              icon={TrendingUp}
              color="orange"
            />
            <StatCard
              title="Won Deals"
              value={stats.wonDeals}
              icon={CheckCircle2}
              color="green"
            />
            <StatCard
              title="Lost Deals"
              value={stats.lostDeals}
              icon={XCircle}
              color="red"
            />
          </div>

          {/* Second Row Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Avg. Time to Close Lead"
              value={`${formatMillisecondsToDays(stats.avgTimeLeadClose)} days`}
              icon={Clock}
              color="purple"
            />
            <StatCard
              title="Avg. Time to Close Deal"
              value={`${formatMillisecondsToDays(stats.avgTimeDealClose)} days`}
              icon={Calendar}
              color="emerald"
            />
            <StatCard
              title="Avg. Deal Value"
              value={formatRupiah(stats.avgDealValue)}
              icon={DollarSign}
              color="blue"
            />
            <StatCard
              title="Avg. Won Deal Value"
              value={formatRupiah(stats.avgWonValue)}
              icon={Users}
              color="green"
            />
          </div>

          {/* Sales Trend Chart */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Sales Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleBarChart data={stats.salesTrend} />
              </CardContent>
            </Card>

            {/* Recent Leads */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Recent Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentLeads.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No leads yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.recentLeads.map((lead: Lead) => (
                      <Link
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        className="flex items-center justify-between hover:bg-muted/50 p-2 -mx-2 rounded transition-colors"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {lead.customer?.firstName} {lead.customer?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lead.customer?.organization?.name || "No company"}
                          </p>
                        </div>
                        {lead.status && (
                          <span className="text-xs px-2 py-1 rounded-full bg-muted">
                            {lead.status.name}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Deals */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Recent Deals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentDeals.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No deals yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.recentDeals.map((deal: Deal) => (
                      <Link
                        key={deal.id}
                        href={`/deals/${deal.id}`}
                        className="flex items-center justify-between hover:bg-muted/50 p-2 -mx-2 rounded transition-colors"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {deal.dealType}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {deal.lead?.customer?.firstName ||
                              deal.lead?.customer?.organization?.name ||
                              "No lead"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {formatRupiah(Number(deal.expectedAmount))}
                          </p>
                          {deal.status && (
                            <span className="text-xs px-2 py-1 rounded-full bg-muted">
                              {deal.status.name}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Tasks */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Pending Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.pendingTasks.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No pending tasks
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.pendingTasks.map((task: Task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {task.title}
                          </p>
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground">
                              Due:{" "}
                              {new Date(task.dueDate).toLocaleDateString(
                                "id-ID",
                              )}
                            </p>
                          )}
                        </div>
                        {task.assignedUser && (
                          <span className="text-xs text-muted-foreground">
                            {task.assignedUser.name || task.assignedUser.email}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
