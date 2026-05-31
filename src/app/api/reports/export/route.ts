import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { buildCompanyWhere, buildContactWhere, buildLeadWhere } from "@/lib/crm-filters";
import { buildOpportunityWhere } from "@/lib/opportunity-filters";
import { getReportSnapshot, parseReportFilters, toCsv } from "@/lib/reports";
import { prisma } from "@/lib/prisma";

function asSearchParams(searchParams: URLSearchParams): SearchParamsInput {
  return Object.fromEntries(searchParams.entries());
}

function filename(entity: string) {
  return `crm-${entity}.csv`;
}

export async function GET(request: Request) {
  const user = await requireUser("reports:export");
  const url = new URL(request.url);
  const params = asSearchParams(url.searchParams);
  const entity = readParam(params, "entity") ?? "summary";
  const filters = parseReportFilters(params);

  let csv = "";

  if (entity === "summary") {
    const snapshot = await getReportSnapshot(prisma, user.tenantId, filters);
    csv = toCsv(
      ["metric", "value"],
      [
        { metric: "forecast_total", value: snapshot.summary.forecastTotal },
        { metric: "conversion_rate", value: snapshot.summary.conversionRate },
        { metric: "won_rate", value: snapshot.summary.wonRate },
        { metric: "lost_rate", value: snapshot.summary.lostRate },
        { metric: "pipeline_value", value: snapshot.summary.pipelineValue },
        { metric: "activities_total", value: snapshot.summary.activitiesTotal },
        { metric: "overdue_tasks_total", value: snapshot.summary.overdueTasksTotal },
        { metric: "opportunities_without_next_action", value: snapshot.summary.opportunitiesWithoutNextAction },
      ],
    );
  } else if (entity === "opportunities") {
    const where = buildOpportunityWhere(params, user);
    if (filters.ownerId) where.ownerId = filters.ownerId;
    const opportunities = await prisma.opportunity.findMany({
      where,
      include: { owner: true, company: true, contact: true, stage: true, sourceLead: true },
      orderBy: { updatedAt: "desc" },
    });
    csv = toCsv(
      ["id", "title", "owner", "company", "contact", "stage", "value", "probability", "expectedCloseDate", "sourceLeadId"],
      opportunities.map((opportunity) => ({
        id: opportunity.id,
        title: opportunity.title,
        owner: opportunity.owner?.name ?? "",
        company: opportunity.company?.name ?? "",
        contact: opportunity.contact ? `${opportunity.contact.firstName} ${opportunity.contact.lastName}` : "",
        stage: opportunity.stage.name,
        value: opportunity.value,
        probability: opportunity.probability,
        expectedCloseDate: opportunity.expectedCloseDate,
        sourceLeadId: opportunity.sourceLeadId ?? "",
      })),
    );
  } else if (entity === "leads") {
    const where = buildLeadWhere(params, user);
    if (filters.ownerId) where.ownerId = filters.ownerId;
    const leads = await prisma.lead.findMany({
      where,
      include: { owner: true, company: true, contact: true },
      orderBy: { createdAt: "desc" },
    });
    csv = toCsv(
      ["id", "title", "owner", "company", "contact", "status", "score", "estimatedValue", "expectedCloseDate", "source"],
      leads.map((lead) => ({
        id: lead.id,
        title: lead.title,
        owner: lead.owner?.name ?? "",
        company: lead.company?.name ?? "",
        contact: lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}` : "",
        status: lead.status,
        score: lead.score,
        estimatedValue: lead.estimatedValue,
        expectedCloseDate: lead.expectedCloseDate,
        source: lead.source ?? "",
      })),
    );
  } else if (entity === "contacts") {
    const where = buildContactWhere(params, user);
    if (filters.ownerId) where.ownerId = filters.ownerId;
    const contacts = await prisma.contact.findMany({
      where,
      include: { owner: true, company: true },
      orderBy: { lastName: "asc" },
    });
    csv = toCsv(
      ["id", "firstName", "lastName", "owner", "company", "email", "phone", "lifecycle", "jobTitle"],
      contacts.map((contact) => ({
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        owner: contact.owner?.name ?? "",
        company: contact.company?.name ?? "",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        lifecycle: contact.lifecycle,
        jobTitle: contact.jobTitle ?? "",
      })),
    );
  } else if (entity === "companies") {
    const where = buildCompanyWhere(params, user);
    if (filters.ownerId) where.ownerId = filters.ownerId;
    const companies = await prisma.company.findMany({
      where,
      include: { owner: true },
      orderBy: { name: "asc" },
    });
    csv = toCsv(
      ["id", "name", "owner", "industry", "email", "phone", "city", "country"],
      companies.map((company) => ({
        id: company.id,
        name: company.name,
        owner: company.owner?.name ?? "",
        industry: company.industry ?? "",
        email: company.email ?? "",
        phone: company.phone ?? "",
        city: company.city ?? "",
        country: company.country ?? "",
      })),
    );
  } else {
    return NextResponse.json({ error: "invalid-entity" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=${filename(entity)}`,
    },
  });
}
