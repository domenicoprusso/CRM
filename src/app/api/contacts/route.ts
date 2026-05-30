import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validators";

export async function GET() {
  const user = await requireUser("contact:read");
  const contacts = await prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { updatedAt: "desc" }, include: { company: true } });
  return NextResponse.json({ data: contacts });
}

export async function POST(request: Request) {
  const user = await requireUser("contact:write");
  const parsed = contactSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const contact = await prisma.contact.create({ data: { ...parsed.data, tenantId: user.tenantId, ownerId: user.id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Contact", entityId: contact.id, after: contact });
  return NextResponse.json({ data: contact }, { status: 201 });
}
