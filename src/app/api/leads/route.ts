import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { leadSchema } from "@/lib/validators";

export async function GET() {
  const user = await requireUser("lead:read");
  const leads = await prisma.lead.findMany({ where: { tenantId: user.tenantId }, orderBy: { updatedAt: "desc" }, include: { company: true, contact: true } });
  return NextResponse.json({ data: leads });
}

export async function POST(request: Request) {
  const user = await requireUser("lead:write");
  const parsed = leadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const lead = await prisma.lead.create({ data: { ...parsed.data, estimatedValue: parsed.data.estimatedValue === undefined ? undefined : new Prisma.Decimal(parsed.data.estimatedValue), tenantId: user.tenantId, ownerId: user.id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Lead", entityId: lead.id, after: lead });
  return NextResponse.json({ data: lead }, { status: 201 });
}
