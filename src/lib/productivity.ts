import { ActivityType, TaskPriority, TaskStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { normalizeTagList, projectTagsFromValue } from "@/lib/tagging";

type CurrentUser = { id: string; tenantId: string };

const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
function appendWhereAnd<T>(existing: T | T[] | undefined, clause: T) {
  return [...(Array.isArray(existing) ? existing : existing ? [existing] : []), clause];
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

export function getPriorityWeight(priority: TaskPriority) {
  return { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[priority];
}

export function parseTaskFilters(params: SearchParamsInput) {
  const status = readParam(params, "status");
  const priority = readParam(params, "priority");
  const owner = readParam(params, "owner");
  const due = readParam(params, "due");

  return {
    q: readParam(params, "q"),
    owner: owner === "me" || owner === "all" ? owner : undefined,
    status: status && Object.values(TaskStatus).includes(status as TaskStatus) ? (status as TaskStatus) : undefined,
    priority: priority && Object.values(TaskPriority).includes(priority as TaskPriority) ? (priority as TaskPriority) : undefined,
    due: due === "today" || due === "overdue" || due === "upcoming" ? due : undefined,
    tag: normalizeTagList(readParam(params, "tag")),
    project: projectTagsFromValue(readParam(params, "project")),
  };
}

export function buildTaskWhere(params: SearchParamsInput, user: CurrentUser, now = new Date()): Prisma.TaskWhereInput {
  const filters = parseTaskFilters(params);
  const where: Prisma.TaskWhereInput = { tenantId: user.tenantId };

  if (filters.owner === "me") where.ownerId = user.id;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.tag.length > 0 || filters.project.length > 0) {
    const tags = [...filters.tag, ...filters.project];
    where.AND = appendWhereAnd(where.AND, {
      OR: [
        { company: { is: { tags: { hasSome: tags } } } },
        { contact: { is: { tags: { hasSome: tags } } } },
        { lead: { is: { tags: { hasSome: tags } } } },
        { opportunity: { is: { company: { is: { tags: { hasSome: tags } } } } } },
        { opportunity: { is: { contact: { is: { tags: { hasSome: tags } } } } } },
        { opportunity: { is: { sourceLead: { is: { tags: { hasSome: tags } } } } } },
        { opportunity: { is: { sourceLead: { is: { company: { is: { tags: { hasSome: tags } } } } } } } },
      ],
    } as Prisma.TaskWhereInput);
  }
  if (filters.due === "today") {
    where.dueAt = { gte: startOfDay(now), lt: endOfDay(now) };
    where.status = { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] };
  }
  if (filters.due === "overdue") {
    where.dueAt = { lt: now };
    where.status = { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] };
  }
  if (filters.due === "upcoming") {
    where.dueAt = { gte: endOfDay(now) };
    where.status = { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] };
  }
  if (filters.q) {
    where.OR = [
      { title: contains(filters.q) },
      { description: contains(filters.q) },
      { company: { is: { name: contains(filters.q) } } },
      { contact: { is: { firstName: contains(filters.q) } } },
      { contact: { is: { lastName: contains(filters.q) } } },
      { lead: { is: { title: contains(filters.q) } } },
      { opportunity: { is: { title: contains(filters.q) } } },
    ];
  }

  return where;
}

export function parseActivityFilters(params: SearchParamsInput) {
  const owner = readParam(params, "owner");
  const type = readParam(params, "type");
  const entityType = readParam(params, "entityType");
  const entityId = readParam(params, "entityId");

  return {
    q: readParam(params, "q"),
    owner: owner === "me" || owner === "all" ? owner : undefined,
    type: type && Object.values(ActivityType).includes(type as ActivityType) ? (type as ActivityType) : undefined,
    entityType: entityType === "company" || entityType === "contact" || entityType === "lead" || entityType === "opportunity" ? entityType : undefined,
    entityId,
    tag: normalizeTagList(readParam(params, "tag")),
    project: projectTagsFromValue(readParam(params, "project")),
  };
}

export function buildActivityWhere(params: SearchParamsInput, user: CurrentUser): Prisma.ActivityWhereInput {
  const filters = parseActivityFilters(params);
  const where: Prisma.ActivityWhereInput = { tenantId: user.tenantId };

  if (filters.owner === "me") where.userId = user.id;
  if (filters.type) where.type = filters.type;
  if (filters.entityType && filters.entityId) {
    if (filters.entityType === "company") where.companyId = filters.entityId;
    if (filters.entityType === "contact") where.contactId = filters.entityId;
    if (filters.entityType === "lead") where.leadId = filters.entityId;
    if (filters.entityType === "opportunity") where.opportunityId = filters.entityId;
  }
  if (filters.tag.length > 0 || filters.project.length > 0) {
    const tags = [...filters.tag, ...filters.project];
    where.AND = appendWhereAnd(where.AND, {
      OR: [
        { company: { is: { tags: { hasSome: tags } } } },
        { contact: { is: { tags: { hasSome: tags } } } },
        { lead: { is: { tags: { hasSome: tags } } } },
        { opportunity: { is: { company: { is: { tags: { hasSome: tags } } } } } },
        { opportunity: { is: { contact: { is: { tags: { hasSome: tags } } } } } },
        { opportunity: { is: { sourceLead: { is: { tags: { hasSome: tags } } } } } },
        { opportunity: { is: { sourceLead: { is: { company: { is: { tags: { hasSome: tags } } } } } } } },
      ],
    } as Prisma.ActivityWhereInput);
  }
  if (filters.q) {
    where.OR = [
      { subject: contains(filters.q) },
      { body: contains(filters.q) },
      { company: { is: { name: contains(filters.q) } } },
      { contact: { is: { firstName: contains(filters.q) } } },
      { contact: { is: { lastName: contains(filters.q) } } },
      { lead: { is: { title: contains(filters.q) } } },
      { opportunity: { is: { title: contains(filters.q) } } },
    ];
  }

  return where;
}

export async function getNextOpenTaskForOpportunity(prisma: Prisma.TransactionClient | PrismaClient, tenantId: string, opportunityId: string) {
  const tasks = await prisma.task.findMany({
    where: {
      tenantId,
      opportunityId,
      status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
    },
    include: { owner: true },
    orderBy: [{ dueAt: "asc" }, { updatedAt: "asc" }],
    take: 10,
  });

  return tasks
    .slice()
    .sort((a: (typeof tasks)[number], b: (typeof tasks)[number]) => {
      const dueA = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const dueB = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
      if (dueA !== dueB) return dueA - dueB;
      return getPriorityWeight(a.priority) - getPriorityWeight(b.priority);
    })[0];
}

export async function getRemindersDue(prisma: Prisma.TransactionClient | PrismaClient, tenantId: string, now = new Date()) {
  return prisma.task.findMany({
    where: {
      tenantId,
      reminderAt: { lte: now },
      reminderSentAt: null,
      status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
    },
    include: { owner: true, company: true, contact: true, lead: true, opportunity: true },
    orderBy: [{ reminderAt: "asc" }, { dueAt: "asc" }],
  });
}

export async function getOpportunitiesWithoutRecentActivityCount(prisma: Prisma.TransactionClient | PrismaClient, tenantId: string, days = 14) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return prisma.opportunity.count({
    where: {
      tenantId,
      stage: { isWon: false, isLost: false },
      activities: { none: { occurredAt: { gte: cutoff } } },
    },
  });
}
