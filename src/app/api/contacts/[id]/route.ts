import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

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
  const parsed = contactSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const contact = await prisma.contact.update({ where: { id }, data: parsed.data });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "UPDATE", entityType: "Contact", entityId: id, before, after: contact });
  return NextResponse.json({ data: contact });
}

export async function DELETE(_: Request, context: Context) {
  const user = await requireUser("contact:write");
  const { id } = await context.params;
  const before = await prisma.contact.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!before) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  await prisma.contact.delete({ where: { id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "DELETE", entityType: "Contact", entityId: id, before });
  return NextResponse.json({ ok: true });
}
