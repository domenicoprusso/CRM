import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { buildTaskWhere } from "@/lib/productivity";
import { taskSchema } from "@/lib/validators";
import { TaskStatus } from "@prisma/client";

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
  const user = await requireUser("task:read");
  const url = new URL(request.url);
  const tasks = await prisma.task.findMany({
    where: buildTaskWhere(searchParamsToRecord(url.searchParams), user),
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { updatedAt: "desc" }],
    include: { owner: true, company: true, contact: true, lead: true, opportunity: true },
  });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const user = await requireUser("task:write");
  const payload = taskSchema.safeParse(await request.json());
  if (!payload.success) return NextResponse.json({ error: "invalid-payload", issues: payload.error.issues }, { status: 400 });

  const parsed = payload.data;
  if (!(await assertRelatedRecord(user.tenantId, "company", parsed.companyId))) return NextResponse.json({ error: "invalid-company" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "contact", parsed.contactId))) return NextResponse.json({ error: "invalid-contact" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "lead", parsed.leadId))) return NextResponse.json({ error: "invalid-lead" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "opportunity", parsed.opportunityId))) return NextResponse.json({ error: "invalid-opportunity" }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      tenantId: user.tenantId,
      ownerId: parsed.ownerId ?? user.id,
      title: parsed.title,
      description: parsed.description,
      status: parsed.status ?? TaskStatus.TODO,
      priority: parsed.priority,
      dueAt: parsed.dueAt ?? null,
      reminderAt: parsed.reminderAt ?? null,
      reminderSentAt: null,
      completedAt: parsed.status === TaskStatus.DONE ? parsed.completedAt ?? new Date() : null,
      companyId: parsed.companyId,
      contactId: parsed.contactId,
      leadId: parsed.leadId,
      opportunityId: parsed.opportunityId,
    },
    include: { owner: true, company: true, contact: true, lead: true, opportunity: true },
  });

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Task", entityId: task.id, after: task });
  return NextResponse.json({ task }, { status: 201 });
}
