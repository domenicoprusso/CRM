import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getContactDeleteState } from "@/lib/crm-delete";
import { prisma } from "@/lib/prisma";
import { contactUpdateSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

async function hasCompanyAccess(companyId: string | null | undefined, tenantId: string) {
  if (!companyId) return true;
  return Boolean(await prisma.company.findFirst({ where: { id: companyId, tenantId }, select: { id: true } }));
}

export async function GET(_: Request, context: Context) {
  const user = await requireUser("contact:read");
  const { id } = await context.params;
  const contact = await prisma.contact.findFirst({ where: { id, tenantId: user.tenantId }, include: { company: true, leads: true, activities: true } });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  return NextResponse.json({ data: contact });
}

export async function PATCH(request: Request, context: Context) {
  const user = await requireUser("contact:write");
  const { id } = await context.params;
  const before = await prisma.contact.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  const parsed = contactUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  if (!(await hasCompanyAccess(parsed.data.companyId, user.tenantId))) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const updated = await prisma.contact.updateMany({ where: { id, tenantId: user.tenantId }, data: parsed.data });
  if (updated.count === 0) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  const contact = await prisma.contact.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Contact", entityId: id, before, after: contact });
  return NextResponse.json({ data: contact });
}

export async function DELETE(_: Request, context: Context) {
  const user = await requireUser("contact:write");
  const { id } = await context.params;
  const { record, blocker } = await getContactDeleteState(user.tenantId, id);
  if (!record) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  try {
    const deleted = await prisma.contact.deleteMany({ where: { id, tenantId: user.tenantId } });
    if (deleted.count === 0) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Contact could not be deleted" }, { status: 409 });
  }
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Contact", entityId: id, before: record });
  return NextResponse.json({ ok: true });
}
