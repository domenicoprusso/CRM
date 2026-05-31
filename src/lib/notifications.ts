import { TaskStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NotificationCategoryId, NotificationItem, NotificationSection } from "@/lib/notification-types";

const NOTIFICATION_OPEN_TASK_STATUSES: TaskStatus[] = [TaskStatus.DONE, TaskStatus.CANCELLED];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function nextDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function formatDue(date: Date | null | undefined) {
  if (!date) return "senza data";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "senza scadenza";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function relationLabel(task: {
  company: { name: string } | null;
  contact: { firstName: string; lastName: string } | null;
  lead: { title: string } | null;
  opportunity: { title: string } | null;
}) {
  return task.company?.name ?? (task.contact ? `${task.contact.firstName} ${task.contact.lastName}` : task.lead?.title ?? task.opportunity?.title ?? "N/D");
}

function buildTaskItem(categoryId: NotificationCategoryId, task: {
  id: string;
  title: string;
  dueAt: Date | null;
  reminderAt: Date | null;
  priority: string;
  company: { name: string } | null;
  contact: { firstName: string; lastName: string } | null;
  lead: { title: string } | null;
  opportunity: { title: string } | null;
}) {
  const labels: Record<NotificationCategoryId, string> = {
    overdue: "Task scaduto",
    "due-today": "Task in scadenza oggi",
    "followup-today": "Follow-up di oggi",
    "opportunity-no-next-action": "Opportunità senza next action",
  };

  const subtitles: Record<NotificationCategoryId, string> = {
    overdue: `Scadenza ${formatDue(task.dueAt)}`,
    "due-today": `Scadenza ${formatDue(task.dueAt)}`,
    "followup-today": `Promemoria ${formatDateTime(task.reminderAt)}`,
    "opportunity-no-next-action": `Priorità ${task.priority}`,
  };

  return {
    fingerprint: `task:${categoryId}:${task.id}`,
    categoryId,
    categoryLabel: labels[categoryId],
    title: task.title,
    subtitle: `${subtitles[categoryId]} · ${relationLabel(task)}`,
    href: `/tasks/${task.id}`,
    tone: categoryId === "overdue" ? "red" : categoryId === "due-today" ? "amber" : "brand",
    sortAt: (task.dueAt ?? task.reminderAt ?? new Date(0)).toISOString(),
  } satisfies NotificationItem;
}

function buildOpportunityItem(opportunity: {
  id: string;
  title: string;
  company: { name: string } | null;
  owner: { name: string } | null;
  stage: { name: string } | null;
}) {
  return {
    fingerprint: `opportunity:no-next-action:${opportunity.id}`,
    categoryId: "opportunity-no-next-action",
    categoryLabel: "Opportunità senza next action",
    title: opportunity.title,
    subtitle: `${opportunity.company?.name ?? "N/D"} · ${opportunity.owner?.name ?? "N/D"} · ${opportunity.stage?.name ?? "N/D"}`,
    href: `/opportunities/${opportunity.id}`,
    tone: "slate",
    sortAt: new Date().toISOString(),
  } satisfies NotificationItem;
}

function sectionFromItems(id: NotificationCategoryId, label: string, description: string, tone: NotificationSection["tone"], items: NotificationItem[]): NotificationSection {
  const sorted = items.slice().sort((a, b) => a.sortAt.localeCompare(b.sortAt) || a.title.localeCompare(b.title));
  return { id, label, description, tone, count: sorted.length, items: sorted };
}

export function buildNotificationSnapshot(
  input: {
    overdueTasks: Array<{
      id: string;
      title: string;
      dueAt: Date | null;
      reminderAt: Date | null;
      priority: string;
      company: { name: string } | null;
      contact: { firstName: string; lastName: string } | null;
      lead: { title: string } | null;
      opportunity: { title: string } | null;
    }>;
    dueTodayTasks: Array<{
      id: string;
      title: string;
      dueAt: Date | null;
      reminderAt: Date | null;
      priority: string;
      company: { name: string } | null;
      contact: { firstName: string; lastName: string } | null;
      lead: { title: string } | null;
      opportunity: { title: string } | null;
    }>;
    followupTodayTasks: Array<{
      id: string;
      title: string;
      dueAt: Date | null;
      reminderAt: Date | null;
      priority: string;
      company: { name: string } | null;
      contact: { firstName: string; lastName: string } | null;
      lead: { title: string } | null;
      opportunity: { title: string } | null;
    }>;
    opportunitiesWithoutNextAction: Array<{
      id: string;
      title: string;
      company: { name: string } | null;
      owner: { name: string } | null;
      stage: { name: string } | null;
    }>;
  },
) {
  const seenFingerprints = new Set<string>();
  const uniqueItems = (items: NotificationItem[]) => items.filter((item) => {
    if (seenFingerprints.has(item.fingerprint)) return false;
    seenFingerprints.add(item.fingerprint);
    return true;
  });

  const sections: NotificationSection[] = [
    sectionFromItems("overdue", "Task scaduti", "Task aperti con scadenza superata.", "red", uniqueItems(input.overdueTasks.map((task) => buildTaskItem("overdue", task)))),
    sectionFromItems("due-today", "Task in scadenza oggi", "Task aperti da gestire oggi.", "amber", uniqueItems(input.dueTodayTasks.map((task) => buildTaskItem("due-today", task)))),
    sectionFromItems("followup-today", "Follow-up di oggi", "Promemoria aperti previsti per oggi.", "brand", uniqueItems(input.followupTodayTasks.map((task) => buildTaskItem("followup-today", task)))),
    sectionFromItems(
      "opportunity-no-next-action",
      "Opportunità senza Next Action",
      "Opportunità aperte senza task aperti associati.",
      "slate",
      uniqueItems(input.opportunitiesWithoutNextAction.map((opportunity) => buildOpportunityItem(opportunity))),
    ),
  ];

  const items = sections.flatMap((section) => section.items);

  return {
    generatedAt: new Date().toISOString(),
    totalCount: items.length,
    sections,
    items,
  };
}

export async function getNotificationSnapshot(prismaClient: PrismaClient | typeof prisma, tenantId: string, now = new Date()) {
  const todayStart = startOfDay(now);
  const tomorrowStart = nextDay(now);

  const [overdueTasks, dueTodayTasks, followupTodayTasks, opportunitiesWithoutNextAction] = await Promise.all([
    prismaClient.task.findMany({
      where: {
        tenantId,
        status: { notIn: NOTIFICATION_OPEN_TASK_STATUSES },
        dueAt: { lt: todayStart },
      },
      include: { company: true, contact: true, lead: true, opportunity: true },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 20,
    }),
    prismaClient.task.findMany({
      where: {
        tenantId,
        status: { notIn: NOTIFICATION_OPEN_TASK_STATUSES },
        dueAt: { gte: todayStart, lt: tomorrowStart },
      },
      include: { company: true, contact: true, lead: true, opportunity: true },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 20,
    }),
    prismaClient.task.findMany({
      where: {
        tenantId,
        status: { notIn: NOTIFICATION_OPEN_TASK_STATUSES },
        reminderAt: { gte: todayStart, lt: tomorrowStart },
        OR: [{ dueAt: null }, { dueAt: { gte: tomorrowStart } }],
      },
      include: { company: true, contact: true, lead: true, opportunity: true },
      orderBy: [{ reminderAt: "asc" }, { updatedAt: "desc" }],
      take: 20,
    }),
    prismaClient.opportunity.findMany({
      where: {
        tenantId,
        stage: { isWon: false, isLost: false },
        tasks: { none: { status: { notIn: NOTIFICATION_OPEN_TASK_STATUSES } } },
      },
      include: { company: { select: { name: true } }, owner: { select: { name: true } }, stage: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }],
      take: 20,
    }),
  ]);

  return buildNotificationSnapshot({
    overdueTasks,
    dueTodayTasks,
    followupTodayTasks,
    opportunitiesWithoutNextAction,
  });
}
