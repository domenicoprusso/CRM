import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getCompanyDeleteState } from "@/lib/crm-delete";
import { prisma } from "@/lib/prisma";
import { companyUpdateSchema } from "@/lib/validators";

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
  const parsed = companyUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const updated = await prisma.company.updateMany({ where: { id, tenantId: user.tenantId }, data: parsed.data });
  if (updated.count === 0) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const company = await prisma.company.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Company", entityId: id, before, after: company });
  return NextResponse.json({ data: company });
}

export async function DELETE(_: Request, context: Context) {
  const user = await requireUser("company:write");
  const { id } = await context.params;
  const { record, blocker } = await getCompanyDeleteState(user.tenantId, id);
  if (!record) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  try {
    const deleted = await prisma.company.deleteMany({ where: { id, tenantId: user.tenantId } });
    if (deleted.count === 0) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Company could not be deleted" }, { status: 409 });
  }
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Company", entityId: id, before: record });
  return NextResponse.json({ ok: true });
}
