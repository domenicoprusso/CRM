"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActivityType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { activitySchema, activityUpdateSchema } from "@/lib/validators";
import type { z } from "zod";

function getId(formData: FormData) {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
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

function normalizeActivityData(
  parsed: z.infer<typeof activitySchema> | z.infer<typeof activityUpdateSchema>,
  before?: {
    type: string;
    subject: string;
    body: string | null;
    occurredAt: Date;
    companyId: string | null;
    contactId: string | null;
    leadId: string | null;
    opportunityId: string | null;
  },
) {
  return {
    type: (parsed.type ?? before?.type ?? ActivityType.NOTE) as ActivityType,
    subject: parsed.subject ?? before?.subject ?? "",
    body: parsed.body === undefined ? before?.body ?? null : parsed.body,
    occurredAt: parsed.occurredAt === undefined ? before?.occurredAt ?? new Date() : parsed.occurredAt ?? new Date(),
    companyId: parsed.companyId === undefined ? before?.companyId ?? null : parsed.companyId,
    contactId: parsed.contactId === undefined ? before?.contactId ?? null : parsed.contactId,
    leadId: parsed.leadId === undefined ? before?.leadId ?? null : parsed.leadId,
    opportunityId: parsed.opportunityId === undefined ? before?.opportunityId ?? null : parsed.opportunityId,
  };
}

async function refreshLastActivityAt(companyId?: string | null, leadId?: string | null) {
  const tasks: Promise<unknown>[] = [];
  if (companyId) {
    tasks.push(
      prisma.activity.aggregate({ where: { companyId }, _max: { occurredAt: true } }).then((r) =>
        prisma.company.update({ where: { id: companyId }, data: { lastActivityAt: r._max.occurredAt } })
      )
    );
  }
  if (leadId) {
    tasks.push(
      prisma.activity.aggregate({ where: { leadId }, _max: { occurredAt: true } }).then((r) =>
        prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: r._max.occurredAt } })
      )
    );
  }
  await Promise.all(tasks);
}

export async function createActivity(formData: FormData) {
  const user = await requireUser("activity:write");
  const parsed = activitySchema.parse(Object.fromEntries(formData));

  await assertRelatedRecord(user.tenantId, "/activities", "company", parsed.companyId);
  await assertRelatedRecord(user.tenantId, "/activities", "contact", parsed.contactId);
  await assertRelatedRecord(user.tenantId, "/activities", "lead", parsed.leadId);
  await assertRelatedRecord(user.tenantId, "/activities", "opportunity", parsed.opportunityId);

  const activity = await prisma.activity.create({
    data: {
      ...normalizeActivityData(parsed),
      tenantId: user.tenantId,
      userId: user.id,
    },
  });

  await refreshLastActivityAt(activity.companyId, activity.leadId);
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Activity", entityId: activity.id, after: activity });
  revalidatePath("/activities");
  revalidatePath("/dashboard");
  if (activity.companyId) revalidatePath(`/companies/${activity.companyId}`);
  if (activity.contactId) revalidatePath(`/contacts/${activity.contactId}`);
  if (activity.leadId) revalidatePath(`/leads/${activity.leadId}`);
  if (activity.opportunityId) revalidatePath(`/opportunities/${activity.opportunityId}`);
  const redirectTo = formData.get("redirectTo");
  redirect(typeof redirectTo === "string" && redirectTo.startsWith("/") ? redirectTo : `/activities/${activity.id}?created=1`);
}

export async function updateActivity(formData: FormData) {
  const user = await requireUser("activity:write");
  const id = getId(formData);
  const before = await prisma.activity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) redirect("/activities?error=not-found");

  const parsed = activityUpdateSchema.parse(Object.fromEntries(formData));
  await assertRelatedRecord(user.tenantId, `/activities/${id}`, "company", parsed.companyId);
  await assertRelatedRecord(user.tenantId, `/activities/${id}`, "contact", parsed.contactId);
  await assertRelatedRecord(user.tenantId, `/activities/${id}`, "lead", parsed.leadId);
  await assertRelatedRecord(user.tenantId, `/activities/${id}`, "opportunity", parsed.opportunityId);

  const updated = await prisma.activity.updateMany({
    where: { id, tenantId: user.tenantId },
    data: normalizeActivityData(parsed, before),
  });
  if (updated.count === 0) redirect("/activities?error=not-found");
  const activity = await prisma.activity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!activity) redirect("/activities?error=not-found");

  await refreshLastActivityAt(activity.companyId, activity.leadId);
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Activity", entityId: id, before, after: activity });
  revalidatePath("/activities");
  revalidatePath("/dashboard");
  if (activity.companyId) revalidatePath(`/companies/${activity.companyId}`);
  if (activity.contactId) revalidatePath(`/contacts/${activity.contactId}`);
  if (activity.leadId) revalidatePath(`/leads/${activity.leadId}`);
  if (activity.opportunityId) revalidatePath(`/opportunities/${activity.opportunityId}`);
  revalidatePath(`/activities/${id}`);
  redirect(`/activities/${id}?updated=1`);
}

export async function deleteActivity(formData: FormData) {
  const user = await requireUser("activity:write");
  const id = getId(formData);
  if (formData.get("confirmDelete") !== "ELIMINA") redirect(`/activities/${id}?error=confirm`);

  const before = await prisma.activity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) redirect("/activities?error=not-found");

  try {
    const deleted = await prisma.activity.deleteMany({ where: { id, tenantId: user.tenantId } });
    if (deleted.count === 0) redirect("/activities?error=not-found");
  } catch {
    redirect(`/activities/${id}?error=delete-failed`);
  }

  await refreshLastActivityAt(before.companyId, before.leadId);
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Activity", entityId: id, before });
  revalidatePath("/activities");
  revalidatePath("/dashboard");
  redirect("/activities?deleted=1");
}
