"use server";

import { TaskPriority, TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { taskSchema, taskUpdateSchema } from "@/lib/validators";
import { getTaskDeleteState } from "@/lib/task-delete";

function getId(formData: FormData) {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
}

function normalizeOwnerId(ownerId: string | null | undefined, fallback: string) {
  return ownerId ?? fallback;
}

function normalizeTaskData(
  parsed: ReturnType<typeof taskSchema.parse> | ReturnType<typeof taskUpdateSchema.parse>,
  fallbackOwnerId: string,
  before?: {
    ownerId: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueAt: Date | null;
    reminderAt: Date | null;
    reminderSentAt: Date | null;
    completedAt: Date | null;
    description: string | null;
    title: string;
    companyId: string | null;
    contactId: string | null;
    leadId: string | null;
    opportunityId: string | null;
  },
) {
  const status = parsed.status ?? before?.status ?? TaskStatus.TODO;
  const dueAt = parsed.dueAt === undefined ? before?.dueAt ?? null : parsed.dueAt;
  const reminderAt = parsed.reminderAt === undefined ? before?.reminderAt ?? null : parsed.reminderAt;
  const completedAt = status === TaskStatus.DONE ? parsed.completedAt ?? before?.completedAt ?? new Date() : null;

  return {
    title: parsed.title ?? before?.title ?? "",
    description: parsed.description === undefined ? before?.description ?? null : parsed.description,
    ownerId: normalizeOwnerId(parsed.ownerId, before?.ownerId ?? fallbackOwnerId),
    status,
    priority: parsed.priority ?? before?.priority ?? TaskPriority.MEDIUM,
    dueAt,
    reminderAt,
    reminderSentAt: parsed.reminderAt === undefined ? before?.reminderSentAt ?? null : null,
    completedAt,
    companyId: parsed.companyId === undefined ? before?.companyId ?? null : parsed.companyId,
    contactId: parsed.contactId === undefined ? before?.contactId ?? null : parsed.contactId,
    leadId: parsed.leadId === undefined ? before?.leadId ?? null : parsed.leadId,
    opportunityId: parsed.opportunityId === undefined ? before?.opportunityId ?? null : parsed.opportunityId,
  };
}

async function assertRelatedRecord(tenantId: string, redirectTo: string, kind: "company" | "contact" | "lead" | "opportunity", id?: string | null) {
  if (!id) return;
  const exists =
    kind === "company"
      ? await prisma.company.findFirst({ where: { id, tenantId }, select: { id: true } })
      : kind === "contact"
        ? await prisma.contact.findFirst({ where: { id, tenantId }, select: { id: true } })
        : kind === "lead"
          ? await prisma.lead.findFirst({ where: { id, tenantId }, select: { id: true } })
          : await prisma.opportunity.findFirst({ where: { id, tenantId }, select: { id: true } });

  if (!exists) {
    const error = kind === "company" ? "invalid-company" : kind === "contact" ? "invalid-contact" : kind === "lead" ? "invalid-lead" : "invalid-opportunity";
    redirect(`${redirectTo}?error=${error}`);
  }
}

export async function createTask(formData: FormData) {
  const user = await requireUser("task:write");
  const parsed = taskSchema.parse(Object.fromEntries(formData));

  await assertRelatedRecord(user.tenantId, "/tasks", "company", parsed.companyId);
  await assertRelatedRecord(user.tenantId, "/tasks", "contact", parsed.contactId);
  await assertRelatedRecord(user.tenantId, "/tasks", "lead", parsed.leadId);
  await assertRelatedRecord(user.tenantId, "/tasks", "opportunity", parsed.opportunityId);

  const task = await prisma.task.create({
    data: {
      ...normalizeTaskData(parsed, user.id),
      tenantId: user.tenantId,
    },
  });

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Task", entityId: task.id, after: task });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect(`/tasks/${task.id}?created=1`);
}

export async function updateTask(formData: FormData) {
  const user = await requireUser("task:write");
  const id = getId(formData);
  const before = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) redirect("/tasks?error=not-found");

  const parsed = taskUpdateSchema.parse(Object.fromEntries(formData));
  await assertRelatedRecord(user.tenantId, `/tasks/${id}`, "company", parsed.companyId);
  await assertRelatedRecord(user.tenantId, `/tasks/${id}`, "contact", parsed.contactId);
  await assertRelatedRecord(user.tenantId, `/tasks/${id}`, "lead", parsed.leadId);
  await assertRelatedRecord(user.tenantId, `/tasks/${id}`, "opportunity", parsed.opportunityId);

  const task = await prisma.task.update({
    where: { id },
    data: normalizeTaskData(parsed, user.id, before),
  });

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Task", entityId: id, before, after: task });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.companyId) revalidatePath(`/companies/${task.companyId}`);
  if (task.contactId) revalidatePath(`/contacts/${task.contactId}`);
  if (task.leadId) revalidatePath(`/leads/${task.leadId}`);
  if (task.opportunityId) revalidatePath(`/opportunities/${task.opportunityId}`);
  revalidatePath(`/tasks/${id}`);
  redirect(`/tasks/${id}?updated=1`);
}

export async function completeTask(formData: FormData) {
  const user = await requireUser("task:write");
  const id = getId(formData);
  const before = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) redirect("/tasks?error=not-found");

  const task = await prisma.task.update({
    where: { id },
    data: { status: TaskStatus.DONE, completedAt: new Date() },
  });

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "COMPLETE", entityType: "Task", entityId: id, before, after: task });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath(`/tasks/${id}`);
  redirect(`/tasks/${id}?updated=1`);
}

export async function reopenTask(formData: FormData) {
  const user = await requireUser("task:write");
  const id = getId(formData);
  const before = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) redirect("/tasks?error=not-found");

  const task = await prisma.task.update({
    where: { id },
    data: { status: TaskStatus.TODO, completedAt: null },
  });

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "REOPEN", entityType: "Task", entityId: id, before, after: task });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath(`/tasks/${id}`);
  redirect(`/tasks/${id}?updated=1`);
}

export async function deleteTask(formData: FormData) {
  const user = await requireUser("task:write");
  const id = getId(formData);
  if (formData.get("confirmDelete") !== "ELIMINA") redirect(`/tasks/${id}?error=confirm`);

  const { record } = await getTaskDeleteState(user.tenantId, id);
  if (!record) redirect("/tasks?error=not-found");

  try {
    await prisma.task.delete({ where: { id } });
  } catch {
    redirect(`/tasks/${id}?error=delete-failed`);
  }

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Task", entityId: id, before: record });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect("/tasks?deleted=1");
}
