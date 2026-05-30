"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { companySchema } from "@/lib/validators";

export async function createCompany(formData: FormData) {
  const user = await requireUser("company:write");
  const parsed = companySchema.parse(Object.fromEntries(formData));
  const company = await prisma.company.create({ data: { ...parsed, tenantId: user.tenantId, ownerId: user.id } });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Company", entityId: company.id, after: company });
  revalidatePath("/companies");
}
