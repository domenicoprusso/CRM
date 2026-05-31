import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { resolveStage } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";
import { leadConversionSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = await requireUser("opportunity:write");
  if (!can(user.role, "lead:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json();
  const parsed = leadConversionSchema.safeParse({ ...body, leadId: id });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const lead = await prisma.lead.findFirst({ where: { id, tenantId: user.tenantId }, include: { sourceOpportunity: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.status === "LOST") return NextResponse.json({ error: "Lost leads cannot be converted" }, { status: 409 });
  if (lead.sourceOpportunity) return NextResponse.json({ data: lead.sourceOpportunity }, { status: 200 });

  const stage = await resolveStage(user.tenantId, parsed.data.stageId);
  const opportunity = await prisma.$transaction(async (tx) => {
    const created = await tx.opportunity.create({
      data: {
        title: parsed.data.title,
        stageId: stage.id,
        value: new Prisma.Decimal(parsed.data.value),
        probability: parsed.data.probability,
        expectedCloseDate: parsed.data.expectedCloseDate,
        companyId: lead.companyId,
        contactId: lead.contactId,
        sourceLeadId: lead.id,
        notes: parsed.data.notes ?? lead.notes,
        tenantId: user.tenantId,
        ownerId: lead.ownerId ?? user.id,
      },
    });
    const convertedLead = await tx.lead.update({ where: { id: lead.id }, data: { status: "CONVERTED" } });
    await tx.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: "CONVERT",
        entityType: "Lead",
        entityId: lead.id,
        before: JSON.parse(JSON.stringify(lead)),
        after: JSON.parse(JSON.stringify({ lead: convertedLead, opportunity: created })),
      },
    });
    return created;
  });

  return NextResponse.json({ data: opportunity }, { status: 201 });
}
