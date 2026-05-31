import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { activityUpdateSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

async function assertRelatedRecord(tenantId: string, kind: "company" | "contact" | "lead" | "opportunity", id?: string | null) {
  if (!id) return true;
  const exists =
    kind === "company"
      ? await prisma.company.findFirst({ where: { id, tenantId }, select: { id: true } })
      : kind === "contact"
        ? await prisma.contact.findFirst({ where: { id, tenantId }, select: { id: true } })
        : kind === "lead"
          ? await prisma.lead.findFirst({ where: { id, tenantId }, select: { id: true } })
          : await prisma.opportunity.findFirst({ where: { id, tenantId }, select: { id: true } });
  return Boolean(exists);
}

export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser("activity:read");
  const { id } = await params;
  const activity = await prisma.activity.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { user: true, company: true, contact: true, lead: true, opportunity: true },
  });
  if (!activity) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({ activity });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser("activity:write");
  const { id } = await params;
  const before = await prisma.activity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const payload = activityUpdateSchema.safeParse(await request.json());
  if (!payload.success) return NextResponse.json({ error: "invalid-payload", issues: payload.error.issues }, { status: 400 });

  const parsed = payload.data;
  if (!(await assertRelatedRecord(user.tenantId, "company", parsed.companyId))) return NextResponse.json({ error: "invalid-company" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "contact", parsed.contactId))) return NextResponse.json({ error: "invalid-contact" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "lead", parsed.leadId))) return NextResponse.json({ error: "invalid-lead" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "opportunity", parsed.opportunityId))) return NextResponse.json({ error: "invalid-opportunity" }, { status: 400 });

  const activity = await prisma.activity.update({
    where: { id },
    data: {
      type: parsed.type ?? before.type,
      subject: parsed.subject ?? before.subject,
      body: parsed.body === undefined ? before.body : parsed.body,
      occurredAt: parsed.occurredAt === undefined ? before.occurredAt : parsed.occurredAt ?? before.occurredAt,
      companyId: parsed.companyId === undefined ? before.companyId : parsed.companyId,
      contactId: parsed.contactId === undefined ? before.contactId : parsed.contactId,
      leadId: parsed.leadId === undefined ? before.leadId : parsed.leadId,
      opportunityId: parsed.opportunityId === undefined ? before.opportunityId : parsed.opportunityId,
    },
    include: { user: true, company: true, contact: true, lead: true, opportunity: true },
  });

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Activity", entityId: id, before, after: activity });
  return NextResponse.json({ activity });
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser("activity:write");
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.confirmDelete !== "ELIMINA") return NextResponse.json({ error: "confirm" }, { status: 400 });

  const activity = await prisma.activity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!activity) return NextResponse.json({ error: "not-found" }, { status: 404 });

  await prisma.activity.delete({ where: { id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Activity", entityId: id, before: activity });
  return NextResponse.json({ ok: true });
}
