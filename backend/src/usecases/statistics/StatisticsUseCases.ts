import type { PrismaClient } from '@prisma/client';

export interface StatisticsResult {
  totalProjectActive: number;
  totalTypes: number;
  totalUnits: number;
  summaryChanges: {
    projects: number | null;
    types: number | null;
    units: number | null;
    ongoingDeals: number | null;
    wonDeals: number | null;
    lostDeals: number | null;
  };
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
  leadPipeline: Array<{ id: string; name: string; color: string | null; count: number }>;
  dealPipeline: Array<{ id: string; name: string; color: string | null; count: number }>;
  upcomingVisits: any[];
  availability: {
    available: number;
    processing: number;
    reserved: number;
    sold: number;
    blocked: number;
    notYetCreated: number;
    total: number;
  };
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

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const percentageChange = (current: number, previous: number) =>
      previous === 0 ? (current === 0 ? 0 : null) : Math.round(((current - previous) / previous) * 100);

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
        stage: { isWonStage: true },
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
        stage: { isWonStage: true },
      },
      _avg: { amount: true },
    });

    const avgDealValue = Number(avgDealValueResult._avg.amount || 0);
    const avgWonValue = Number(avgWonValueResult._avg.amount || 0);

    // 9. Sales Trend by Month
    const wonDealsForTrend = await this.prisma.deal.findMany({
      where: {
        tenantId,
        stage: { isWonStage: true },
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

    const [totalProjectActive, totalTypes, totalUnits, leadStages, dealStages] =
      await Promise.all([
        this.prisma.product.count({ where: { tenantId, isActive: true } }),
        this.prisma.productVariant.count({ where: { tenantId } }),
        this.prisma.productUnit.count({ where: { tenantId } }),
        this.prisma.stage.findMany({
          where: { tenantId, entityType: 'lead', isActive: true },
          orderBy: { position: 'asc' },
          select: { id: true, name: true, color: true },
        }),
        this.prisma.stage.findMany({
          where: { tenantId, entityType: 'deal', isActive: true },
          orderBy: { position: 'asc' },
          select: { id: true, name: true, color: true },
        }),
      ]);

    const [previousProjects, previousTypes, previousUnits, previousOngoingDeals, previousWonDeals, previousLostDeals] =
      await Promise.all([
        this.prisma.product.count({ where: { tenantId, isActive: true, createdAt: { lt: currentMonthStart } } }),
        this.prisma.productVariant.count({ where: { tenantId, createdAt: { lt: currentMonthStart } } }),
        this.prisma.productUnit.count({ where: { tenantId, createdAt: { lt: currentMonthStart } } }),
        this.prisma.deal.count({ where: { tenantId, createdAt: { lt: currentMonthStart }, stage: { isTerminalStage: false } } }),
        this.prisma.deal.count({ where: { tenantId, createdAt: { lt: currentMonthStart }, stage: { isWonStage: true } } }),
        this.prisma.deal.count({ where: { tenantId, createdAt: { lt: currentMonthStart }, status: { isFailedStatus: true } } }),
      ]);

    const [leadStageCounts, dealStageCounts, upcomingVisits, unitStatusCounts, stockTotals] =
      await Promise.all([
        this.prisma.lead.groupBy({
          by: ['stageId'],
          // Sama dengan daftar Leads Management: Lead yang diarsipkan tidak dihitung.
          where: { tenantId, isDeleted: false, archivedAt: null, stageId: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.deal.groupBy({
          by: ['stageId'],
          where: { tenantId, stageId: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.viewing.findMany({
          where: { tenantId, scheduledAt: { gte: new Date() } },
          orderBy: { scheduledAt: 'asc' },
          take: 5,
          select: {
            id: true,
            scheduledAt: true,
            durationMinutes: true,
            name: true,
            customer: { select: { firstName: true, lastName: true } },
            location: { select: { name: true } },
          },
        }),
        this.prisma.productUnit.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.productTypeVariant.aggregate({
          where: { tenantId },
          _sum: { stock: true },
        }),
      ]);

    const countByStage = new Map(
      [...leadStageCounts, ...dealStageCounts].map((item) => [
        item.stageId,
        item._count._all,
      ])
    );
    const leadPipeline = leadStages.map((stage) => ({
      ...stage,
      count: countByStage.get(stage.id) ?? 0,
    }));
    const dealPipeline = dealStages.map((stage) => ({
      ...stage,
      count: countByStage.get(stage.id) ?? 0,
    }));

    const availabilityCounts = new Map(
      unitStatusCounts.map((item) => [item.status, item._count._all])
    );
    const available = availabilityCounts.get('AVAILABLE') ?? 0;
    const processing = availabilityCounts.get('BOOKED') ?? 0;
    const reserved = availabilityCounts.get('RESERVED') ?? 0;
    const sold = availabilityCounts.get('SOLD') ?? 0;
    const blocked = availabilityCounts.get('BLOCKED') ?? 0;
    const declaredStock = Number(stockTotals._sum.stock ?? 0);
    const notYetCreated = Math.max(declaredStock - totalUnits, 0);

    return {
      totalProjectActive,
      totalTypes,
      totalUnits,
      summaryChanges: {
        projects: percentageChange(totalProjectActive, previousProjects),
        types: percentageChange(totalTypes, previousTypes),
        units: percentageChange(totalUnits, previousUnits),
        ongoingDeals: percentageChange(ongoingDeals, previousOngoingDeals),
        wonDeals: percentageChange(wonDeals, previousWonDeals),
        lostDeals: percentageChange(lostDeals, previousLostDeals),
      },
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
      leadPipeline,
      dealPipeline,
      upcomingVisits,
      availability: {
        available,
        processing,
        reserved,
        sold,
        blocked,
        notYetCreated,
        total: available + processing + reserved + sold + blocked + notYetCreated,
      },
    };
  }
}
