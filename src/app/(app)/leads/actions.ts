"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { leadSchema } from "@/lib/validators";

export async function createLead(formData: FormData) {
  const user = await requireUser("lead:write");
  const parsed = leadSchema.parse(Object.fromEntries(formData));
  const lead = await prisma.lead.create({
    data: {
      ...parsed,
      estimatedValue: parsed.estimatedValue === undefined ? undefined : new Prisma.Decimal(parsed.estimatedValue),
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });
  await writeAuditLog({ tenantId: user.tenantId, userId: user.id, action: "CREATE", entityType: "Lead", entityId: lead.id, after: lead });
  revalidatePath("/leads");
}
