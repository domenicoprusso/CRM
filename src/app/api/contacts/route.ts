import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { buildContactWhere } from "@/lib/crm-filters";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validators";

async function hasCompanyAccess(companyId: string | null | undefined, tenantId: string) {
  if (!companyId) return true;
  return Boolean(await prisma.company.findFirst({ where: { id: companyId, tenantId }, select: { id: true } }));
}

export async function GET(request: Request) {
  const user = await requireUser("contact:read");
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const contacts = await prisma.contact.findMany({ where: buildContactWhere(params, user), orderBy: { updatedAt: "desc" }, include: { company: true } });
  return NextResponse.json({ data: contacts });
}

export async function POST(request: Request) {
  const user = await requireUser("contact:write");
  const parsed = contactSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  if (!(await hasCompanyAccess(parsed.data.companyId, user.tenantId))) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const contact = await prisma.contact.create({ data: { ...parsed.data, tenantId: user.tenantId, ownerId: user.id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Contact", entityId: contact.id, after: contact });
  return NextResponse.json({ data: contact }, { status: 201 });
}
