"use server";

import { ActivityType, TaskPriority, TaskStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getLeadDeleteState } from "@/lib/crm-delete";
import { prisma } from "@/lib/prisma";
import { leadSchema } from "@/lib/validators";

const ESITO_LABELS: Record<string, string> = {
  risposto: "Chiamata — Risposto",
  non_risposto: "Chiamata — Non risposto",
  da_richiamare: "Chiamata — Da richiamare",
};

export async function quickCallOnLead(formData: FormData) {
  const user = await requireUser("activity:write");
  const leadId = String(formData.get("leadId") ?? "");
  const esito = String(formData.get("esito") ?? "risposto");
  const nota = String(formData.get("nota") ?? "").trim();
  const prossimaAzione = String(formData.get("prossima_azione") ?? "").trim();
  const prossimaData = String(formData.get("prossima_data") ?? "").trim();

  const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId: user.tenantId }, select: { id: true, companyId: true, contactId: true } });
  if (!lead) redirect(`/leads?error=not-found`);

  const subject = ESITO_LABELS[esito] ?? "Chiamata";
  const body = nota || null;

  await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        type: ActivityType.CALL,
        subject,
        body,
        occurredAt: new Date(),
        leadId: lead.id,
        companyId: lead.companyId,
        contactId: lead.contactId,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: "CREATE",
        entityType: "Activity",
        entityId: activity.id,
        after: JSON.parse(JSON.stringify(activity)),
      },
    });

    if (prossimaAzione) {
      const dueAt = prossimaData ? new Date(prossimaData) : null;
      const task = await tx.task.create({
        data: {
          tenantId: user.tenantId,
          ownerId: user.id,
          title: prossimaAzione,
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          dueAt,
          leadId: lead.id,
          companyId: lead.companyId,
          contactId: lead.contactId,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: "CREATE",
          entityType: "Task",
          entityId: task.id,
          after: JSON.parse(JSON.stringify(task)),
        },
      });
    }
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  redirect(`/leads/${leadId}?logged=1`);
}

type LeadInput = z.infer<typeof leadSchema>;

function getId(formData: FormData) {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
}

function toLeadData(parsed: LeadInput) {
  return {
    ...parsed,
    estimatedValue: parsed.estimatedValue == null ? parsed.estimatedValue : new Prisma.Decimal(parsed.estimatedValue),
  };
}

async function assertCompanyAccess(companyId: string | null | undefined, tenantId: string, redirectTo: string) {
  if (!companyId) return;
  const company = await prisma.company.findFirst({ where: { id: companyId, tenantId }, select: { id: true } });
  if (!company) redirect(`${redirectTo}?error=invalid-company`);
}

async function assertContactAccess(contactId: string | null | undefined, tenantId: string, redirectTo: string) {
  if (!contactId) return;
  const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { id: true } });
  if (!contact) redirect(`${redirectTo}?error=invalid-contact`);
}

export async function createLead(formData: FormData) {
  const user = await requireUser("lead:write");
  const parsed = leadSchema.parse(Object.fromEntries(formData));
  await assertCompanyAccess(parsed.companyId, user.tenantId, "/leads");
  await assertContactAccess(parsed.contactId, user.tenantId, "/leads");
  const lead = await prisma.lead.create({
    data: {
      ...toLeadData(parsed),
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Lead", entityId: lead.id, after: lead });
  revalidatePath("/leads");
}

export async function updateLead(formData: FormData) {
  const user = await requireUser("lead:write");
  const id = getId(formData);
  const before = await prisma.lead.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) redirect("/leads?error=not-found");

  const parsed = leadSchema.parse(Object.fromEntries(formData));
  await assertCompanyAccess(parsed.companyId, user.tenantId, `/leads/${id}`);
  await assertContactAccess(parsed.contactId, user.tenantId, `/leads/${id}`);
  const updated = await prisma.lead.updateMany({ where: { id, tenantId: user.tenantId }, data: toLeadData(parsed) });
  if (updated.count === 0) redirect("/leads?error=not-found");
  const lead = await prisma.lead.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!lead) redirect("/leads?error=not-found");

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Lead", entityId: id, before, after: lead });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  redirect(`/leads/${id}?updated=1`);
}

export async function deleteLead(formData: FormData) {
  const user = await requireUser("lead:write");
  const id = getId(formData);
  if (formData.get("confirmDelete") !== "ELIMINA") redirect(`/leads/${id}?error=confirm`);

  const { record, blocker } = await getLeadDeleteState(user.tenantId, id);
  if (!record) redirect("/leads?error=not-found");
  if (blocker) redirect(`/leads/${id}?error=delete-linked`);

  try {
    const deleted = await prisma.lead.deleteMany({ where: { id, tenantId: user.tenantId } });
    if (deleted.count === 0) redirect("/leads?error=not-found");
  } catch {
    redirect(`/leads/${id}?error=delete-failed`);
  }

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Lead", entityId: id, before: record });
  revalidatePath("/leads");
  redirect("/leads?deleted=1");
}
