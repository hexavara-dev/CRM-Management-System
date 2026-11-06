import type { PrismaClient } from '@prisma/client';

export interface StatisticsResult {
  totalLeads: number;
  ongoingDeals: number;
  wonDeals: number;
  lostDeals: number;
  avgTimeLeadCloseDays: number;
  avgTimeDealCloseDays: number;
  avgDealValue: number;
  avgWonValue: number;
  salesTrend: Array<{ month: string; count?: number; value?: number }>;
  recentLeads: any[]; // Returning raw Prisma objects
  recentDeals: any[];
  pendingTasks: any[];
}

export class StatisticsUseCases {
  constructor(private prisma: PrismaClient) {}

  async getStatistics(
    tenantId: string,
    dateRange?: { start?: Date; end?: Date }
  ): Promise<StatisticsResult> {
    // Create generic date filter for createdAt based records
    const dateFilter =
      dateRange?.start || dateRange?.end
        ? {
            createdAt: {
              ...(dateRange.start ? { gte: dateRange.start } : {}),
              ...(dateRange.end ? { lte: dateRange.end } : {}),
            },
          }
        : {};

    // 1. Total Leads
    const totalLeads = await this.prisma.lead.count({
      where: { tenantId, isDeleted: false, ...dateFilter },
    });

    // 2. Ongoing Deals
    const ongoingDeals = await this.prisma.deal.count({
      where: {
        tenantId,
        ...dateFilter,
        stage: {
          isTerminalStage: false,
        },
      },
    });

    // 3. Won Deals
    const wonDeals = await this.prisma.deal.count({
      where: {
        tenantId,
        ...dateFilter,
        status: { isClosingStatus: true },
      },
    });

    // 4. Lost Deals
    const lostDeals = await this.prisma.deal.count({
      where: {
        tenantId,
        ...dateFilter,
        status: { isFailedStatus: true },
      },
    });

    // 5. Average Time to Close Leads (Time from creation to conversion)
    const convertedLeads = await this.prisma.lead.findMany({
      where: {
        tenantId,
        isDeleted: false,
        converted: true,
        convertedDate: { not: null },
        ...dateFilter,
      },
      select: {
        createdAt: true,
        convertedDate: true,
      },
      take: 1000,
    });

    if (convertedLeads.length === 1000) {
      console.warn(
        '[StatisticsUseCases] convertedLeads limit 1000 reached, avgTimeLeadCloseDays may be inaccurate.'
      );
    }

    let avgTimeLeadCloseDays = 0;
    if (convertedLeads.length > 0) {
      const totalTime = convertedLeads.reduce((acc, lead) => {
        return acc + (lead.convertedDate!.getTime() - lead.createdAt.getTime());
      }, 0);
      avgTimeLeadCloseDays = Math.round(totalTime / convertedLeads.length / (1000 * 60 * 60 * 24));
    }

    // 6. Average Time to Close Deal (Time from creation to closingDate)
    const closedDeals = await this.prisma.deal.findMany({
      where: {
        tenantId,
        closingDate: { not: null },
        ...dateFilter,
      },
      select: {
        createdAt: true,
        closingDate: true,
      },
      take: 1000,
    });

    if (closedDeals.length === 1000) {
      console.warn(
        '[StatisticsUseCases] closedDeals limit 1000 reached, avgTimeDealCloseDays may be inaccurate.'
      );
    }

    let avgTimeDealCloseDays = 0;
    if (closedDeals.length > 0) {
      const totalTime = closedDeals.reduce((acc, deal) => {
        return acc + (new Date(deal.closingDate!).getTime() - deal.createdAt.getTime());
      }, 0);
      avgTimeDealCloseDays = Math.round(totalTime / closedDeals.length / (1000 * 60 * 60 * 24));
    }

    // 7. Average Deal Value
    const avgDealValueResult = await this.prisma.deal.aggregate({
      where: { tenantId, ...dateFilter },
      _avg: { amount: true },
    });

    // 8. Average Won Value
    const avgWonValueResult = await this.prisma.deal.aggregate({
      where: {
        tenantId,
        ...dateFilter,
        status: { isClosingStatus: true },
      },
      _avg: { amount: true },
    });

    const avgDealValue = Number(avgDealValueResult._avg.amount || 0);
    const avgWonValue = Number(avgWonValueResult._avg.amount || 0);

    // 9. Sales Trend by Month
    const wonDealsForTrend = await this.prisma.deal.findMany({
      where: {
        tenantId,
        status: { isClosingStatus: true },
        closingDate: { not: null },
        ...dateFilter,
      },
      select: {
        amount: true,
        closingDate: true,
      },
      take: 5000,
    });

    if (wonDealsForTrend.length === 5000) {
      console.warn(
        '[StatisticsUseCases] wonDealsForTrend limit 5000 reached, salesTrend may be inaccurate.'
      );
    }

    const salesTrendMap: Record<string, { count: number; value: number }> = {};
    wonDealsForTrend.forEach((deal) => {
      const date = new Date(deal.closingDate!);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!salesTrendMap[monthYear]) {
        salesTrendMap[monthYear] = { count: 0, value: 0 };
      }
      salesTrendMap[monthYear].count += 1;
      salesTrendMap[monthYear].value += Number(deal.amount || 0);
    });

    const salesTrend = Object.keys(salesTrendMap)
      .sort()
      .map((key) => ({
        month: key,
        ...salesTrendMap[key],
      }));

    // 10. Recent Leads
    const recentLeads = await this.prisma.lead.findMany({
      where: { tenantId, isDeleted: false, ...dateFilter },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        customer: { include: { organization: true } },
        status: true,
        stage: true,
        sourceUser: { select: { name: true, email: true } },
        assignedUser: { select: { name: true, email: true } },
      },
    });

    // 11. Recent Deals
    const recentDeals = await this.prisma.deal.findMany({
      where: { tenantId, ...dateFilter },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        lead: {
          include: {
            customer: true,
          },
        },
        status: true,
        stage: true,
        assignedUser: { select: { name: true, email: true } },
      },
    });

    // 12. Pending Tasks
    // `Task` schema does not have `createdAt` field, so we omit `dateFilter`.
    // Tasks inherently represent future or recent actions.
    const pendingTasks = await this.prisma.task.findMany({
      where: {
        OR: [{ tenantId }, { leadActivity: { tenantId } }, { dealActivity: { tenantId } }],
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: 10,
      include: {
        assignedUser: { select: { name: true, email: true } },
      },
    });

    return {
      totalLeads,
      ongoingDeals,
      wonDeals,
      lostDeals,
      avgTimeLeadCloseDays,
      avgTimeDealCloseDays,
      avgDealValue,
      avgWonValue,
      salesTrend,
      recentLeads,
      recentDeals,
      pendingTasks,
    };
  }
}
