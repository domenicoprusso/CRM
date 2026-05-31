import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { buildOpportunityWhere } from "@/lib/opportunity-filters";
import { resolveStage } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";
import { opportunitySchema } from "@/lib/validators";

type OpportunityInput = z.infer<typeof opportunitySchema>;

function toOpportunityData(parsed: OpportunityInput, stageId: string) {
  return {
    title: parsed.title,
    stageId,
    value: new Prisma.Decimal(parsed.value),
    probability: parsed.probability,
    expectedCloseDate: parsed.expectedCloseDate,
    companyId: parsed.companyId,
    contactId: parsed.contactId,
    sourceLeadId: parsed.sourceLeadId,
    notes: parsed.notes,
  };
}

async function hasCompanyAccess(companyId: string | null | undefined, tenantId: string) {
  if (!companyId) return true;
  return Boolean(await prisma.company.findFirst({ where: { id: companyId, tenantId }, select: { id: true } }));
}

async function hasContactAccess(contactId: string | null | undefined, tenantId: string) {
  if (!contactId) return true;
  return Boolean(await prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { id: true } }));
}

async function hasSourceLeadAccess(sourceLeadId: string | null | undefined, tenantId: string) {
  if (!sourceLeadId) return true;
  return Boolean(await prisma.lead.findFirst({ where: { id: sourceLeadId, tenantId }, select: { id: true } }));
}

export async function GET(request: Request) {
  const user = await requireUser("opportunity:read");
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const opportunities = await prisma.opportunity.findMany({
    where: buildOpportunityWhere(params, user),
    orderBy: { updatedAt: "desc" },
    include: { company: true, contact: true, owner: true, stage: true, sourceLead: true },
  });
  return NextResponse.json({ data: opportunities });
}

export async function POST(request: Request) {
  const user = await requireUser("opportunity:write");
  const parsed = opportunitySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  if (!(await hasCompanyAccess(parsed.data.companyId, user.tenantId))) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (!(await hasContactAccess(parsed.data.contactId, user.tenantId))) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  if (!(await hasSourceLeadAccess(parsed.data.sourceLeadId, user.tenantId))) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const stage = await resolveStage(user.tenantId, parsed.data.stageId);
  const opportunity = await prisma.opportunity.create({
    data: {
      ...toOpportunityData(parsed.data, stage.id),
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Opportunity", entityId: opportunity.id, after: opportunity });
  return NextResponse.json({ data: opportunity }, { status: 201 });
}
