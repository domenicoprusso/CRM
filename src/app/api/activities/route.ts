import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { buildActivityWhere } from "@/lib/productivity";
import { activitySchema } from "@/lib/validators";

function searchParamsToRecord(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries()) as Record<string, string>;
}

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

export async function GET(request: Request) {
  const user = await requireUser("activity:read");
  const url = new URL(request.url);
  const activities = await prisma.activity.findMany({
    where: buildActivityWhere(searchParamsToRecord(url.searchParams), user),
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    include: { user: true, company: true, contact: true, lead: true, opportunity: true },
  });
  return NextResponse.json({ activities });
}

export async function POST(request: Request) {
  const user = await requireUser("activity:write");
  const payload = activitySchema.safeParse(await request.json());
  if (!payload.success) return NextResponse.json({ error: "invalid-payload", issues: payload.error.issues }, { status: 400 });

  const parsed = payload.data;
  if (!(await assertRelatedRecord(user.tenantId, "company", parsed.companyId))) return NextResponse.json({ error: "invalid-company" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "contact", parsed.contactId))) return NextResponse.json({ error: "invalid-contact" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "lead", parsed.leadId))) return NextResponse.json({ error: "invalid-lead" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "opportunity", parsed.opportunityId))) return NextResponse.json({ error: "invalid-opportunity" }, { status: 400 });

  const activity = await prisma.activity.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      type: parsed.type,
      subject: parsed.subject,
      body: parsed.body,
      occurredAt: parsed.occurredAt ?? new Date(),
      companyId: parsed.companyId,
      contactId: parsed.contactId,
      leadId: parsed.leadId,
      opportunityId: parsed.opportunityId,
    },
    include: { user: true, company: true, contact: true, lead: true, opportunity: true },
  });

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Activity", entityId: activity.id, after: activity });
  return NextResponse.json({ activity }, { status: 201 });
}
