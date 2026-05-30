import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { buildCompanyWhere } from "@/lib/crm-filters";
import { prisma } from "@/lib/prisma";
import { companySchema } from "@/lib/validators";

export async function GET(request: Request) {
  const user = await requireUser("company:read");
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const companies = await prisma.company.findMany({ where: buildCompanyWhere(params, user), orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ data: companies });
}

export async function POST(request: Request) {
  const user = await requireUser("company:write");
  const parsed = companySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const company = await prisma.company.create({ data: { ...parsed.data, tenantId: user.tenantId, ownerId: user.id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Company", entityId: company.id, after: company });
  return NextResponse.json({ data: company }, { status: 201 });
}
