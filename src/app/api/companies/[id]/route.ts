import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { companySchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const user = await requireUser("company:read");
  const { id } = await context.params;
  const company = await prisma.company.findFirst({ where: { id, tenantId: user.tenantId }, include: { contacts: true, leads: true, activities: true } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json({ data: company });
}

export async function PATCH(request: Request, context: Context) {
  const user = await requireUser("company:write");
  const { id } = await context.params;
  const before = await prisma.company.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const parsed = companySchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const company = await prisma.company.update({ where: { id }, data: parsed.data });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Company", entityId: id, before, after: company });
  return NextResponse.json({ data: company });
}

export async function DELETE(_: Request, context: Context) {
  const user = await requireUser("company:write");
  const { id } = await context.params;
  const before = await prisma.company.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  await prisma.company.delete({ where: { id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Company", entityId: id, before });
  return NextResponse.json({ ok: true });
}
