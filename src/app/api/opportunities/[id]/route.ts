import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getOpportunityDeleteState } from "@/lib/opportunity-delete";
import { resolveStage } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";
import { opportunityUpdateSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };
type OpportunityUpdateInput = z.infer<typeof opportunityUpdateSchema>;

function toOpportunityData(parsed: OpportunityUpdateInput, stageId?: string) {
  return {
    ...parsed,
    stageId,
    value: parsed.value === undefined ? undefined : new Prisma.Decimal(parsed.value),
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

export async function GET(_: Request, context: Context) {
  const user = await requireUser("opportunity:read");
  const { id } = await context.params;
  const opportunity = await prisma.opportunity.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { company: true, contact: true, owner: true, stage: true, sourceLead: true, activities: true, tasks: true },
  });
  if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  return NextResponse.json({ data: opportunity });
}

export async function PATCH(request: Request, context: Context) {
  const user = await requireUser("opportunity:write");
  const { id } = await context.params;
  const before = await prisma.opportunity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const parsed = opportunityUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  if (!(await hasCompanyAccess(parsed.data.companyId, user.tenantId))) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (!(await hasContactAccess(parsed.data.contactId, user.tenantId))) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  if (!(await hasSourceLeadAccess(parsed.data.sourceLeadId, user.tenantId))) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const stage = parsed.data.stageId ? await resolveStage(user.tenantId, parsed.data.stageId) : undefined;
  const updated = await prisma.opportunity.updateMany({ where: { id, tenantId: user.tenantId }, data: toOpportunityData(parsed.data, stage?.id) });
  if (updated.count === 0) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  const opportunity = await prisma.opportunity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Opportunity", entityId: id, before, after: opportunity });
  return NextResponse.json({ data: opportunity });
}

export async function DELETE(_: Request, context: Context) {
  const user = await requireUser("opportunity:write");
  const { id } = await context.params;
  const { record, blocker } = await getOpportunityDeleteState(user.tenantId, id);
  if (!record) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  try {
    const deleted = await prisma.opportunity.deleteMany({ where: { id, tenantId: user.tenantId } });
    if (deleted.count === 0) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Opportunity could not be deleted" }, { status: 409 });
  }
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Opportunity", entityId: id, before: record });
  return NextResponse.json({ ok: true });
}
