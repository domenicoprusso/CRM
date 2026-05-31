import { prisma } from "@/lib/prisma";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";

type DecimalLike = { toString(): string };

export type ReportFilters = {
  from: Date;
  to: Date;
  ownerId?: string;
};

export type PipelineStageReportRow = {
  id: string;
  name: string;
  order: number;
  color: string;
  count: number;
  value: number;
  weightedValue: number;
};

export type OwnerReportRow = {
  ownerId: string | null;
  ownerName: string;
  count: number;
  value: number;
  weightedValue: number;
};

export type CountReportRow = {
  ownerId: string | null;
  ownerName: string;
  count: number;
  urgentCount?: number;
};

export type ReportSnapshot = {
  period: ReportFilters;
  users: Array<{ id: string; name: string }>;
  pipelineStages: Array<{ id: string; name: string; order: number; color: string; isWon: boolean; isLost: boolean }>;
  openOpportunities: Array<{
    id: string;
    title: string;
    ownerId: string | null;
    owner: { id: string; name: string } | null;
    value: number;
    probability: number;
    stageId: string;
    stage: { id: string; name: string; order: number; color: string; isWon: boolean; isLost: boolean };
    company: { id: string; name: string } | null;
  }>;
  opportunitiesWithoutNextAction: Array<{
    id: string;
    title: string;
    ownerId: string | null;
    owner: { id: string; name: string } | null;
    company: { id: string; name: string } | null;
    stage: { id: string; name: string; order: number; color: string; isWon: boolean; isLost: boolean };
  }>;
  pipelineRows: PipelineStageReportRow[];
  forecastRows: OwnerReportRow[];
  activityRows: CountReportRow[];
  overdueTaskRows: CountReportRow[];
  summary: {
    leadsCreated: number;
    opportunitiesCreatedFromLeads: number;
    conversionRate: number;
    closedWon: number;
    closedLost: number;
    wonRate: number;
    lostRate: number;
    pipelineValue: number;
    forecastTotal: number;
    activitiesTotal: number;
    overdueTasksTotal: number;
    opportunitiesWithoutNextAction: number;
  };
};

const money = (value: DecimalLike | number | null | undefined) => Number(value ? value.toString() : 0);
const notCompletedStatuses: Array<"DONE" | "CANCELLED"> = ["DONE", "CANCELLED"];
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function endExclusiveForDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

export function parseReportFilters(params: SearchParamsInput, now = new Date()): ReportFilters {
  const from = parseDate(readParam(params, "from")) ?? startOfMonth(now);
  const toRaw = parseDate(readParam(params, "to"));
  const to = toRaw ? endExclusiveForDate(toRaw) : now;
  return { from: startOfDay(from), to, ownerId: readParam(params, "ownerId") };
}

export function buildDateRangeWhere(field: "createdAt" | "updatedAt" | "occurredAt" | "dueAt", from: Date, to: Date): Record<string, { gte: Date; lt: Date }> {
  return { [field]: { gte: from, lt: to } } as Record<string, { gte: Date; lt: Date }>;
}

export function buildPipelineRows(
  stages: Array<{ id: string; name: string; order: number; color: string; isWon: boolean; isLost: boolean }>,
  opportunities: Array<{ stageId: string; value: DecimalLike | number; probability: number }>,
) {
  return stages.map((stage) => {
    const stageOpps = opportunities.filter((opportunity) => opportunity.stageId === stage.id);
    const value = stageOpps.reduce((sum, opportunity) => sum + money(opportunity.value), 0);
    const weightedValue = stageOpps.reduce((sum, opportunity) => sum + money(opportunity.value) * (opportunity.probability / 100), 0);
    return { ...stage, count: stageOpps.length, value, weightedValue };
  });
}

export function buildForecastRows(
  opportunities: Array<{
    ownerId: string | null;
    owner: { id: string; name: string } | null;
    value: DecimalLike | number;
    probability: number;
  }>,
) {
  const rows = new Map<string, OwnerReportRow>();

  for (const opportunity of opportunities) {
    const ownerId = opportunity.ownerId;
    const key = ownerId ?? "unassigned";
    const current = rows.get(key) ?? {
      ownerId,
      ownerName: opportunity.owner?.name ?? "N/D",
      count: 0,
      value: 0,
      weightedValue: 0,
    };
    current.count += 1;
    current.value += money(opportunity.value);
    current.weightedValue += money(opportunity.value) * (opportunity.probability / 100);
    rows.set(key, current);
  }

  return Array.from(rows.values()).sort((a, b) => b.weightedValue - a.weightedValue || b.value - a.value || a.ownerName.localeCompare(b.ownerName));
}

export function buildCountRows(rows: Array<{ ownerId: string | null; count: number }>, users: Array<{ id: string; name: string }>) {
  const userMap = new Map(users.map((user) => [user.id, user.name]));
  return rows
    .map((row) => ({
      ownerId: row.ownerId,
      ownerName: row.ownerId ? userMap.get(row.ownerId) ?? "N/D" : "N/D",
      count: row.count,
    }))
    .sort((a, b) => b.count - a.count || a.ownerName.localeCompare(b.ownerName));
}

export function buildTaskRows(rows: Array<{ ownerId: string | null; count: number; urgentCount: number }>, users: Array<{ id: string; name: string }>) {
  const userMap = new Map(users.map((user) => [user.id, user.name]));
  return rows
    .map((row) => ({
      ownerId: row.ownerId,
      ownerName: row.ownerId ? userMap.get(row.ownerId) ?? "N/D" : "N/D",
      count: row.count,
      urgentCount: row.urgentCount,
    }))
    .sort((a, b) => b.count - a.count || a.ownerName.localeCompare(b.ownerName));
}

export function buildConversionMetrics(leadsCreated: number, convertedOpportunities: number) {
  return {
    leadsCreated,
    opportunitiesCreatedFromLeads: convertedOpportunities,
    conversionRate: leadsCreated > 0 ? convertedOpportunities / leadsCreated : 0,
  };
}

export function buildWonLostMetrics(closedWon: number, closedLost: number) {
  const closedTotal = closedWon + closedLost;
  return {
    closedWon,
    closedLost,
    wonRate: closedTotal > 0 ? closedWon / closedTotal : 0,
    lostRate: closedTotal > 0 ? closedLost / closedTotal : 0,
  };
}

export function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))].join("\n");
}

export async function getReportSnapshot(prismaClient: typeof prisma, tenantId: string, filters: ReportFilters): Promise<ReportSnapshot> {
  const periodWhere = {
    tenantId,
    createdAt: { gte: filters.from, lt: filters.to },
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
  };
  const activityPeriodWhere = {
    tenantId,
    occurredAt: { gte: filters.from, lt: filters.to },
    ...(filters.ownerId ? { userId: filters.ownerId } : {}),
  };
  const taskOverdueWhere = {
    tenantId,
    dueAt: { lt: new Date() },
    status: { notIn: notCompletedStatuses },
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
  };
  const opportunityOwnerWhere = filters.ownerId ? { ownerId: filters.ownerId } : {};

  const [users, stages, leadsCreated, convertedOpps, closedWon, closedLost, openOpps, noActionOpps, activitiesByOwner, overdueTasksByOwnerRaw] = await Promise.all([
    prismaClient.user.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prismaClient.pipelineStage.findMany({ where: { tenantId }, orderBy: { order: "asc" } }),
    prismaClient.lead.count({ where: periodWhere }),
    prismaClient.opportunity.count({ where: { tenantId, createdAt: { gte: filters.from, lt: filters.to }, sourceLeadId: { not: null }, ...opportunityOwnerWhere } }),
    prismaClient.opportunity.count({ where: { tenantId, updatedAt: { gte: filters.from, lt: filters.to }, stage: { isWon: true }, ...opportunityOwnerWhere } }),
    prismaClient.opportunity.count({ where: { tenantId, updatedAt: { gte: filters.from, lt: filters.to }, stage: { isLost: true }, ...opportunityOwnerWhere } }),
    prismaClient.opportunity.findMany({
      where: { tenantId, stage: { isWon: false, isLost: false }, ...opportunityOwnerWhere },
      include: { owner: { select: { id: true, name: true } }, stage: true, company: { select: { id: true, name: true } } },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prismaClient.opportunity.findMany({
      where: { tenantId, stage: { isWon: false, isLost: false }, tasks: { none: { status: { notIn: ["DONE", "CANCELLED"] } } }, ...opportunityOwnerWhere },
      include: { owner: { select: { id: true, name: true } }, stage: true, company: { select: { id: true, name: true } } },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prismaClient.activity.groupBy({
      by: ["userId"],
      where: activityPeriodWhere,
      _count: { _all: true },
    }),
    prismaClient.task.groupBy({
      by: ["ownerId"],
      where: taskOverdueWhere,
      _count: { _all: true },
    }),
  ]);
  const overdueTasksByOwner = overdueTasksByOwnerRaw as Array<{ ownerId: string | null; _count: { _all: number } }>;

  const openStages = stages.filter((stage) => !stage.isWon && !stage.isLost);
  const pipelineRows = buildPipelineRows(
    openStages,
    openOpps.map((opportunity) => ({
      stageId: opportunity.stageId,
      value: opportunity.value,
      probability: opportunity.probability,
    })),
  );
  const forecastRows = buildForecastRows(openOpps);
  const activityRows = buildCountRows(
    activitiesByOwner.map((row) => ({ ownerId: row.userId, count: row._count._all })),
    users,
  );
  const overdueTaskRows = buildTaskRows(
    overdueTasksByOwner.map((row) => ({
      ownerId: row.ownerId,
      count: row._count._all,
      urgentCount: 0,
    })),
    users,
  );

  const conversion = buildConversionMetrics(leadsCreated, convertedOpps);
  const wonLost = buildWonLostMetrics(closedWon, closedLost);
  const pipelineValue = pipelineRows.reduce((sum, row) => sum + row.value, 0);
  const forecastTotal = forecastRows.reduce((sum, row) => sum + row.weightedValue, 0);
  const activitiesTotal = activityRows.reduce((sum, row) => sum + row.count, 0);
  const overdueTasksTotal = overdueTaskRows.reduce((sum, row) => sum + row.count, 0);

  return {
    period: filters,
    users,
    pipelineStages: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      order: stage.order,
      color: stage.color,
      isWon: stage.isWon,
      isLost: stage.isLost,
    })),
    openOpportunities: openOpps.map((opportunity) => ({
      id: opportunity.id,
      title: opportunity.title,
      ownerId: opportunity.ownerId,
      owner: opportunity.owner,
      value: money(opportunity.value),
      probability: opportunity.probability,
      stageId: opportunity.stageId,
      stage: opportunity.stage,
      company: opportunity.company,
    })),
    opportunitiesWithoutNextAction: noActionOpps,
    pipelineRows,
    forecastRows,
    activityRows,
    overdueTaskRows,
    summary: {
      leadsCreated: conversion.leadsCreated,
      opportunitiesCreatedFromLeads: conversion.opportunitiesCreatedFromLeads,
      conversionRate: conversion.conversionRate,
      closedWon: wonLost.closedWon,
      closedLost: wonLost.closedLost,
      wonRate: wonLost.wonRate,
      lostRate: wonLost.lostRate,
      pipelineValue,
      forecastTotal,
      activitiesTotal,
      overdueTasksTotal,
      opportunitiesWithoutNextAction: noActionOpps.length,
    },
  };
}

export function reportPeriodLabel(period: ReportFilters) {
  const formatter = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  const displayTo =
    period.to.getHours() === 0 && period.to.getMinutes() === 0 && period.to.getSeconds() === 0 && period.to.getMilliseconds() === 0
      ? new Date(period.to.getTime() - 24 * 60 * 60 * 1000)
      : period.to;
  return `${formatter.format(period.from)} - ${formatter.format(displayTo)}`;
}

export function formatPercentage(value: number) {
  return `${Math.round(value * 100)}%`;
}
