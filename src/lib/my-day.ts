import type { PrismaClient } from "@prisma/client";
import { LeadStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MY_DAY_LIMIT = 10;

const COMPLETED_TASK_STATUSES: TaskStatus[] = [TaskStatus.DONE, TaskStatus.CANCELLED];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function nextDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export type MyDayTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: Date | null;
  reminderAt: Date | null;
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  lead: { id: string; title: string } | null;
  opportunity: { id: string; title: string } | null;
};

export type MyDayOpportunity = {
  id: string;
  title: string;
  value: string;
  probability: number;
  expectedCloseDate: Date | null;
  company: { id: string; name: string } | null;
  stage: { id: string; name: string; isWon: boolean; isLost: boolean };
};

export type MyDayLead = {
  id: string;
  title: string;
  score: number;
  estimatedValue: string | null;
  source: string | null;
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
};

export type MyDaySnapshot = {
  today: string;
  overdueTasks: MyDayTask[];
  overdueTotal: number;
  dueTodayTasks: MyDayTask[];
  dueTodayTotal: number;
  followupTodayTasks: MyDayTask[];
  followupTodayTotal: number;
  opportunitiesWithoutNextAction: MyDayOpportunity[];
  opportunitiesWithoutNextActionTotal: number;
  newLeads: MyDayLead[];
  newLeadsTotal: number;
  staleOpportunitiesTotal: number;
};

const taskInclude = {
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  lead: { select: { id: true, title: true } },
  opportunity: { select: { id: true, title: true } },
} as const;

export async function getMyDaySnapshot(
  prismaClient: PrismaClient | typeof prisma,
  tenantId: string,
  userId: string,
  now = new Date(),
): Promise<MyDaySnapshot> {
  const todayStart = startOfDay(now);
  const tomorrowStart = nextDay(now);

  const taskWhere = {
    tenantId,
    ownerId: userId,
    status: { notIn: COMPLETED_TASK_STATUSES },
  };

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const oppNoNextActionWhere = {
    tenantId,
    ownerId: userId,
    stage: { isWon: false, isLost: false },
    tasks: { none: { status: { notIn: COMPLETED_TASK_STATUSES } } },
  };

  // Run all queries in parallel for performance
  const [
    overdueCount,
    overdueTasks,
    dueTodayCount,
    dueTodayTasks,
    followupTodayCount,
    followupTodayTasks,
    opportunitiesWithoutNextActionCount,
    opportunitiesWithoutNextAction,
    staleOpportunitiesCount,
    newLeadsCount,
    newLeads,
  ] = await Promise.all([
    prismaClient.task.count({ where: { ...taskWhere, dueAt: { lt: todayStart } } }),
    prismaClient.task.findMany({
      where: { ...taskWhere, dueAt: { lt: todayStart } },
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
      take: MY_DAY_LIMIT,
      include: taskInclude,
    }),
    prismaClient.task.count({ where: { ...taskWhere, dueAt: { gte: todayStart, lt: tomorrowStart } } }),
    prismaClient.task.findMany({
      where: { ...taskWhere, dueAt: { gte: todayStart, lt: tomorrowStart } },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: MY_DAY_LIMIT,
      include: taskInclude,
    }),
    prismaClient.task.count({
      where: {
        ...taskWhere,
        reminderAt: { gte: todayStart, lt: tomorrowStart },
        OR: [{ dueAt: null }, { dueAt: { gte: tomorrowStart } }],
      },
    }),
    prismaClient.task.findMany({
      where: {
        ...taskWhere,
        reminderAt: { gte: todayStart, lt: tomorrowStart },
        OR: [{ dueAt: null }, { dueAt: { gte: tomorrowStart } }],
      },
      orderBy: [{ reminderAt: "asc" }],
      take: MY_DAY_LIMIT,
      include: taskInclude,
    }),
    prismaClient.opportunity.count({ where: oppNoNextActionWhere }),
    prismaClient.opportunity.findMany({
      where: oppNoNextActionWhere,
      orderBy: [{ expectedCloseDate: "asc" }, { updatedAt: "desc" }],
      take: MY_DAY_LIMIT,
      select: {
        id: true,
        title: true,
        value: true,
        probability: true,
        expectedCloseDate: true,
        company: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, isWon: true, isLost: true } },
      },
    }),
    // stale open opportunities (mine, not updated in 7+ days)
    prismaClient.opportunity.count({
      where: {
        tenantId,
        ownerId: userId,
        stage: { isWon: false, isLost: false },
        updatedAt: { lt: sevenDaysAgo },
      },
    }),
    prismaClient.lead.count({ where: { tenantId, ownerId: userId, status: LeadStatus.NEW } }),
    prismaClient.lead.findMany({
      where: { tenantId, ownerId: userId, status: LeadStatus.NEW },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      take: MY_DAY_LIMIT,
      select: {
        id: true,
        title: true,
        score: true,
        estimatedValue: true,
        source: true,
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  const toMyDayTask = (task: (typeof overdueTasks)[number]): MyDayTask => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt,
    reminderAt: task.reminderAt,
    company: task.company,
    contact: task.contact,
    lead: task.lead,
    opportunity: task.opportunity,
  });

  return {
    today: formatDay(now),
    overdueTasks: overdueTasks.map(toMyDayTask),
    overdueTotal: overdueCount,
    dueTodayTasks: dueTodayTasks.map(toMyDayTask),
    dueTodayTotal: dueTodayCount,
    followupTodayTasks: followupTodayTasks.map(toMyDayTask),
    followupTodayTotal: followupTodayCount,
    opportunitiesWithoutNextAction: opportunitiesWithoutNextAction.map((opp) => ({
      id: opp.id,
      title: opp.title,
      value: opp.value.toString(),
      probability: opp.probability,
      expectedCloseDate: opp.expectedCloseDate,
      company: opp.company,
      stage: opp.stage,
    })),
    opportunitiesWithoutNextActionTotal: opportunitiesWithoutNextActionCount,
    newLeads: newLeads.map((lead) => ({
      id: lead.id,
      title: lead.title,
      score: lead.score,
      estimatedValue: lead.estimatedValue?.toString() ?? null,
      source: lead.source,
      company: lead.company,
      contact: lead.contact,
    })),
    newLeadsTotal: newLeadsCount,
    staleOpportunitiesTotal: staleOpportunitiesCount,
  };
}
