import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { buildLeadWhere } from "@/lib/crm-filters";
import { prisma } from "@/lib/prisma";
import { leadSchema } from "@/lib/validators";

type LeadInput = z.infer<typeof leadSchema>;

function toLeadData(parsed: LeadInput) {
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

export async function GET(request: Request) {
  const user = await requireUser("lead:read");
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const leads = await prisma.lead.findMany({ where: buildLeadWhere(params, user), orderBy: { updatedAt: "desc" }, include: { company: true, contact: true } });
  return NextResponse.json({ data: leads });
}

export async function POST(request: Request) {
  const user = await requireUser("lead:write");
  const parsed = leadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  if (!(await hasCompanyAccess(parsed.data.companyId, user.tenantId))) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (!(await hasContactAccess(parsed.data.contactId, user.tenantId))) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  const lead = await prisma.lead.create({ data: { ...toLeadData(parsed.data), tenantId: user.tenantId, ownerId: user.id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Lead", entityId: lead.id, after: lead });
  return NextResponse.json({ data: lead }, { status: 201 });
}
