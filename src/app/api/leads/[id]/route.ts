import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { leadSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

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
  const parsed = leadSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const lead = await prisma.lead.update({ where: { id }, data: { ...parsed.data, estimatedValue: parsed.data.estimatedValue === undefined ? undefined : new Prisma.Decimal(parsed.data.estimatedValue) } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Lead", entityId: id, before, after: lead });
  return NextResponse.json({ data: lead });
}

export async function DELETE(_: Request, context: Context) {
  const user = await requireUser("lead:write");
  const { id } = await context.params;
  const before = await prisma.lead.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await prisma.lead.delete({ where: { id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Lead", entityId: id, before });
  return NextResponse.json({ ok: true });
}
