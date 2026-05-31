import { NextResponse } from "next/server";
import { TaskStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { taskUpdateSchema } from "@/lib/validators";

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
  const user = await requireUser("task:read");
  const { id } = await params;
  const task = await prisma.task.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { owner: true, company: true, contact: true, lead: true, opportunity: true },
  });
  if (!task) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser("task:write");
  const { id } = await params;
  const before = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const payload = taskUpdateSchema.safeParse(await request.json());
  if (!payload.success) return NextResponse.json({ error: "invalid-payload", issues: payload.error.issues }, { status: 400 });

  const parsed = payload.data;
  if (!(await assertRelatedRecord(user.tenantId, "company", parsed.companyId))) return NextResponse.json({ error: "invalid-company" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "contact", parsed.contactId))) return NextResponse.json({ error: "invalid-contact" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "lead", parsed.leadId))) return NextResponse.json({ error: "invalid-lead" }, { status: 400 });
  if (!(await assertRelatedRecord(user.tenantId, "opportunity", parsed.opportunityId))) return NextResponse.json({ error: "invalid-opportunity" }, { status: 400 });

  const status = parsed.status ?? before.status;
  const reminderAt = parsed.reminderAt === undefined ? before.reminderAt : parsed.reminderAt;
  const task = await prisma.task.update({
    where: { id },
    data: {
      title: parsed.title ?? before.title,
      description: parsed.description === undefined ? before.description : parsed.description,
      ownerId: parsed.ownerId ?? before.ownerId,
      status,
      priority: parsed.priority ?? before.priority,
      dueAt: parsed.dueAt === undefined ? before.dueAt : parsed.dueAt,
      reminderAt,
      reminderSentAt: parsed.reminderAt === undefined ? before.reminderSentAt : null,
      completedAt: status === TaskStatus.DONE ? parsed.completedAt ?? before.completedAt ?? new Date() : null,
      companyId: parsed.companyId === undefined ? before.companyId : parsed.companyId,
      contactId: parsed.contactId === undefined ? before.contactId : parsed.contactId,
      leadId: parsed.leadId === undefined ? before.leadId : parsed.leadId,
      opportunityId: parsed.opportunityId === undefined ? before.opportunityId : parsed.opportunityId,
    },
    include: { owner: true, company: true, contact: true, lead: true, opportunity: true },
  });

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Task", entityId: id, before, after: task });
  return NextResponse.json({ task });
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser("task:write");
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.confirmDelete !== "ELIMINA") return NextResponse.json({ error: "confirm" }, { status: 400 });

  const task = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!task) return NextResponse.json({ error: "not-found" }, { status: 404 });

  await prisma.task.delete({ where: { id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Task", entityId: id, before: task });
  return NextResponse.json({ ok: true });
}
