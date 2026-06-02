"use server";

import { ActivityType, TaskPriority, TaskStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

const ESITO_LABELS: Record<string, string> = {
  risposto: "Chiamata — Risposto",
  non_risposto: "Chiamata — Non risposto",
  da_richiamare: "Chiamata — Da richiamare",
};

export async function quickCallOnOpportunity(formData: FormData) {
  const user = await requireUser("activity:write");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const esito = String(formData.get("esito") ?? "risposto");
  const nota = String(formData.get("nota") ?? "").trim();
  const prossimaAzione = String(formData.get("prossima_azione") ?? "").trim();
  const prossimaData = String(formData.get("prossima_data") ?? "").trim();

  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, tenantId: user.tenantId },
    select: { id: true, companyId: true, contactId: true },
  });
  if (!opp) return redirect(`/opportunities?error=not-found`);

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
        opportunityId: opp.id,
        companyId: opp.companyId,
        contactId: opp.contactId,
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
          opportunityId: opp.id,
          companyId: opp.companyId,
          contactId: opp.contactId,
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

  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/dashboard");
  redirect(`/opportunities/${opportunityId}?logged=1`);
}
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { getOpportunityDeleteState } from "@/lib/opportunity-delete";
import { ensureDefaultPipelineStages, getAdjacentStage, getLostStage, getWonStage, resolveStage } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";
import { leadConversionSchema, opportunitySchema } from "@/lib/validators";

type OpportunityInput = z.infer<typeof opportunitySchema>;
type LeadConversionInput = z.infer<typeof leadConversionSchema>;

function getId(formData: FormData) {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
}

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

async function assertSourceLeadAccess(sourceLeadId: string | null | undefined, tenantId: string, redirectTo: string) {
  if (!sourceLeadId) return;
  const lead = await prisma.lead.findFirst({ where: { id: sourceLeadId, tenantId }, select: { id: true } });
  if (!lead) redirect(`${redirectTo}?error=invalid-lead`);
}

function conversionData(parsed: LeadConversionInput, stageId: string, lead: { companyId: string | null; contactId: string | null; notes: string | null; id: string }) {
  return {
    title: parsed.title,
    stageId,
    value: new Prisma.Decimal(parsed.value),
    probability: parsed.probability,
    expectedCloseDate: parsed.expectedCloseDate,
    companyId: lead.companyId,
    contactId: lead.contactId,
    sourceLeadId: lead.id,
    notes: parsed.notes ?? lead.notes,
  };
}

export async function createOpportunity(formData: FormData) {
  const user = await requireUser("opportunity:write");
  const parsed = opportunitySchema.parse(Object.fromEntries(formData));
  const stage = await resolveStage(user.tenantId, parsed.stageId);

  await assertCompanyAccess(parsed.companyId, user.tenantId, "/opportunities");
  await assertContactAccess(parsed.contactId, user.tenantId, "/opportunities");
  await assertSourceLeadAccess(parsed.sourceLeadId, user.tenantId, "/opportunities");

  const opportunity = await prisma.opportunity.create({
    data: {
      ...toOpportunityData(parsed, stage.id),
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Opportunity", entityId: opportunity.id, after: opportunity });
  revalidatePath("/opportunities");
  revalidatePath("/pipeline");
  redirect(`/opportunities/${opportunity.id}?created=1`);
}

export async function updateOpportunity(formData: FormData) {
  const user = await requireUser("opportunity:write");
  const id = getId(formData);
  const before = await prisma.opportunity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) redirect("/opportunities?error=not-found");

  const parsed = opportunitySchema.parse(Object.fromEntries(formData));
  const stage = await resolveStage(user.tenantId, parsed.stageId);
  await assertCompanyAccess(parsed.companyId, user.tenantId, `/opportunities/${id}`);
  await assertContactAccess(parsed.contactId, user.tenantId, `/opportunities/${id}`);
  await assertSourceLeadAccess(parsed.sourceLeadId, user.tenantId, `/opportunities/${id}`);

  const updated = await prisma.opportunity.updateMany({ where: { id, tenantId: user.tenantId }, data: toOpportunityData(parsed, stage.id) });
  if (updated.count === 0) redirect("/opportunities?error=not-found");
  const opportunity = await prisma.opportunity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!opportunity) redirect("/opportunities?error=not-found");

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Opportunity", entityId: id, before, after: opportunity });
  revalidatePath("/opportunities");
  revalidatePath("/pipeline");
  revalidatePath(`/opportunities/${id}`);
  redirect(`/opportunities/${id}?updated=1`);
}

export async function deleteOpportunity(formData: FormData) {
  const user = await requireUser("opportunity:write");
  const id = getId(formData);
  if (formData.get("confirmDelete") !== "ELIMINA") redirect(`/opportunities/${id}?error=confirm`);

  const { record, blocker } = await getOpportunityDeleteState(user.tenantId, id);
  if (!record) redirect("/opportunities?error=not-found");
  if (blocker) redirect(`/opportunities/${id}?error=delete-linked`);

  try {
    const deleted = await prisma.opportunity.deleteMany({ where: { id, tenantId: user.tenantId } });
    if (deleted.count === 0) redirect("/opportunities?error=not-found");
  } catch {
    redirect(`/opportunities/${id}?error=delete-failed`);
  }

  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Opportunity", entityId: id, before: record });
  revalidatePath("/opportunities");
  revalidatePath("/pipeline");
  redirect("/opportunities?deleted=1");
}

export async function moveOpportunity(formData: FormData) {
  const user = await requireUser("opportunity:write");
  const id = getId(formData);
  const direction = formData.get("direction") === "previous" ? "previous" : "next";
  const before = await prisma.opportunity.findFirst({ where: { id, tenantId: user.tenantId }, include: { stage: true } });
  if (!before) redirect("/pipeline?error=not-found");

  const nextStage = await getAdjacentStage(user.tenantId, before.stage.order, direction);
  if (!nextStage) redirect("/pipeline");

  const updated = await prisma.opportunity.updateMany({ where: { id, tenantId: user.tenantId }, data: { stageId: nextStage.id, probability: nextStage.probability } });
  if (updated.count === 0) redirect("/pipeline?error=not-found");
  const opportunity = await prisma.opportunity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!opportunity) redirect("/pipeline?error=not-found");
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "MOVE", entityType: "Opportunity", entityId: id, before, after: opportunity });
  revalidatePath("/opportunities");
  revalidatePath("/pipeline");
  redirect("/pipeline");
}

export async function setOpportunityOutcome(formData: FormData) {
  const user = await requireUser("opportunity:write");
  const id = getId(formData);
  const outcome = formData.get("outcome");
  const before = await prisma.opportunity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) redirect("/opportunities?error=not-found");

  const stages = await ensureDefaultPipelineStages(user.tenantId);
  const stage = outcome === "lost" ? getLostStage(stages) : getWonStage(stages);
  if (!stage) redirect(`/opportunities/${id}?error=missing-stage`);

  const updated = await prisma.opportunity.updateMany({ where: { id, tenantId: user.tenantId }, data: { stageId: stage.id, probability: stage.probability } });
  if (updated.count === 0) redirect("/opportunities?error=not-found");
  const opportunity = await prisma.opportunity.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!opportunity) redirect("/opportunities?error=not-found");
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: outcome === "lost" ? "MARK_LOST" : "MARK_WON", entityType: "Opportunity", entityId: id, before, after: opportunity });
  revalidatePath("/opportunities");
  revalidatePath("/pipeline");
  revalidatePath(`/opportunities/${id}`);
  redirect(`/opportunities/${id}?updated=1`);
}

export async function convertLeadToOpportunity(formData: FormData) {
  const user = await requireUser("opportunity:write");
  if (!can(user.role, "lead:write")) redirect("/dashboard");

  const parsed = leadConversionSchema.parse(Object.fromEntries(formData));
  const lead = await prisma.lead.findFirst({
    where: { id: parsed.leadId, tenantId: user.tenantId },
    include: { sourceOpportunity: true },
  });
  if (!lead) redirect("/leads?error=not-found");
  if (lead.status === "LOST") redirect(`/leads/${lead.id}?error=lost-lead`);
  if (lead.sourceOpportunity) redirect(`/opportunities/${lead.sourceOpportunity.id}`);

  const stage = await resolveStage(user.tenantId, parsed.stageId);
  const opportunity = await prisma.$transaction(async (tx) => {
    const created = await tx.opportunity.create({
      data: {
        ...conversionData(parsed, stage.id, lead),
        tenantId: user.tenantId,
        ownerId: lead.ownerId ?? user.id,
      },
    });
    const updatedLead = await tx.lead.updateMany({ where: { id: lead.id, tenantId: user.tenantId }, data: { status: "CONVERTED" } });
    if (updatedLead.count === 0) throw new Error("lead-not-found");
    const convertedLead = await tx.lead.findFirst({ where: { id: lead.id, tenantId: user.tenantId } });
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

  revalidatePath("/leads");
  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/opportunities");
  revalidatePath("/pipeline");
  redirect(`/opportunities/${opportunity.id}?converted=1`);
}
