import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getLeadDeleteState } from "@/lib/crm-delete";
import { prisma } from "@/lib/prisma";
import { leadUpdateSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };
type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

function toLeadData(parsed: LeadUpdateInput) {
  return {
    ...parsed,
    estimatedValue: parsed.estimatedValue == null ? parsed.estimatedValue : new Prisma.Decimal(parsed.estimatedValue),
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

export async function GET(_: Request, context: Context) {
  const user = await requireUser("lead:read");
  const { id } = await context.params;
  const lead = await prisma.lead.findFirst({ where: { id, tenantId: user.tenantId }, include: { company: true, contact: true, activities: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ data: lead });
}

export async function PATCH(request: Request, context: Context) {
  const user = await requireUser("lead:write");
  const { id } = await context.params;
  const before = await prisma.lead.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const parsed = leadUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  if (!(await hasCompanyAccess(parsed.data.companyId, user.tenantId))) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (!(await hasContactAccess(parsed.data.contactId, user.tenantId))) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  const updated = await prisma.lead.updateMany({ where: { id, tenantId: user.tenantId }, data: toLeadData(parsed.data) });
  if (updated.count === 0) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const lead = await prisma.lead.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Lead", entityId: id, before, after: lead });
  return NextResponse.json({ data: lead });
}

export async function DELETE(_: Request, context: Context) {
  const user = await requireUser("lead:write");
  const { id } = await context.params;
  const { record, blocker } = await getLeadDeleteState(user.tenantId, id);
  if (!record) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  try {
    const deleted = await prisma.lead.deleteMany({ where: { id, tenantId: user.tenantId } });
    if (deleted.count === 0) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Lead could not be deleted" }, { status: 409 });
  }
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Lead", entityId: id, before: record });
  return NextResponse.json({ ok: true });
}
